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

On iPhone, the tab bar shows **Overview, Spend, Budget, Feedback, More**. More contains Debt, Credit, Investments, Rewards, History and Import. The adaptive iPad/macOS sidebar exposes all ten pages. Overview also links directly to Feedback & Requests. Import reads a statement PDF or CSV with the system file picker, parses it on device, and merges the rows into the encrypted store.

## Launch arguments

Screenshot launch arguments (Xcode scheme → Run → Arguments) are **DEBUG-only**, parsed by `LaunchOptions` directly from process arguments, and compiled out of Release. `-demoUnlocked YES` skips authentication in DEBUG; `-startTab overview|spend|budget|debt|credit|investments|rewards|history|feedback|import` chooses the tab; `-showLock YES` takes precedence and keeps the lock visible. `-appearance system|light|dark` overrides the root and Settings color schemes; `-theme <id>` overrides the initial theme; `-openSettings YES` opens Settings at launch. `-appIconDemo <themeId>` applies an ephemeral app icon for screenshots; `-settingsScroll appIcon` scrolls Settings to the icon picker. Neither grants Premium. `-feedbackDemo YES` prefills Feedback with a synthetic Request title and message for the live preview; combine it with `-startTab feedback -demoUnlocked YES` for screenshots. `-showPaywall YES` presents the general Premium paywall at launch for screenshots. It does not grant Premium. `-importDemo picker|chooser|password|preview|done` opens Import on that stage (`chooser` also presents the system file picker) using the bundled synthetic HDFC bank statement, or the synthetic CAS when `-importDemoFile cas` is also set. `password` uses the locked fixture and waits without a password. `done` runs the import merge and writes it through the encrypted store. These overrides do not persist. `-uiTestingSyntheticData` (bare or `YES`) is a DEBUG hook for Maestro and XCUITest. It saves the bundled synthetic demo as the dataset on screen, leaves imported rows stored, and does not open setup. On Mac it also leaves the menu-bar extra uninserted and does not open the setup window, so the main window can finish launching. Release ignores it. Settings provides theme and appearance selection, app lock, demo reset, and Lakshly Premium status (See Premium and Restore Purchases). Access comes only from a verified StoreKit subscription.

After `xcodegen generate`, run `scripts/check_release_launch_args.sh`. It builds unsigned Release apps for macOS and iOS Simulator into `build/ReleaseCheck`, scans both executables and any `.debug.dylib` for the DEBUG control names (`demoUnlocked`, `showLock`, `startTab`, `openSettings`, `importDemo`, `importDemoFile`, `showPaywall`, `feedbackDemo`, `appIconDemo`, `settingsScroll`, `dataSource`, `setupDemo`, `setupConsent`, `uiTestingSyntheticData`) and for `SKTestSession`, checks that no `*.synthetic.pdf`, `*.storekit`, or StoreKitTest framework was copied into the Release bundles, checks that app sources use StoreKit as the only network-capable framework, and prints `PASS` only when those checks are clean. Extra build flags can be supplied through `XCODEBUILD_EXTRA`, using shell-style quotes for flags containing spaces. If the restricted macro sandbox blocks a build, the temporary command-line workaround is:

```sh
XCODEBUILD_EXTRA="OTHER_SWIFT_FLAGS='\$(inherited) -disable-sandbox'" scripts/check_release_launch_args.sh
```

## Feedback (GitHub issue link)

Choose Feedback, Request or Bug, optionally add a title, and write your message. **Exactly what GitHub will show** previews the title, labels and full decoded body live. **Open GitHub issue** opens the matching issue form in your browser, then records a local copy and clears the fields. Nothing is sent until you review and press Submit on GitHub. Premium adds the `priority` label through `can(.priorityFeedback)`; Free keeps only the kind label. The environment contains exactly app version/build, iOS/iPadOS/macOS version, current theme display name with Light/Dark appearance, and Free/Premium tier. No device model, name, locale or identifiers are included.

[`docs/feedback-issue-link.md`](../../docs/feedback-issue-link.md) defines query order, clipping, fallbacks and strict UTF-8 percent encoding, shared with the web app. `GitHubIssueLinkTests` checks the literal golden URL (identical to the web test), decoded form fields, privacy boundaries, template mappings and entitlement labels.

## Import

