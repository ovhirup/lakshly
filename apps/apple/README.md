# Lakshly for Apple

Native SwiftUI MVP for iOS 26 and macOS 26, using Liquid Glass and Swift Charts. App code is AGPL-3.0-or-later. All bundled finances and community contributors are synthetic.

Requires Xcode 27 (or a compatible toolchain with iOS/macOS 26 APIs) and XcodeGen 2.46+:

```sh
brew install xcodegen
cd apps/apple
xcodegen generate
```

Open `Lakshly.xcodeproj`. Schemes: **Lakshly-iOS** and **Lakshly-macOS**. Deployment targets are 26.0; signing team is empty. The sample resource references `../../demo-data/sample.synthetic.json` directly, so regenerating/building uses the repository's current sample.

```sh
xcodebuild -project Lakshly.xcodeproj -scheme Lakshly-iOS -destination 'platform=iOS Simulator,id=<simulator-id>' -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
xcodebuild -project Lakshly.xcodeproj -scheme Lakshly-macOS -destination 'platform=macOS' -derivedDataPath build/DerivedData CODE_SIGNING_ALLOWED=NO build
```

On iPhone, the tab bar shows **Overview, Spend, Budget, Feedback, More**. More contains Debt, Credit, Investments, Rewards and History. The adaptive iPad/macOS sidebar exposes all nine pages. Overview also links directly to Feedback & Requests.

## Launch arguments

Screenshot launch arguments (Xcode scheme → Run → Arguments) are **DEBUG-only**, parsed by `LaunchOptions` directly from process arguments, and compiled out of Release. `-demoUnlocked YES` skips authentication in DEBUG; `-startTab overview|spend|budget|debt|credit|investments|rewards|history|feedback` chooses the tab; `-showLock YES` takes precedence and keeps the lock visible. `-appearance system|light|dark` overrides the root and Settings color schemes; `-theme <id>` overrides the initial theme; `-openSettings YES` opens Settings at launch. These overrides do not persist. Settings provides theme and appearance selection, app lock, demo reset and **Preview Premium (demo — no purchases)**. Free/Premium is UI-only; there is no StoreKit or payment flow.

After `xcodegen generate`, run `scripts/check_release_launch_args.sh`. It builds unsigned Release apps for macOS and iOS Simulator into `build/ReleaseCheck`, scans both executables and any `.debug.dylib` for the four DEBUG control names, and prints `PASS` only when none are present. Extra build flags can be supplied through `XCODEBUILD_EXTRA`, using shell-style quotes for flags containing spaces. If the restricted macro sandbox blocks a build, the temporary command-line workaround is:

```sh
XCODEBUILD_EXTRA="OTHER_SWIFT_FLAGS='\$(inherited) -disable-sandbox'" scripts/check_release_launch_args.sh
```

## Security

The first launch decodes the bundled dataset, seeds synthetic feedback, and persists both to Application Support as an authenticated AES-GCM sealed box with a random 256-bit key. Keychain items use `WhenUnlockedThisDeviceOnly`. On supported hardware a Secure Enclave P-256 key agrees with a disposable peer, then HKDF-SHA256 derives an AES wrapping key; the opaque enclave key representation, peer public key and wrapped data key are stored together in Keychain. The peer private key is discarded. Otherwise the data key resides directly in Keychain. No plaintext finance file is written.

If Keychain/Enclave access fails in unsigned builds or the simulator, a temporary memory key is used, Settings shows **Encryption key not persisted (dev build)**, and edits/feedback last only for that process. Existing encrypted files are preserved. A decryption failure shows demo data and blocks saving until an explicit reset. Reset replaces finances and feedback, retaining the encryption key. LocalAuthentication uses device-owner authentication with passcode fallback. **Continue (demo mode)** is offered only when `canEvaluatePolicy(.deviceOwnerAuthentication)` returns `LAError.passcodeNotSet`, meaning the device has no passcode/password to bypass. The action rechecks that condition. Biometry lockout, unavailable or unenrolled biometry, noninteractive authentication and unknown failures keep the app locked and offer **Try again**; unlocking otherwise requires a successful `evaluatePolicy`. Turning **App lock** off also requires successful device authentication when available, and fails closed on other errors; only a device with no passcode/password can turn it off without authentication. Background/inactive transitions cover finances and dismiss Settings; authentication prompts do not trigger a second lock.

