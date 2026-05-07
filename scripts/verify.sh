#!/usr/bin/env bash
# End-to-end verification for the POS backend.
#
# Runs typecheck, unit tests, integration tests, and the smoke scenario.
# Everything runs through Electron's embedded Node so the native SQLite
# module only needs to be compiled once for Electron's ABI. (argon2 is
# @node-rs/argon2 which ships abi-neutral prebuilds — no rebuild needed.)
# After this script finishes you can run `npm run dev` directly — no rebuild
# needed.
#
# Usage:   npm run verify
#
# Exits non-zero on the first failure.

set -euo pipefail

cd "$(dirname "$0")/.."

YELLOW="\033[1;33m"
GREEN="\033[1;32m"
RED="\033[1;31m"
RESET="\033[0m"

section() { echo -e "\n${YELLOW}▶ $1${RESET}"; }
ok()      { echo -e "${GREEN}  ✓ $1${RESET}"; }
die()     { echo -e "${RED}  ✗ $1${RESET}"; exit 1; }

section "Ensure native modules match Electron's ABI"
./node_modules/.bin/electron-rebuild -f > /tmp/pos-rebuild.log 2>&1 || {
  cat /tmp/pos-rebuild.log
  die "electron-rebuild failed"
}
ok "native modules rebuilt for Electron"

section "TypeScript typecheck"
npm run --silent typecheck || die "typecheck failed"
ok "typecheck passed"

section "Unit + integration tests (Vitest via Electron)"
npm run --silent test || die "tests failed"
ok "tests passed"

section "Smoke scenario (full retail day via services layer)"
npm run --silent smoke || die "smoke test failed"
ok "smoke test passed"

echo -e "\n${GREEN}✓ All checks passed — ready to run 'npm run dev'${RESET}"