Import is an on-device port of `packages/parsers`. PDFKit rebuilds positioned text runs, then the same line grouping, table engine, and adapters produce the web parser's JSON. Specific adapters are CAMS/KFintech CAS, HDFC Bank, SBI, ICICI Bank, HDFC Bank credit card, and SBI Card. A score below 0.6 falls through to the generic bank or card layout. CSV uses the generic bank columns.

A picked file is read through a security-scoped URL into memory and is not copied. The password lives only in the password field while you type it. It is cleared after Unlock or Cancel and is never written to disk, UserDefaults, the Keychain, or logs. Parsing does not use the network.

`LakshlyTests/Fixtures/Parsers` holds the synthetic PDFs, `generic.synthetic.csv`, and golden `expected/*.lines.json`, `expected/*.result.json`, and `expected/merge.json`. `ParserFixtureTests` compares every fixture. Regenerate those goldens with `scripts/generate_parser_fixtures.sh` only when the shared parser behaviour changes; the script runs the web parsers on a temporary copy and does not need a committed change under `packages/`. Debug builds of the app also bundle the HDFC and CAS PDFs (including the locked copies, password `DEMO1234`) for `-importDemo`. Release builds exclude them.

## Security

The first launch decodes the bundled dataset, seeds synthetic feedback, and persists both to Application Support as an authenticated AES-GCM sealed box with a random 256-bit key. Keychain items use `WhenUnlockedThisDeviceOnly`. On supported hardware a Secure Enclave P-256 key agrees with a disposable peer, then HKDF-SHA256 derives an AES wrapping key; the opaque enclave key representation, peer public key and wrapped data key are stored together in Keychain. The peer private key is discarded. Otherwise the data key resides directly in Keychain. No plaintext finance file is written.

If Keychain/Enclave access fails in unsigned builds or the simulator, a temporary memory key is used, Settings shows **Encryption key not persisted (dev build)**, and edits/feedback last only for that process. Existing encrypted files are preserved. A decryption failure shows demo data and blocks saving until an explicit reset. Reset replaces finances and feedback, retaining the encryption key. LocalAuthentication uses device-owner authentication with passcode fallback. **Continue (demo mode)** is offered only when `canEvaluatePolicy(.deviceOwnerAuthentication)` returns `LAError.passcodeNotSet`, meaning the device has no passcode/password to bypass. The action rechecks that condition. Biometry lockout, unavailable or unenrolled biometry, noninteractive authentication and unknown failures keep the app locked and offer **Try again**; unlocking otherwise requires a successful `evaluatePolicy`. Turning **App lock** off also requires successful device authentication when available, and fails closed on other errors; only a device with no passcode/password can turn it off without authentication. Background/inactive transitions cover finances and dismiss Settings; authentication prompts do not trigger a second lock.

Before any app state or `@AppStorage` is constructed, startup clears the UserDefaults argument domain in Release and DEBUG. Launch arguments cannot override persisted settings, including `-appLock NO`, `-premium YES` or namespaced keys. Persisted keys are `settings.appLock`, `settings.themeID`, `settings.appearance` and `settings.appIcon`. Startup migrates existing persistent legacy values once (`appLock`, `premium`, `themeID`, `appearance`), preserves existing new values, removes the old keys, and then deletes `settings.premium`. That retired demo toggle is not a Premium grant. DEBUG screenshot controls use only `LaunchOptions`.

**Networking:** StoreKit is the only network-capable framework. There is no URLSession, analytics, bank connection, or network entitlement. Purchases talk to Apple's App Store (or the local StoreKit test configuration). Terms and Privacy are `Link`s that the OS browser opens. Feedback constructs a prefilled GitHub issue URL locally and hands it to the OS browser. It includes only your typed title/message, app version, platform, theme and tier. You review it and press Submit on GitHub yourself; the app makes no feedback network request. A copy is also recorded in the encrypted local request store. There are no App Store Connect products and no server.

