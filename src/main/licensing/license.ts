/**
 * License system for Mizan POS.
 *
 * The licensor (you) keeps an Ed25519 private key OFF the customer's machine.
 * The matching PUBLIC key is embedded in the app at build time. Each license
 * file is a JSON payload signed with the private key:
 *
 *   {
 *     "v": 1,
 *     "issuedTo": "Al-Quds Supermarket",
 *     "machineId": "<sha256 hex of fingerprint>",  // empty = not bound yet
 *     "expires": "2027-04-28",                     // ISO date or "never"
 *     "tier": "standard",
 *     "issued": "2026-04-28",
 *     "sig": "<base64 ed25519 signature over canonical JSON of fields above>"
 *   }
 *
 * Validation runs on every app boot. Outcome states:
 *   - "valid"       — all good
 *   - "missing"     — no license installed yet (10-day grace from first run)
 *   - "expired"     — past `expires` date
 *   - "wrongMachine"— signed for a different fingerprint
 *   - "tampered"    — signature mismatch
 *   - "invalidPubKey" — embedded pub key is missing/wrong (build error)
 *
 * Enforcement is intentionally SOFT: cashiers can still ring sales (a real
 * shop must never go dark). Admin/manager actions are blocked beyond the
 * grace window — that motivates the owner to renew without taking down the
 * register at the worst moment.
 */

import { app } from 'electron';
import { createHash, createPublicKey, verify } from 'crypto';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { networkInterfaces, hostname, platform, arch, cpus } from 'os';
import { settingsRepo } from '../repos/settingsRepo';

// ── Embedded licensor public key ────────────────────────────────────────
// Replace BEFORE shipping to customers. Keep the matching private key SAFE
// (offline, in a password manager). Generate a fresh keypair with:
//
//   node -e "const c = require('crypto');
//     const { publicKey, privateKey } = c.generateKeyPairSync('ed25519');
//     console.log('PUBLIC:'); console.log(publicKey.export({type:'spki',format:'pem'}));
//     console.log('PRIVATE:'); console.log(privateKey.export({type:'pkcs8',format:'pem'}));"
//
// The placeholder below is a known dev key — every install would accept its
// signatures, which is FINE for a demo but useless for paid licensing.
export const LICENSOR_PUBLIC_KEY = process.env.MIZAN_LICENSOR_PUBKEY ?? `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAm3aA5bC8VlW1qB+PG3xBA4f4tH7GpJfZwjP3bC9pYuU=
-----END PUBLIC KEY-----`;

const GRACE_DAYS = 10;

export type LicenseStatus =
  | { state: 'valid'; license: License }
  | { state: 'grace'; daysLeft: number }
  | { state: 'missing' }
  | { state: 'expired'; license: License }
  | { state: 'wrongMachine'; license: License }
  | { state: 'tampered' }
  | { state: 'invalidPubKey' };

export interface License {
  v: 1;
  issuedTo: string;
  machineId: string;
  expires: string;       // ISO date YYYY-MM-DD or 'never'
  tier: string;
  issued: string;
  sig: string;
}

let cached: LicenseStatus | null = null;

