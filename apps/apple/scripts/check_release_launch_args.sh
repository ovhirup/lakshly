#!/bin/bash
set -euo pipefail

apple_dir="$(cd "$(dirname "$0")/.." && pwd)"
derived_data="$apple_dir/build/ReleaseCheck"
extra_file="$(mktemp)"
strings_file="$(mktemp)"
trap 'rm -f "$extra_file" "$strings_file"' EXIT

# StoreKit is the only network-capable framework in the app sources.
source_hits="$(mktemp)"
trap 'rm -f "$extra_file" "$strings_file" "$source_hits"' EXIT
if grep -R -n -E 'URLSession|URLRequest|NWConnection|import Network|WKWebView|import StoreKitTest|SKTestSession' \
  "$apple_dir/Lakshly" --include='*.swift' > "$source_hits"; then
  echo "FAIL: app sources use a network API other than StoreKit" >&2
  cat "$source_hits" >&2
  exit 1
fi
if ! grep -R -q -E 'import StoreKit$' "$apple_dir/Lakshly" --include='*.swift'; then
  echo "FAIL: app sources do not import StoreKit" >&2
  exit 1
fi
if grep -R -n -E 'settings\.premium([^A-Za-z0-9_]|$)' "$apple_dir/Lakshly" --include='*.swift' | grep -v 'SettingsPreferences.swift'; then
  echo "FAIL: settings.premium is still read outside the startup scrub" >&2
  exit 1
fi

# Shell-style quoting supports flags containing spaces without executing shell code.
python3 -c 'import os, shlex, sys; sys.stdout.buffer.write(b"".join(arg.encode() + b"\0" for arg in shlex.split(os.environ.get("XCODEBUILD_EXTRA", ""))))' > "$extra_file"
extra=()
while IFS= read -r -d '' flag; do extra+=("$flag"); done < "$extra_file"

for platform in macOS iOS; do
  if [[ "$platform" == macOS ]]; then
    destination='generic/platform=macOS'
  else
    destination='generic/platform=iOS Simulator'
  fi
  xcodebuild -project "$apple_dir/Lakshly.xcodeproj" -scheme "Lakshly-$platform" \
    -configuration Release -destination "$destination" -derivedDataPath "$derived_data" \
    -disableAutomaticPackageResolution -skipPackageUpdates \
    CODE_SIGNING_ALLOWED=NO ${extra[@]+"${extra[@]}"} build
done

for binary in \
  "$derived_data/Build/Products/Release/Lakshly.app/Contents/MacOS/Lakshly" \
  "$derived_data/Build/Products/Release-iphonesimulator/Lakshly.app/Lakshly"; do
  if [[ ! -f "$binary" ]]; then
    echo "FAIL: missing Release binary: $binary" >&2
    exit 1
  fi
  app_path="${binary%%.app/*}.app"
  binaries=("$binary")
  while IFS= read -r -d '' dylib; do binaries+=("$dylib"); done < <(find "$app_path" -type f -name '*.debug.dylib' -print0)
  for executable in "${binaries[@]}"; do
    /usr/bin/strings -a "$executable" > "$strings_file"
    if grep -nE 'demoUnlocked|showLock|startTab|openSettings|importDemo|importDemoFile|showPaywall|feedbackDemo|appIconDemo|settingsScroll|dataSource' "$strings_file"; then
      echo "FAIL: DEBUG launch controls found in $executable" >&2
      exit 1
    fi
    if grep -n 'SKTestSession' "$strings_file"; then
      echo "FAIL: SKTestSession referenced by Release binary $executable" >&2
      exit 1
    fi
  done
  if find "$app_path" \( -name '*.storekit' -o -name 'StoreKitTest*' -o -name 'StoreKitTest.framework' \) -print | grep -q .; then
    echo "FAIL: StoreKit test configuration or StoreKitTest shipped in Release: $app_path" >&2
    find "$app_path" \( -name '*.storekit' -o -name 'StoreKitTest*' -o -name 'StoreKitTest.framework' \) -print >&2
    exit 1
  fi
  if find "$app_path" -name '*.synthetic.pdf' -print | grep -q .; then
    echo "FAIL: synthetic statement PDF bundled in Release: $app_path" >&2
    find "$app_path" -name '*.synthetic.pdf' -print >&2
    exit 1
  fi
  appex="$(find "$app_path" -type d -path '*/PlugIns/LakshlyWidgets.appex' -print -quit)"
  if [[ -z "$appex" ]]; then
    echo "FAIL: Release app is missing PlugIns/LakshlyWidgets.appex: $app_path" >&2
    exit 1
  fi
  if [[ "$binary" == *MacOS/Lakshly ]]; then
    appex_binary="$appex/Contents/MacOS/LakshlyWidgets"
    info_plist="$app_path/Contents/Info.plist"
    if /usr/libexec/PlistBuddy -c 'Print :NSSupportsLiveActivities' "$info_plist" >/dev/null 2>&1; then
      echo "FAIL: macOS Release Info.plist must not contain NSSupportsLiveActivities" >&2
      exit 1
    fi
  else
    appex_binary="$appex/LakshlyWidgets"
    info_plist="$app_path/Info.plist"
    live="$(/usr/libexec/PlistBuddy -c 'Print :NSSupportsLiveActivities' "$info_plist" 2>/dev/null || true)"
    if [[ "$live" != "true" ]]; then
      echo "FAIL: iOS Release Info.plist missing NSSupportsLiveActivities=true (got '${live}')" >&2
      exit 1
    fi
  fi
  if [[ ! -f "$appex_binary" ]]; then
    echo "FAIL: missing widget extension binary: $appex_binary" >&2
    exit 1
  fi
  /usr/bin/strings -a "$appex_binary" > "$strings_file"
  if grep -nE 'demoUnlocked|showLock|startTab|openSettings|importDemo|importDemoFile|showPaywall|feedbackDemo|appIconDemo|settingsScroll|dataSource' "$strings_file"; then
    echo "FAIL: DEBUG launch controls found in $appex_binary" >&2
    exit 1
  fi
  if grep -n 'SKTestSession' "$strings_file"; then
    echo "FAIL: SKTestSession referenced by Release widget $appex_binary" >&2
    exit 1
  fi
  if find "$appex" -name '*.synthetic.pdf' -print | grep -q .; then
    echo "FAIL: synthetic statement PDF bundled in widget extension: $appex" >&2
    exit 1
  fi
done

echo 'PASS: Release binaries contain no DEBUG launch controls, synthetic statement PDFs, StoreKit test configuration, or SKTestSession. Both apps embed LakshlyWidgets.appex. iOS supports Live Activities and macOS does not. App sources use StoreKit as the only network framework.'
