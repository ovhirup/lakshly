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

Launch arguments (Xcode scheme → Run → Arguments) are **DEBUG-only**: `LaunchOptions` parses them from process arguments inside `#if DEBUG`, and they are compiled out of Release. `-demoUnlocked YES` skips authentication in DEBUG; `-startTab overview|spend|budget|debt|credit|investments|rewards|history|feedback` chooses the tab; `-showLock YES` takes precedence and keeps the lock visible; `-appearance light|dark` sets the root color scheme. Settings provides app lock, demo reset and **Preview Premium (demo — no purchases)**. Free/Premium is UI-only; there is no StoreKit or payment flow.

Before any app state or `@AppStorage` is read, startup clears the UserDefaults argument domain, so launch arguments such as `-settings.appLock NO` or `-settings.premium YES` cannot override persisted settings in any build. Persisted keys are `settings.appLock` and `settings.premium` (legacy `appLock`/`premium` values are migrated once). `scripts/check_release_launch_args.sh` builds unsigned Release apps for macOS and the iOS Simulator into `build/ReleaseCheck` and fails if `strings` finds `demoUnlocked`, `showLock`, `startTab` or `openSettings` in either binary.

The first launch decodes the bundled dataset, seeds synthetic feedback, and persists both to Application Support as an authenticated AES-GCM sealed box with a random 256-bit key. Keychain items use `WhenUnlockedThisDeviceOnly`. On supported hardware a Secure Enclave P-256 key agrees with a disposable peer, then HKDF-SHA256 derives an AES wrapping key; the opaque enclave key representation, peer public key and wrapped data key are stored together in Keychain. The peer private key is discarded. Otherwise the data key resides directly in Keychain. No plaintext finance file is written.

If Keychain/Enclave access fails in unsigned builds or the simulator, a temporary memory key is used, Settings shows **Encryption key not persisted (dev build)**, and edits/feedback last only for that process. Existing encrypted files are preserved. A decryption failure shows demo data and blocks saving until an explicit reset. Reset replaces finances and feedback, retaining the encryption key. LocalAuthentication uses device-owner authentication with passcode fallback. **Continue (demo mode)** is offered only when `canEvaluatePolicy(.deviceOwnerAuthentication)` fails with `LAError.passcodeNotSet` (the device has no passcode/password, so there is no lock to bypass); the action re-checks this itself. Every other failure (biometry lockout, not enrolled, unavailable, unknown) keeps the app locked and offers Try again. Turning **App lock** off requires a successful device authentication when the device can authenticate. Keychain queries use the data-protection keychain only. Background/inactive transitions cover finances and dismiss Settings; authentication prompts do not trigger a second lock.

**No app networking:** no URLSession, analytics, bank connections or network entitlement. Feedback is local; the optional GitHub Issues link is opened by the OS browser only. Nothing is submitted automatically.

`LakshlyTests` covers Indian money grouping and authenticated encryption including tamper/wrong-key rejection. Run through the iOS scheme's Test action. In the restricted agent sandbox, both generic iOS Simulator and macOS builds pass with the temporary CLI override `OTHER_SWIFT_FLAGS='$(inherited) -disable-sandbox'`; Swift macro plugin sandbox nesting otherwise fails. The specific simulator destination and XCTest execution require CoreSimulator access outside that sandbox. The override is not part of project settings.

MVP limitations: AppIcon is a placeholder; budget rollover is annotated, not carried forward; projections are illustrative with fixed rates and no taxes/fees; Premium planner is an explanatory preview. Device authentication, Keychain/Enclave persistence and responsive visual layout still need hands-on simulator/device QA.

## Design tokens

Adaptive sRGB assets use Any (light) and Dark variants. AccentColor matches gold.
Contrast ratios below are against **bg / surface**, computed from the asset catalog
with `python3 scripts/contrast_check.py` (stdlib only; exits nonzero on failure).
Semantic text colors and gold meet WCAG AA 4.5:1; decorative lotus exceeds 3:1.

| Token | Light hex | Light contrast | Dark hex | Dark contrast |
| --- | --- | --- | --- | --- |
| bg | #FBF8F1 | 1.00 / 1.06 | #0E1430 | 1.00 / 1.14 |
| surface | #FFFFFF | 1.06 / 1.00 | #182044 | 1.14 / 1.00 |
| gold | #896414 | 5.08 / 5.39 | #D9A93F | 8.35 / 7.30 |
| lotus | #C24D72 | 4.31 / 4.57 | #E8789A | 6.53 / 5.71 |
| income | #18734D | 5.50 / 5.84 | #61CF9A | 9.39 / 8.20 |
| spend | #AD4E43 | 5.02 / 5.32 | #F09A8D | 8.36 / 7.31 |
| invest | #176F7A | 5.51 / 5.85 | #68C9D3 | 9.37 / 8.19 |
| danger | #B53D4D | 5.29 / 5.62 | #FF91A0 | 8.45 / 7.38 |
| success | #287343 | 5.46 / 5.80 | #80CB94 | 9.37 / 8.19 |

`Theme` owns all palette references, including adaptive cool chart category assets.
Income and investments preserve their semantic colors; the 21 category identities
use indigos, teals, emeralds, gold, slate, and one lotus accent, with labeled legends.
The background uses low-opacity indigo and gold radial light over a solid adaptive
base; glass cards have a thin specular highlight. The lock screen uses a dedicated
indigo base and lighter gold for readable glyphs and controls in either appearance.
Appearance follows the system unless the screenshot launch argument overrides it.
Secondary labels, the Demo data capsule, and disabled Submit use adaptive `secondaryText` (#595D70 light / #BDC5DE dark); the contrast script also checks the capsule fill and disabled button surface.
