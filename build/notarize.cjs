/**
 * macOS notarization hook called by electron-builder after code signing.
 *
 * Runs ONLY when all required env vars are present:
 *   APPLE_ID                 — your Apple ID email
 *   APPLE_APP_SPECIFIC_PASSWORD — app-specific password (appleid.apple.com)
 *   APPLE_TEAM_ID            — 10-char team identifier
 *
 * Without those it's a no-op (so unsigned dev builds still work).
 *
 * Requires: npm install --save-dev @electron/notarize
 */
'use strict';

const { existsSync } = require('fs');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir, packager } = context;
  if (electronPlatformName !== 'darwin') return;

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.log('  • notarize skipped (set APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD + APPLE_TEAM_ID to enable)');
    return;
  }

  let notarize;
  try {
    ({ notarize } = require('@electron/notarize'));
  } catch {
    console.log('  • notarize skipped: @electron/notarize not installed (npm i -D @electron/notarize)');
    return;
  }

  const appName = packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);
  if (!existsSync(appPath)) {
    console.log(`  • notarize skipped: ${appPath} not found`);
    return;
  }

  console.log(`  • notarizing ${appPath}`);
  await notarize({
    tool: 'notarytool',
    appBundleId: 'com.mizan.pos',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });
  console.log('  • notarize complete');
};
