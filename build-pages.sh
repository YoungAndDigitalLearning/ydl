#!/usr/bin/env bash
# Build the offline pages demo with the legacy Node runtime already in Docker.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f "ydl-front/build/build.js" ]; then
  echo "Run this script from the main ydl repository (with the ydl-front submodule)." >&2
  exit 1
fi

mkdir -p ydl-front/docs

docker compose build frontend

docker compose run --rm --no-deps \
  -e YDL_BUILD_TARGET=pages \
  -v "$PWD/ydl-front/docs:/app/docs" \
  frontend node build/build.js

if [ ! -f ydl-front/docs/index.html ]; then
  echo "Expected ydl-front/docs/index.html, but the build did not produce it." >&2
  exit 1
fi

echo "Offline build written to ydl-front/docs/"
echo "Test without Django: python3 -m http.server 4173 --directory ydl-front/docs"
echo "After testing, copy docs/ contents into ../younganddigitallearning.github.io/"