`LakshlyTests` covers Indian money grouping, authenticated encryption including tamper/wrong-key rejection, DEBUG launch parsing (including `-importDemo`, `-showPaywall` and `-feedbackDemo`), the no-passcode demo policy, preference migration/argument-domain isolation, StoreKit products, purchase, restore, expiry, refund, and the entitlements map, plus `ParserFixtureTests` / `ParserUtilTests` for the on-device statement parsers. `LakshlyUITests` drives the paywall and a local yearly purchase for screenshots. `SyntheticSmokeUITests` (iPhone, and `LakshlyMacUITests` on Mac) launches a Debug build with `-demoUnlocked YES -uiTestingSyntheticData YES`, checks Overview is the synthetic demo, and switches to the free Graphite theme. `maestro/smoke.yaml` is the same path for Maestro. Release ignores the launch argument. The GitHub `apple-smoke` workflow generates the synthetic statement PDFs, then runs only that UI test, unsigned, on the iPhone 17 / iOS 26.2 simulator and on macOS. The Mac smoke build defines `LAKSHLY_UI_TESTING`, which omits the menu-bar extra and the setup window. A normal Debug or Release build does not. It does not boot a simulator on a developer Mac. Run through the iOS scheme's Test action. In the restricted agent sandbox, both generic iOS Simulator and macOS builds pass with the temporary CLI override `OTHER_SWIFT_FLAGS='$(inherited) -disable-sandbox'`; Swift macro plugin sandbox nesting otherwise fails. The specific simulator destination and XCTest execution require CoreSimulator access outside that sandbox. The override is not part of project settings.

MVP limitations: budget rollover is annotated, not carried forward; projections are illustrative with fixed rates and no taxes/fees. Device authentication, Keychain/Enclave persistence and responsive visual layout still need hands-on simulator/device QA.

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

## Theme app icons

Theme and app icon choices are independent. Settings → App icon offers all six themes; changing a theme also offers to switch its icon. `settings.appIcon` defaults to `lakshmi`. Ocean, Forest and Rose Quartz use the same Premium gate as themes. Once entitlements resolve to Free, a stored Premium icon falls back to Lakshmi without erasing the choice, so Restore or purchase brings it back.

Regenerate all icon assets from the canonical theme manifest (requires the existing web `sharp` dependency):

```sh
node apps/apple/scripts/generate_theme_icons.mjs
```

Run that command from the repository root. Never edit generated icon assets by hand. Vector sources live in `docs/icons/<themeId>/`; the generator also writes the web favicons and PWA icons. Apple assets live in `Lakshly/Resources/Assets.xcassets`: primary `AppIcon` (Lakshmi), the five iOS `AppIcon-<PascalCase>` alternate sets, `ThemeIcon-<themeId>` picker previews, and `DockIcon-<themeId>` / `DockIcon-<themeId>-Dark` runtime Dock images. Regenerate the project with `xcodegen generate` after adding source files or alternate names.

On iOS, the system changes the Home Screen icon and confirms the change. Every icon includes iOS 18+ light, dark and tinted variants; iOS controls which variant appears. Xcode's iOS alternate-icon build setting produces the built `CFBundleIcons/CFBundleAlternateIcons` entries.

On macOS, only the running app's Dock tile changes, following `NSApp.effectiveAppearance` for light and dark. The Finder / Launchpad icon stays the default Lakshmi icon; macOS has no alternate app icon bundle entries.

For DEBUG screenshots, use `-demoUnlocked YES -openSettings YES -settingsScroll appIcon -appIconDemo ocean -appearance dark`. The icon override is ephemeral, ends when you select an unlocked icon in Settings, and never grants Premium. These two controls are compiled out of Release and covered by `scripts/check_release_launch_args.sh`.

`ThemeAppIconTests` checks mappings, the built iOS alternate-icon list, bundled picker images, theme gating and fallback, and manifest recipe names. Dock appearance changes and iOS confirmation prompts still need device QA.

## Widgets, Live Activity and menu bar

Lakshly writes a privacy-safe `glance.json` after unlock, after import or reset, when the theme or tier changes, and when the app enters the background. Widgets and the Mac menu bar read that file. Optional amounts (net worth, safe-to-spend, the next bill, debt outstanding) are written only when **Show amounts in widgets** is on.

The App Group identifier lives in one build setting, `LAKSHLY_APP_GROUP` (default `group.app.lakshly.shared`). The app and the widget extensions read it at runtime from the Info.plist key `LakshlyAppGroup`. Entitlements use `$(LAKSHLY_APP_GROUP)`. If you sign the apps yourself, change `LAKSHLY_APP_GROUP` to a group your team owns and enable that group on the app and both widget targets. Unsigned builds have no group container: the app stores `glance.json` in Application Support, and the widget extension shows its placeholder until a signed group is available.

| Widget | Families | Tier |
| --- | --- | --- |
| Budget pace | Small, medium. iOS also circular, rectangular and inline. | Free (`basicWidgets`) |
| Upcoming bill | Small, medium. iOS also rectangular and inline. | Free (`basicWidgets`) |
| Net worth | Small, medium. | Premium (`extraWidgets`) |
| Debt | Small, medium. iOS also a circular gauge. | Premium (`extraWidgets`) |

