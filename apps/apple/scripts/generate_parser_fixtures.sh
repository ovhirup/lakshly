#!/bin/sh
# Regenerates LakshlyTests/Fixtures/Parsers from the web parsers in packages/parsers.
# Works on a temporary copy so packages/parsers is never modified. Fixtures are SYNTHETIC only.
set -eu
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../../.." && pwd)
out="$here/../LakshlyTests/Fixtures/Parsers"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/packages"
rsync -a --exclude node_modules --exclude tests/fixtures/out "$repo/packages/parsers" "$repo/packages/schema" "$tmp/packages/"
cp "$here/parser_fixtures/gen.ts" "$tmp/packages/parsers/gen.ts"
(cd "$tmp/packages/parsers" && npm ci --silent --no-audit --no-fund)
rm -rf "$out" && mkdir -p "$out"
(cd "$tmp/packages/parsers" && node --experimental-strip-types gen.ts "$out")