Before any app state or `@AppStorage` is constructed, startup clears the UserDefaults argument domain in Release and DEBUG. Launch arguments cannot override persisted settings, including `-appLock NO`, `-premium YES` or namespaced keys. Persisted keys are `settings.appLock`, `settings.premium`, `settings.themeID` and `settings.appearance`; startup migrates existing persistent legacy values once, preserves existing new values and removes old keys. DEBUG screenshot controls use only `LaunchOptions`.

**No app networking:** no URLSession, analytics, bank connections or network entitlement. Feedback is local; the optional GitHub Issues link is opened by the OS browser only. Nothing is submitted automatically.

`LakshlyTests` covers Indian money grouping and authenticated encryption including tamper/wrong-key rejection, plus DEBUG launch parsing, the no-passcode demo policy and preference migration/argument-domain isolation. Run through the iOS scheme's Test action. In the restricted agent sandbox, both generic iOS Simulator and macOS builds pass with the temporary CLI override `OTHER_SWIFT_FLAGS='$(inherited) -disable-sandbox'`; Swift macro plugin sandbox nesting otherwise fails. The specific simulator destination and XCTest execution require CoreSimulator access outside that sandbox. The override is not part of project settings.

MVP limitations: AppIcon is a placeholder; budget rollover is annotated, not carried forward; projections are illustrative with fixed rates and no taxes/fees; Premium planner is an explanatory preview. Device authentication, Keychain/Enclave persistence and responsive visual layout still need hands-on simulator/device QA.

## Themes

`../../docs/themes.json` is the canonical manifest (`schemaVersion: 1`). All themes support light and dark appearances. Swift definitions mirror it in generated `ThemeDefinitions.swift`; the bundled manifest equality test checks every token, category, ambient value and UI flag. UI colors come from `@Environment(\.theme)` and update instantly. `settings.themeID` defaults to `lakshmi`; `settings.appearance` independently stores `system`, `light` or `dark`.

| Theme | Access | Character |
| --- | --- | --- |
| Lakshmi (`lakshmi`) | Free | Indigo, gold and lotus. Your original Lakshly. |
| Monochrome Gold (`monochromeGold`) | Free | Quiet neutrals, clear glass and a single gold hue. |
| Graphite (`graphite`) | Free | Apple greys with a crisp blue accent. |
| Ocean (`ocean`) | Premium | Deep navy with tidal teal and warm light. |
| Forest (`forest`) | Premium | Deep evergreen and soft sand accents. |
| Rose Quartz (`roseQuartz`) | Premium | Blush ivory and plum, softened with rose. |

Premium is a UI-only demo. Locked cards open an upsell; **Preview Premium (demo)** enables the existing `settings.premium` toggle and applies that theme. There is no StoreKit or purchase code. Turning the preview off locks future premium selections; the current theme remains selected.

In DEBUG, launch with `-theme <id>` to override the initial stored theme, including Premium themes without enabling Premium. The override lasts until a theme is selected in Settings and does not write the screenshot theme to preferences. `-openSettings YES` opens Settings at launch with Theme first. Use `-demoUnlocked YES -openSettings YES -theme ocean -appearance dark` for a screenshot. `-appearance system|light|dark` is also a DEBUG-only `LaunchOptions` override; remove the argument for ordinary Settings persistence.