A Free member who adds a Premium widget sees “Lakshly Premium widget — open Lakshly to upgrade”. Lock Screen families hide amounts unless **Show amounts on Lock Screen** is on (it defaults off). Shown amounts are marked privacy-sensitive. Home Screen and desktop widgets follow **Show amounts in widgets** (default on). Widgets use the theme saved in the snapshot and open `lakshly://budget`, `lakshly://overview` or `lakshly://debt`. A link received while the app is locked waits until unlock.

Settings → **Widgets & glance** holds those toggles, plus **Live Activities** on iOS (default on) and **Show in menu bar** on macOS (default on). Live Activities cover a bill due today, or a month whose spending has reached 80% of the budget (once that month). The Mac menu-bar panel shows the glance without amounts. **Reveal amounts** asks for Touch ID or the Mac password, builds an in-memory snapshot, and hides it after 60 seconds, when the panel closes, or when the Mac locks or sleeps. If this Mac has no password, amounts stay hidden.

### Mac notch glance

On a Mac with a notch, **Notch glance** (Premium, `glance.notchPanel` / `can(.notchPanel)`) adds a second surface. It does not replace the menu-bar extra. The toggle defaults off. Hovering the notch for a quarter second, or clicking it, slides a panel down from the top of that screen. The panel shows budget pace, safe-to-spend when the snapshot has it, and the next bill or payout. Net worth is included only with `can(.extraWidgets)`.

Amounts stay off the panel until **Reveal**, which uses the same device-owner check as the menu bar (`GlanceRevealSession`, “Reveal Lakshly amounts”). Revealed values stay in memory. They hide after 30 seconds, and immediately when the panel collapses, the Mac sleeps or locks, Lakshly locks, or you switch Spaces. The panels are borderless and non-activating: showing them does not activate Lakshly. A display with no notch never creates those panels. Settings then says Lakshly is using the menu-bar extra, and the toggle can stay on for when a notched display is attached.

Free members still see **Notch glance**, disabled, with the quiet **✦ Premium** pill. Tapping that row opens the paywall. Losing Premium tears the panels down.

There is no DEBUG launch flag for this. `scripts/check_release_launch_args.sh` does not gain a new name.

iOS glance screenshots render from `LakshlyTests/GlanceRenderTests` when `TEST_RUNNER_LAKSHLY_RENDER_DIR` is set (the test sees `LAKSHLY_RENDER_DIR`). Mac widgets, the menu-bar panel, and the notch panel render offscreen with `scripts/render_glance_shots.sh`, which does not open a window. The output directory is the first argument, or `LAKSHLY_SHOTS_DIR`, or `build/glance-shots/`. Notch files are `notch-hidden-…`, `notch-revealed-…`, `notch-free-locked-…`, `notch-settings-…`, and `notch-settings-nonotch-…` at 2x, for Lakshmi dark and Monochrome Gold light. The seed is the synthetic demo dataset.

## Lakshly Premium (StoreKit 2, local testing)

One auto-renewable subscription group, **Lakshly Premium**. Both products are the same level and Family Sharing is enabled. There is no introductory offer.

| Product ID | Period | India (Debug storefront) | United States |
| --- | --- | --- | --- |
| `app.lakshly.premium.monthly` | P1M | ₹119 | US $4.99 |
| `app.lakshly.premium.yearly` | P1Y | ₹999 | US $39.99 |

`StoreKit/Lakshly.storekit` (storefront IND, locale en_IN) is attached to the **Debug run** action of Lakshly-iOS and Lakshly-macOS. `StoreKit/Lakshly-US.storekit` is the same catalogue with storefront USA and locale en_US, used by a unit test. Neither file is a member of an app target. Both are test-target resources so `SKTestSession(configurationFileNamed:)` can load them. They are never copied into an app bundle. There are no App Store Connect products yet.

`EntitlementsMap.standard` is a plain `[Feature: Tier]` literal. `basicWidgets` (budget pace and upcoming bill) is Free. `extraWidgets` (net worth and debt), `notchPanel` (`glance.notchPanel`, Mac notch glance), and every other feature (`premiumThemes`, `debtPlanner`, `creditInsights`, `investmentInsights`, `rewardsInsights`, `priorityFeedback`) require `.premium`. `can(feature, tier:)` is true only when the tier is at least the mapped minimum. An unknown feature fails closed at Premium. A later board item will add a tier above Premium and generate this map from shared JSON. That is not built here.

