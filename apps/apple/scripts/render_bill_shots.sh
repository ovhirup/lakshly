#!/bin/bash
# Orchestrator-only offscreen bill radar renders. macOS: a CLI that hosts the real screens in a borderless
# window that is never ordered front. iOS: BillRenderTests in the simulator test host.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:?usage: render_bill_shots.sh <outdir>}"
mkdir -p "$out" "$root/build/bill-renderer/home"
out="$(cd "$out" && pwd)"
sdk="$(xcrun --sdk macosx --show-sdk-path)"
files=()
while IFS= read -r -d '' f; do files+=("$f"); done < <(find "$root/Lakshly" -name '*.swift' ! -path '*/App/LakshlyApp.swift' -print0)
swiftc -target arm64-apple-macos26.0 -sdk "$sdk" -parse-as-library -D DEBUG -swift-version 5 \
  -module-name Lakshly -o "$root/build/bill-renderer/bill-renderer" "${files[@]}" "$root/scripts/BillShotCLI.swift"
cp "$root/../../demo-data/sample.synthetic.json" "$root/build/bill-renderer/"
CFFIXED_USER_HOME="$root/build/bill-renderer/home" "$root/build/bill-renderer/bill-renderer" "$out"
if [[ -n "${LAKSHLY_SHOTS_DESTINATION:-}" ]]; then
  xcodebuild -project "$root/Lakshly.xcodeproj" -scheme Lakshly-iOS -destination "$LAKSHLY_SHOTS_DESTINATION" \
    -derivedDataPath "$root/build/DD" -only-testing:LakshlyTests/BillRenderTests \
    CODE_SIGNING_ALLOWED=NO LAKSHLY_SHOTS_DIR="$out" test
fi
ls "$out"/bills-*.png | wc -l
