#!/bin/bash
# Orchestrator-only offscreen renders; no app window is opened.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:?usage: render_tier_shots.sh <outdir>}"
mkdir -p "$out" "$root/build"
out="$(cd "$out" && pwd)"
sdk="$(xcrun --sdk macosx --show-sdk-path)"
swiftc -target arm64-apple-macos26.0 -sdk "$sdk" -parse-as-library -D DEBUG -D PARITY_SHOTS \
  -framework SwiftUI -framework AppKit -framework UniformTypeIdentifiers \
  -o "$root/build/tier-renderer" \
  "$root/Lakshly/Components/Theme.swift" \
  "$root/Lakshly/Components/ThemeDefinitions.swift" \
  "$root/Lakshly/Components/Currencies.gen.swift" \
  "$root/Lakshly/Components/Currency.swift" \
  "$root/Lakshly/Components/Money.swift" \
  "$root/Lakshly/Components/GlassCard.swift" \
  "$root/Lakshly/Components/Layout.swift" \
  "$root/Lakshly/Models/Profile.swift" \
  "$root/Lakshly/Import/BulkImport.swift" \
  "$root/Lakshly/Models/Dataset.swift" \
  "$root/Lakshly/Import/Parsers/Regex.swift" \
  "$root/Lakshly/Import/Parsers/Dates.swift" \
  "$root/Lakshly/Setup/SetupState.swift" \
  "$root/Lakshly/Setup/SetupLinks.swift" \
  "$root/Lakshly/Setup/SourcesCatalog.swift" \
  "$root/Lakshly/Setup/SetupSuggest.swift" \
  "$root/Lakshly/Setup/SetupReducer.swift" \
  "$root/Lakshly/Setup/SetupModel.swift" \
  "$root/Lakshly/Setup/SetupCanvas.swift" \
  "$root/Lakshly/Setup/SetupShots.swift" \
  "$root/Lakshly/Import/BulkImportRunner.swift" \
  "$root/Lakshly/Store/Entitlements.swift" \
  "$root/Lakshly/Store/Entitlements.gen.swift" \
  "$root/Lakshly/Store/TierNudge.swift" \
  "$root/Lakshly/Components/TierIdentity.swift" \
  "$root/Lakshly/Components/ProfileView.swift" \
  "$root/Lakshly/Features/Import/BulkImportView.swift" \
  "$root/Lakshly/Components/TierShots.swift" \
  "$root/scripts/TierShotCLI.swift"

"$root/build/tier-renderer" "$out"
export LAKSHLY_SHOTS_DIR="$out"
xcodebuild -project "$root/Lakshly.xcodeproj" -scheme Lakshly-iOS \
  -destination "${LAKSHLY_SHOTS_DESTINATION:?Set LAKSHLY_SHOTS_DESTINATION to an available iOS simulator}" \
  -derivedDataPath "$root/build/DD" -only-testing:LakshlyTests/TierRenderTests \
  CODE_SIGNING_ALLOWED=NO LAKSHLY_SHOTS_DIR="$out" test
for platform in ios macos; do
  count="$(find "$out" -maxdepth 1 -name "tier-*-$platform-*.png" | wc -l | tr -d ' ')"
  echo "tier shots: $count $platform in $out"
  test "$count" -ge 8
done