`EntitlementStore` listens to `Transaction.updates` and rebuilds the tier from `Transaction.currentEntitlements`. Only verified transactions for these product IDs count. A revocation date, an expiration before now, or `isUpgraded` removes that snapshot. Refund, revoke, and expiry therefore drop the user to Free. If a stored theme is Ocean, Forest, or Rose Quartz and the tier is Free, the effective theme falls back to Lakshmi without rewriting the stored choice. Restore calls `AppStore.sync()` and then refresh, and reports "Premium restored" or "Nothing to restore". The paywall is custom (`Product` APIs, not `SubscriptionStoreView`) and opens only from an explicit tap, or from the DEBUG `-showPaywall` screenshot control.

`LakshlyTests/StoreKitTests` loads both configuration files, buys, restores, expires, and refunds through `SKTestSession`, and checks that `settings.premium` and `-premium YES` cannot grant access. `LakshlyUITests` can write `<dir>/<name>.ready` and wait for `<dir>/<name>.done` when `TEST_RUNNER_LAKSHLY_SHOT_DIR` is set.

**Simulator runtime:** `SKTestSession` cannot save its configuration on iOS 26.3+ simulators (`SKInternalErrorDomain` code 3 / `notEntitled`, Apple FB22237318, still present in 26.5). Run the StoreKit tests on an iOS 26.2 simulator (`xcodebuild -downloadPlatform iOS -buildVersion 26.2`, then `xcrun simctl create "StoreKit 26.2" "iPhone 17 Pro" com.apple.CoreSimulator.SimRuntime.iOS-26-2`). There, every test runs unsigned with `CODE_SIGNING_ALLOWED=NO`. On a 26.3+ runtime, the six session-backed unit tests and the UI purchase flow skip with that reason, and only when the session really cannot serve products. Note that `resetToDefaultState()` turns `disableDialogs` back off, so call it first.

In DEBUG, launch with `-theme <id>` to override the initial stored theme, including Premium themes without enabling Premium. The override lasts until a theme is selected in Settings and does not write the screenshot theme to preferences. `-openSettings YES` opens Settings at launch with Theme first. Use `-demoUnlocked YES -openSettings YES -theme ocean -appearance dark` for a screenshot. `-appearance system|light|dark` is also a DEBUG-only `LaunchOptions` override; remove the argument for ordinary Settings persistence. `-feedbackDemo YES` prefills Feedback with a synthetic Request title and message for the live preview; combine it with `-startTab feedback -demoUnlocked YES` for screenshots. `-showPaywall YES` presents the paywall and does not change the tier.

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

## Feedback & Requests

Free and Premium members can send ideas, bugs and praise. Only the typed kind, title (90 UTF-16 units), details (1000), area, plan, optional credit (40) and reply email (120), and an empty honeypot are sent. Diagnostics default off; opting in adds only app version and platform. The live sorted JSON preview matches the submitted bytes. `X-Lakshly-Client` is `ios` or `macos`; only with diagnostics enabled does it append `/CFBundleShortVersionString`. No balances, datasets, theme, device identifiers or locale go to the relay. No automatic refresh or background retries run.

Request history lives in Application Support JSON. Lookup secrets live only in the Keychain, generic passwords under `app.lakshly.feedback`, account = request id, AfterFirstUnlockThisDeviceOnly, never synchronizable. Check for updates uses the secret only on an explicit tap.

The Release checker has one narrow HTTP exception: `URLSession` and `URLRequest` are allowed only in `Features/Feedback/FeedbackTransport.swift`, which has exactly one HTTPS URL, `https://feedback.lakshly.com`. Feedback is the only user data that leaves the device through app HTTP, only on Send to this host (status checks are explicit taps); redirects are refused. StoreKit performs subscription verification separately. Only the macOS app has network.client; widgets have no network entitlement and network.server is forbidden. The GitHub fallback opens a public draft for review and includes only the same previewed payload fields.

`scripts/render_feedback_shots.sh /tmp/feedbackshots-test` renders seven fictional screens at 390 pt and 900 pt, in Lakshmi dark and Monochrome Gold light, using offscreen ImageRenderer and a stub transport. It opens no windows and makes no network requests.
