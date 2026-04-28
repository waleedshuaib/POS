/**
 * Per-device database encryption key derivation + storage.
 *
 * Two pieces:
 *   1. A random 32-byte salt generated on first install, stored in the userData
 *      directory at .db-key.salt (NOT in the DB itself — chicken-and-egg).
 *   2. The hardware fingerprint (MAC + CPU model + hostname) hashed with the
 *      salt to produce the SQLCipher key.
 *
 * Result: copying the .db file to another machine = useless. The other machine
 * can't reproduce the key without ALSO copying .db-key.salt AND having the
 * same fingerprint (which it won't).
 *
 * The salt file is the weak link if someone has full filesystem access. We
 * could ship it via the OS keychain (keytar) for stronger protection — see
 * docs/14-future-enhancements.md.
 */

import { createHash, randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { networkInterfaces, hostname, platform, cpus } from 'os';

function fingerprint(): string {
  const macs = Object.values(networkInterfaces())
    .flat()
    .filter((i) => i && !i.internal && i.mac && i.mac !== '00:00:00:00:00:00')
    .map((i) => i!.mac)
    .sort()
    .join(',');
  return `${platform()}|${hostname()}|${cpus()[0]?.model ?? '?'}|${macs}`;
}

export function deriveDbKey(userDataDir: string): string {
  // Tests / CI can pin a specific key.
  if (process.env.POS_DB_KEY) return process.env.POS_DB_KEY;

  const saltPath = join(userDataDir, '.db-key.salt');
  let salt: Buffer;
  if (existsSync(saltPath)) {
    salt = Buffer.from(readFileSync(saltPath, 'utf8'), 'hex');
    if (salt.length !== 32) salt = newSalt(saltPath);
  } else {
    salt = newSalt(saltPath);
  }
  return createHash('sha256').update(salt).update(fingerprint()).digest('hex');
}

function newSalt(path: string): Buffer {
  const s = randomBytes(32);
  writeFileSync(path, s.toString('hex'), { encoding: 'utf8', mode: 0o600 });
  return s;
}
