#!/usr/bin/env bash
# Prepare a flat publish bundle for Netlify in ./dist (relative to build cwd).
set -euo pipefail

SRC=""
if [[ -f "CascadeProjects/Summer_Goals/index.html" ]]; then
  SRC="CascadeProjects/Summer_Goals"
elif [[ -f "index.html" && -d "js" ]]; then
  SRC="."
else
  echo "ERROR: Could not locate Summer Goals app files." >&2
  exit 1
fi

rm -rf dist
mkdir -p dist

(
  cd "$SRC"
  tar -cf - \
    --exclude=node_modules \
    --exclude=dist \
    --exclude=.git \
    --exclude=package-lock.json \
    .
) | tar -xf - -C dist

# App netlify.toml is build config only — do not publish it with the site.
rm -f dist/netlify.toml

echo "Prepared Netlify publish bundle from: ${SRC}"
echo "Files: $(find dist -type f | wc -l)"
