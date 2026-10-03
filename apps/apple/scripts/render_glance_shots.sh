#!/bin/bash
# Headless DEBUG renderer for Mac widgets and the menu-bar glance. Does not open a window or Dock icon.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$root/build/glance-shots}"
dataset="${2:-$root/../../demo-data/sample.synthetic.json}"
mkdir -p "$out" "$root/build"
sdk="$(xcrun --sdk macosx --show-sdk-path)"

swiftc -target arm64-apple-macos26.0 -sdk "$sdk" -parse-as-library -D DEBUG \
  -framework SwiftUI -framework AppKit \
  -o "$root/build/glance-renderer" \
  "$root/Lakshly/Components/Theme.swift" \
  "$root/Lakshly/Components/ThemeDefinitions.swift" \
  "$root/Lakshly/Components/Money.swift" \
  "$root/Lakshly/Models/Dataset.swift" \
  "$root/Lakshly/Store/Entitlements.swift" \
  "$root/Lakshly/Glance/GlanceSnapshot.swift" \
  "$root/Lakshly/Glance/GlanceBuilder.swift" \
  "$root/Lakshly/Glance/GlanceStore.swift" \
  "$root/Lakshly/Glance/GlanceLinks.swift" \
  "$root/Lakshly/Glance/GlanceViews.swift" \
  "$root/Lakshly/Glance/LiveActivityViews.swift" \
  "$root/Lakshly/Glance/GlanceShots.swift" \
  "$root/scripts/GlanceShotCLI.swift"

"$root/build/glance-renderer" "$out" "$dataset"