Monochrome Gold has clear, untinted glass, no ambient glow, more padding and money direction icons (`arrow.down.left`, `arrow.up.right`, `chart.line.uptrend`). Its gold is the only decorative hue; danger/success retain muted semantic red/green. Groceries and Dining use gold and a gold tint; other chart marks use a grey lightness ramp with subtle warm/cool offsets. Dark mode uses light-to-mid greys, light mode dark-to-mid greys. The Spend donut has thin slice separators, and its total's direction icon is vertically centered at half the large-title size, scaling with Dynamic Type. Five colorful themes use a shared categorical palette with stable identities and labeled legends. Groceries is green and EMI is purple. Category colors are marks, not text.

`python3 scripts/contrast_check.py` prints every theme/mode/token against both background and surface. Text-bearing tokens meet 4.5:1 and lotus meets 3:1. Every category in every theme/mode must also meet WCAG 1.4.11 non-text contrast ≥3:1 against `surface`, where the donut sits; a failure exits non-zero. It also checks demo capsule/lock text and CIE76 Lab category separation for groceries, rent, dining, emi, investments, health, shopping, transport and utilities. Every pair must have ΔE ≥15; groceries/emi ≥25. Monochrome Gold retains ΔE ≥10 for **all pairs** and ≥25 for groceries/emi: even with two gold slices, seven neutral shades cannot fit ≥15 apart in the contrast-safe lightness span (about 59 in light mode and 58 in dark mode). Small warm/cool offsets let the grey ramp satisfy ≥10 without weakening that rule. Labeled legends supplement color. Contrast checks use solid tokens; rendered glass and accessibility still warrant device QA.

To add a theme:

1. Add an entry to `../../docs/themes.json` with a unique ID, metadata, flags, both modes, all tokens, all 21 schema category keys, and ambient colors/opacities. Use uppercase `#RRGGBB` hex values.
2. Add its case to `ThemeID`, then run `python3 scripts/generate_themes.py`. Never hand-edit generated definitions.
3. Run the contrast script, regenerate the XcodeGen project, build both schemes and run the iOS tests. Theme cards are generated from `ThemeID.allCases`.

`AccentColor` is the Lakshmi launch-time system fallback; all live UI tint is supplied by the environment palette. No other color assets remain.

Token values below are light / dark. Ambient opacities are light / dark.

### Lakshmi — Free

Lakshmi text-bearing tokens match the web app's `docs/design-tokens.md` (`--lk-surface`, `--lk-text`, `--lk-text-muted`, `--lk-gold-text` → `gold`, `--lk-income`, `--lk-spend`, `--lk-invest`, `--lk-danger`, `--lk-success`). Native `lotus` keeps a darker light-mode value (#C24D72) because it is used for the Priority badge text; the web `--lk-lotus` (#E8789A) is decorative only.

| Token | Light hex | Dark hex |
| --- | --- | --- |
| bg | #FBF8F1 | #0E1430 |
| surface | #F5F4F9 | #1A2344 |
| gold | #765510 | #E9BF62 |
| lotus | #C24D72 | #E8789A |
| income | #087852 | #63D4AA |
| spend | #AB443E | #F6ADA4 |
| invest | #087B80 | #6CCED2 |
| danger | #B52D45 | #FF9AAC |
| success | #087852 | #63D4AA |
| secondaryText | #59617A | #B5BFD8 |
| lockBackground | #151E40 | #0E1430 |
| lockGold | #E8BC5A | #D9A93F |
| text | #19213E | #F3F4FC |
| ambient primary | #6772B4 (0.05) | #6772B4 (0.12) |
| ambient secondary | #896414 (0.025) | #D9A93F (0.05) |

### Monochrome Gold — Free

| Token | Light hex | Dark hex |
| --- | --- | --- |
| bg | #FFFFFF | #000000 |
| surface | #F5F5F5 | #161616 |
| gold | #806000 | #D9AF52 |
| lotus | #806000 | #D9AF52 |
| income | #383838 | #E5E5E5 |
| spend | #595959 | #BDBDBD |
| invest | #6A6A6A | #999999 |
| danger | #875E64 | #D49DA4 |
| success | #45684E | #9DB9A2 |
| text | #111111 | #FFFFFF |
| secondaryText | #595959 | #B8B8B8 |
| lockBackground | #FFFFFF | #000000 |
| lockGold | #806000 | #D9AF52 |
| ambient primary | #000000 (0) | #000000 (0) |
| ambient secondary | #806000 (0) | #D9AF52 (0) |

