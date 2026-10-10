#!/bin/bash
set -euo pipefail

apple_dir="$(cd "$(dirname "$0")/.." && pwd)"
derived_data="$apple_dir/build/ReleaseCheck"
extra_file="$(mktemp)"
strings_file="$(mktemp)"
trap 'rm -f "$extra_file" "$strings_file"' EXIT

# Narrow exception: only explicit feedback taps may use HTTP, in FeedbackTransport.swift,
# to the fixed feedback relay. StoreKit retains its entitlement/subscription networking.
source_hits="$(mktemp)"
trap 'rm -f "$extra_file" "$strings_file" "$source_hits"' EXIT
python3 - "$apple_dir" <<'CHECK'
import pathlib, plistlib, re, sys
root = pathlib.Path(sys.argv[1])
transport = root / "Lakshly/Features/Feedback/FeedbackTransport.swift"
for path in (root / "Lakshly").rglob("*.swift"):
    text = path.read_text()
    forbidden = r"NWConnection|import Network|WKWebView|StoreKitTest|SKTestSession"
    if re.search(forbidden, text) or (path != transport and re.search(r"URLSession|URLRequest", text)):
        sys.exit(f"FAIL: forbidden network/test API in {path}")
text = transport.read_text()
urls = re.findall(r'https://[^"\s]+', text)
if urls != ["https://feedback.lakshly.com"] or "http://" in text:
    sys.exit("FAIL: feedback transport must contain exactly the approved HTTPS literal")
for path in list((root / "Lakshly/Resources").glob("*.entitlements")) + list((root / "LakshlyWidgets").glob("*.entitlements")):
    values = plistlib.loads(path.read_bytes())
    if "com.apple.security.network.server" in values:
        sys.exit(f"FAIL: network.server entitlement in {path}")
    if path != root / "Lakshly/Resources/Lakshly.entitlements" and "com.apple.security.network.client" in values:
        sys.exit(f"FAIL: network.client entitlement outside macOS app in {path}")
CHECK
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
    if grep -nE 'demoUnlocked|showLock|startTab|openSettings|importDemo|importDemoFile|showPaywall|feedbackDemo|appIconDemo|settingsScroll|dataSource|setupDemo|setupConsent' "$strings_file"; then
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
  if find "$app_path" \( -name 'state.midway.json' -o -name 'dataset.after-import.json' \) -print | grep -q .; then
    echo "FAIL: setup screenshot fixtures bundled in Release: $app_path" >&2
    find "$app_path" \( -name 'state.midway.json' -o -name 'dataset.after-import.json' \) -print >&2
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
  if grep -nE 'demoUnlocked|showLock|startTab|openSettings|importDemo|importDemoFile|showPaywall|feedbackDemo|appIconDemo|settingsScroll|dataSource|setupDemo|setupConsent' "$strings_file"; then
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

echo 'PASS: Release binaries contain no DEBUG launch controls, synthetic statement PDFs, StoreKit test configuration, or SKTestSession. Both apps embed LakshlyWidgets.appex. iOS supports Live Activities and macOS does not. Network APIs are confined to the approved feedback transport/host and StoreKit; app-only client entitlement checked.'
