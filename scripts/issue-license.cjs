#!/usr/bin/env node
/**
 * issue-license.cjs — Sign a license file for a customer using your Ed25519
 * PRIVATE key.
 *
 * THIS SCRIPT MUST NEVER BE COMMITTED WITH A REAL PRIVATE KEY.
 * Keep your private key offline (password manager / hardware token) and pass
 * it via env var when running this:
 *
 *   MIZAN_LICENSOR_PRIVKEY="$(cat /path/to/key.pem)" \
 *     node scripts/issue-license.cjs \
 *     --to "Al-Quds Supermarket" \
 *     --machine 9f3...   # paste from the customer's License page (fingerprint)
 *     --expires 2027-04-28 \
 *     --tier standard \
 *     --out customer-quds.license.json
 *
 * Generate a NEW keypair (ONCE, store private safely):
 *
 *   node -e "const c = require('crypto');
 *     const { publicKey, privateKey } = c.generateKeyPairSync('ed25519');
 *     console.log('PUBLIC:'); console.log(publicKey.export({type:'spki',format:'pem'}));
 *     console.log('PRIVATE:'); console.log(privateKey.export({type:'pkcs8',format:'pem'}));"
 *
 * Paste the PUBLIC key into src/main/licensing/license.ts → LICENSOR_PUBLIC_KEY
 * BEFORE building any installer for customers. The PRIVATE key never touches
 * the codebase.
 */
'use strict';

const { createPrivateKey, sign } = require('crypto');
const { writeFileSync } = require('fs');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1];
}

const issuedTo = arg('to');
const machineId = arg('machine', '');
const expires = arg('expires', 'never');
const tier = arg('tier', 'standard');
const out = arg('out', 'license.json');

if (!issuedTo) {
  console.error('Missing --to "Customer Name"');
  process.exit(2);
}

const privPem = process.env.MIZAN_LICENSOR_PRIVKEY;
if (!privPem) {
  console.error('Missing env MIZAN_LICENSOR_PRIVKEY (PEM-encoded Ed25519 private key)');
  process.exit(2);
}

const today = new Date().toISOString().slice(0, 10);
const payload = {
  v: 1,
  issuedTo,
  machineId,
  expires,
  tier,
  issued: today,
};
const canonical = JSON.stringify(payload);

const priv = createPrivateKey({ key: privPem, format: 'pem' });
const sig = sign(null, Buffer.from(canonical, 'utf8'), priv).toString('base64');

const license = { ...payload, sig };
writeFileSync(out, JSON.stringify(license, null, 2), 'utf8');
console.log(`✓ Wrote ${out}`);
console.log(JSON.stringify(license, null, 2));
