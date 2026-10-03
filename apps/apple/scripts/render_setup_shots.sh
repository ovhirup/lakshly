#!/bin/bash
# Headless setup-wizard shots. Does not open a window, Dock icon, or the app.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
repo="$(cd "$root/../.." && pwd)"
out="${1:-/tmp/setupshots-test}"
catalog="$repo/packages/shared/setup/sources.catalog.json"
state="$repo/packages/shared/setup/__fixtures__/state.midway.json"
dataset="$repo/packages/shared/setup/__fixtures__/dataset.after-import.json"
mkdir -p "$out" "$root/build"
sdk="$(xcrun --sdk macosx --show-sdk-path)"

swiftc -target arm64-apple-macos26.0 -sdk "$sdk" -parse-as-library -D DEBUG \
  -framework SwiftUI -framework AppKit -framework UniformTypeIdentifiers \
  -o "$root/build/setup-renderer" \
  "$root/Lakshly/Components/Theme.swift" \
  "$root/Lakshly/Components/ThemeDefinitions.swift" \
  "$root/Lakshly/Components/Money.swift" \
  "$root/Lakshly/Components/GlassCard.swift" \
  "$root/Lakshly/Components/Layout.swift" \
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
  "$root/scripts/SetupShotCLI.swift"

"$root/build/setup-renderer" "$out" "$catalog" "$state" "$dataset"

export LAKSHLY_SHOTS_DIR="$out"
xcodebuild -project "$root/Lakshly.xcodeproj" -scheme Lakshly-iOS \
  -destination 'id=651D77E0-A7D5-4AE7-BCEB-82B0718316BA' \
  -derivedDataPath "$root/build/DD" \
  -only-testing:LakshlyTests/SetupRenderTests \
  CODE_SIGNING_ALLOWED=NO \
  LAKSHLY_SHOTS_DIR="$out" \
  test

ios_count="$(find "$out" -name 'ios-*.png' | wc -l | tr -d ' ')"
mac_count="$(find "$out" -name 'macos-*.png' | wc -l | tr -d ' ')"
echo "setup shots: $ios_count ios, $mac_count macos in $out"
test "$ios_count" -ge 16
test "$mac_count" -ge 16
