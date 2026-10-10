#!/bin/bash
# Offscreen SwiftUI ImageRenderer only: no windows, app activation or network.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-/tmp/feedbackshots-test}"
mkdir -p "$out" "$root/build"
sdk="$(xcrun --sdk macosx --show-sdk-path)"
swiftc -target arm64-apple-macos26.0 -sdk "$sdk" -parse-as-library -D DEBUG -D FEEDBACK_SHOTS \
  -framework SwiftUI -framework AppKit -framework Security \
  -o "$root/build/feedback-renderer" \
  "$root/Lakshly/Components/Theme.swift" \
  "$root/Lakshly/Components/ThemeDefinitions.swift" \
  "$root/Lakshly/Components/Money.swift" \
  "$root/Lakshly/Components/GlassCard.swift" \
  "$root/Lakshly/Components/Layout.swift" \
  "$root/Lakshly/Store/Entitlements.swift" \
  "$root/Lakshly/Features/Feedback/GitHubIssueLink.swift" \
  "$root/Lakshly/Features/Feedback/FeedbackHelpers.swift" \
  "$root/Lakshly/Features/Feedback/FeedbackTransport.swift" \
  "$root/Lakshly/Features/Feedback/FeedbackRequestStore.swift" \
  "$root/Lakshly/Features/Feedback/FeedbackView.swift" \
  "$root/scripts/FeedbackShotCLI.swift"
"$root/build/feedback-renderer" "$out" "$root/../web/content/roadmap.json"
