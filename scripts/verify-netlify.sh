#!/usr/bin/env bash
# Local preflight for Netlify — run this before pushing deploy fixes.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Running Netlify prepare script"
bash scripts/prepare-netlify.sh

echo "==> Verifying publish bundle"
test -f dist/index.html || { echo "MISSING dist/index.html"; exit 1; }
test -f dist/js/main.js || { echo "MISSING dist/js/main.js"; exit 1; }
test -f dist/css/main.css || { echo "MISSING dist/css/main.css"; exit 1; }
test -f dist/config.js || { echo "MISSING dist/config.js"; exit 1; }
test -d dist/partials || { echo "MISSING dist/partials/"; exit 1; }
test -f dist/partials/dashboard.html || { echo "MISSING dist/partials/dashboard.html"; exit 1; }
test -f dist/assets/beach-illustration.png || { echo "MISSING dist/assets/beach-illustration.png"; exit 1; }

# Simulate from UI base directory (Netlify sometimes runs builds there)
echo "==> Simulating UI base directory = CascadeProjects/Summer_Goals"
(
  cd CascadeProjects/Summer_Goals
  rm -rf dist
  bash ../../scripts/prepare-netlify.sh
  test -f dist/index.html
  test -f dist/js/main.js
  test ! -d dist/node_modules
)

# Ensure published HTML references assets that exist in the bundle
grep -q 'css/main.css' dist/index.html
grep -q 'js/main.js' dist/index.html

echo "==> All Netlify preflight checks passed"