### Graphite — Free

| Token | Light hex | Dark hex |
| --- | --- | --- |
| bg | #F5F5F7 | #111113 |
| surface | #FFFFFF | #1C1C1E |
| gold | #0066CC | #0A84FF |
| lotus | #0066CC | #0A84FF |
| income | #236542 | #85CEA3 |
| spend | #9C4141 | #EAA39D |
| invest | #365D89 | #90B8EE |
| danger | #A83849 | #EF9FAF |
| success | #236542 | #85CEA3 |
| text | #171719 | #F5F5F7 |
| secondaryText | #59595E | #B8B8BF |
| lockBackground | #F5F5F7 | #111113 |
| lockGold | #0066CC | #0A84FF |
| ambient primary | #6F7D93 (0.05) | #6F7D93 (0.12) |
| ambient secondary | #0066CC (0.025) | #0A84FF (0.05) |

### Ocean — Premium

| Token | Light hex | Dark hex |
| --- | --- | --- |
| bg | #F1F8FA | #081B2B |
| surface | #FFFFFF | #102D3E |
| gold | #176575 | #71CCD5 |
| lotus | #247982 | #76D8C7 |
| income | #18684B | #7CD5AA |
| spend | #A44342 | #F0A092 |
| invest | #245E9A | #8FBCEB |
| danger | #AD344F | #F498AF |
| success | #18684B | #7CD5AA |
| text | #122F43 | #ECF7FA |
| secondaryText | #526473 | #B3C9D3 |
| lockBackground | #F1F8FA | #081B2B |
| lockGold | #176575 | #71CCD5 |
| ambient primary | #159DA8 (0.05) | #159DA8 (0.12) |
| ambient secondary | #176575 (0.025) | #71CCD5 (0.05) |

### Forest — Premium

| Token | Light hex | Dark hex |
| --- | --- | --- |
| bg | #F7F8F0 | #101F18 |
| surface | #FFFFFF | #1C3024 |
| gold | #75602A | #E0C38C |
| lotus | #647742 | #B5CE87 |
| income | #25643B | #85D5A3 |
| spend | #9C4939 | #ECAF9E |
| invest | #2D6271 | #91C7D5 |
| danger | #AC3C46 | #F4A4AA |
| success | #25643B | #85D5A3 |
| text | #1E3023 | #F1F6EC |
| secondaryText | #596357 | #BFCEBC |
| lockBackground | #F7F8F0 | #101F18 |
| lockGold | #75602A | #E0C38C |
| ambient primary | #509965 (0.05) | #509965 (0.12) |
| ambient secondary | #75602A (0.025) | #E0C38C (0.05) |

### Rose Quartz — Premium

| Token | Light hex | Dark hex |
| --- | --- | --- |
| bg | #FCF5F3 | #251323 |
| surface | #FFFFFF | #392035 |
| gold | #7C416E | #E8B4D4 |
| lotus | #AD4C72 | #EB91B6 |
| income | #286746 | #97D3AE |
| spend | #A54153 | #F4A3AD |
| invest | #4E5995 | #B9BAEF |
| danger | #AF354D | #FFA0B6 |
| success | #286746 | #97D3AE |
| text | #382332 | #FCF0F8 |
| secondaryText | #6C5868 | #D2B7CD |
| lockBackground | #FCF5F3 | #251323 |
| lockGold | #7C416E | #E8B4D4 |
| ambient primary | #B66F9E (0.05) | #B66F9E (0.12) |
| ambient secondary | #7C416E (0.025) | #E8B4D4 (0.05) |
