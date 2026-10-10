#!/bin/bash
# Offscreen parity rendering. Run only by the orchestrator; no app window is opened.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$root/../.." && pwd)"
out="${1:?usage: render_parity_shots.sh <outdir>}"
catalog="$repo/packages/shared/setup/sources.catalog.json"
dataset="$repo/packages/shared/setup/__fixtures__/dataset.after-import.json"
mkdir -p "$out" "$root/build"
sdk="$(xcrun --sdk macosx --show-sdk-path)"

swiftc -target arm64-apple-macos26.0 -sdk "$sdk" -parse-as-library -D DEBUG -D PARITY_SHOTS \
  -framework SwiftUI -framework AppKit -framework UniformTypeIdentifiers \
  -o "$root/build/parity-renderer" \
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
  "$root/Lakshly/Components/ProfileView.swift" \
  "$root/Lakshly/Features/Import/BulkImportView.swift" \
  "$root/Lakshly/Setup/ParityShots.swift" \
  "$root/scripts/ParityShotCLI.swift"

"$root/build/parity-renderer" "$out" "$catalog" "$dataset"

export LAKSHLY_SHOTS_DIR="$out"
xcodebuild -project "$root/Lakshly.xcodeproj" -scheme Lakshly-iOS \
  -destination "${LAKSHLY_SHOTS_DESTINATION:-platform=iOS Simulator,name=iPhone 17}" \
  -derivedDataPath "$root/build/DD" \
  -only-testing:LakshlyTests/ParityRenderTests \
  CODE_SIGNING_ALLOWED=NO \
  LAKSHLY_SHOTS_DIR="$out" \
  test

ios_count="$(find "$out/name" "$out/gmail-tidy" -name '*-ios-*.png' | wc -l | tr -d ' ')"
mac_count="$(find "$out/name" "$out/gmail-tidy" -name '*-macos-*.png' | wc -l | tr -d ' ')"
echo "parity shots: $ios_count ios, $mac_count macos in $out"
test "$ios_count" -ge 22
test "$mac_count" -ge 22