/** Compute a stable per-machine fingerprint hash. */
export function machineFingerprint(): string {
  const macs = Object.values(networkInterfaces())
    .flat()
    .filter((iface) => iface && !iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00')
    .map((iface) => iface!.mac)
    .sort()
    .join(',');
  const cpuModel = cpus()[0]?.model ?? 'unknown';
  const raw = `${platform()}|${arch()}|${hostname()}|${cpuModel}|${macs}`;
  return createHash('sha256').update(raw).digest('hex');
}

function licenseFilePath(): string {
  return join(app.getPath('userData'), 'license.json');
}

function firstRunMarkerPath(): string {
  return join(app.getPath('userData'), '.first-run');
}

function getOrCreateFirstRun(): Date {
  const p = firstRunMarkerPath();
  if (!existsSync(p)) {
    const now = new Date();
    writeFileSync(p, now.toISOString(), 'utf8');
    return now;
  }
  return new Date(readFileSync(p, 'utf8'));
}

/** Canonical JSON of the signed payload (everything except `sig`). */
function canonical(lic: Omit<License, 'sig'>): string {
  return JSON.stringify({
    v: lic.v,
    issuedTo: lic.issuedTo,
    machineId: lic.machineId,
    expires: lic.expires,
    tier: lic.tier,
    issued: lic.issued,
  });
}

function verifySignature(lic: License): boolean {
  let pub;
  try {
    pub = createPublicKey(LICENSOR_PUBLIC_KEY);
  } catch {
    return false;
  }
  const data = Buffer.from(canonical(lic), 'utf8');
  const sig = Buffer.from(lic.sig, 'base64');
  try {
    return verify(null, data, pub, sig);
  } catch {
    return false;
  }
}

function loadLicense(): License | null {
  // Settings DB takes precedence (managed via the IPC handler), then file.
  const fromSettings = settingsRepo.get('license.json');
  if (fromSettings) {
    try { return JSON.parse(fromSettings); } catch { /* fall through */ }
  }
  const p = licenseFilePath();
  if (existsSync(p)) {
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
  }
  return null;
}

/** Save a license blob (same shape as License) to settings AND the file. */
export function installLicense(licenseJson: string): LicenseStatus {
  let parsed: License;
  try { parsed = JSON.parse(licenseJson); } catch { return { state: 'tampered' }; }
  settingsRepo.set('license.json', JSON.stringify(parsed));
  writeFileSync(licenseFilePath(), JSON.stringify(parsed, null, 2), 'utf8');
  cached = null;
  return checkLicense();
}

export function uninstallLicense(): void {
  settingsRepo.set('license.json', '');
  try { writeFileSync(licenseFilePath(), '', 'utf8'); } catch { /* ignore */ }
  cached = null;
}

export function checkLicense(): LicenseStatus {
  if (cached) return cached;

  // Dev backdoor: allow running without a license in development OR when
  // explicitly enabled with the env var. Never set this in distributed builds.
  if (!app.isPackaged || process.env.MIZAN_NO_LICENSE === '1') {
    cached = { state: 'valid', license: {
      v: 1, issuedTo: 'Developer', machineId: machineFingerprint(),
      expires: 'never', tier: 'dev', issued: new Date().toISOString().slice(0, 10), sig: '',
    } };
    return cached;
  }

  const lic = loadLicense();
  const now = Date.now();

  if (!lic) {
    const firstRun = getOrCreateFirstRun().getTime();
    const daysSince = Math.floor((now - firstRun) / (24 * 60 * 60 * 1000));
    if (daysSince < GRACE_DAYS) {
      cached = { state: 'grace', daysLeft: GRACE_DAYS - daysSince };
      return cached;
    }
    cached = { state: 'missing' };
    return cached;
  }

  // Pubkey valid?
  try { createPublicKey(LICENSOR_PUBLIC_KEY); } catch {
    cached = { state: 'invalidPubKey' };
    return cached;
  }

  // Signature valid?
  if (!verifySignature(lic)) {
    cached = { state: 'tampered' };
    return cached;
  }

  // Machine binding (empty machineId = unbound — allowed once on this host).
  if (lic.machineId && lic.machineId !== machineFingerprint()) {
    cached = { state: 'wrongMachine', license: lic };
    return cached;
  }

  // Expiry
  if (lic.expires !== 'never') {
    const exp = new Date(lic.expires + 'T23:59:59Z').getTime();
    if (now > exp) {
      cached = { state: 'expired', license: lic };
      return cached;
    }
  }

  cached = { state: 'valid', license: lic };
  return cached;
}

/** Are sales-blocking actions allowed right now? */
export function isFullyLicensed(): boolean {
  const s = checkLicense();
  return s.state === 'valid' || s.state === 'grace';
}

/** Are admin/manager actions allowed? Stricter than sales. */
export function isAdminAllowed(): boolean {
  const s = checkLicense();
  if (s.state === 'valid') return true;
  if (s.state === 'grace') return true;
  return false;
}

/** Reset cache — used after install/uninstall. */
export function resetCache(): void {
  cached = null;
}
