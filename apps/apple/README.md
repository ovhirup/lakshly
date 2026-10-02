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

Launch arguments (Xcode scheme → Run → Arguments): `-demoUnlocked YES` bypasses authentication; `-startTab overview|spend|budget|debt|credit|investments|rewards|history|feedback` chooses the tab; `-showLock YES` takes precedence and keeps the lock visible. These are demo screenshot controls, not production authentication settings. Settings provides app lock, demo reset and **Preview Premium (demo — no purchases)**. Free/Premium is UI-only; there is no StoreKit or payment flow.

The first launch decodes the bundled dataset, seeds synthetic feedback, and persists both to Application Support as an authenticated AES-GCM sealed box with a random 256-bit key. Keychain items use `WhenUnlockedThisDeviceOnly`. On supported hardware a Secure Enclave P-256 key agrees with a disposable peer, then HKDF-SHA256 derives an AES wrapping key; the opaque enclave key representation, peer public key and wrapped data key are stored together in Keychain. The peer private key is discarded. Otherwise the data key resides directly in Keychain. No plaintext finance file is written.

If Keychain/Enclave access fails in unsigned builds or the simulator, a temporary memory key is used, Settings shows **Encryption key not persisted (dev build)**, and edits/feedback last only for that process. Existing encrypted files are preserved. A decryption failure shows demo data and blocks saving until an explicit reset. Reset replaces finances and feedback, retaining the encryption key. LocalAuthentication uses device-owner authentication with passcode fallback; unavailable authentication permits explicit demo mode. Background/inactive transitions cover finances and dismiss Settings; authentication prompts do not trigger a second lock.

**No app networking:** no URLSession, analytics, bank connections or network entitlement. Feedback is local; the optional GitHub Issues link is opened by the OS browser only. Nothing is submitted automatically.

`LakshlyTests` covers Indian money grouping and authenticated encryption including tamper/wrong-key rejection. Run through the iOS scheme's Test action. In the restricted agent sandbox, both generic iOS Simulator and macOS builds pass with the temporary CLI override `OTHER_SWIFT_FLAGS='$(inherited) -disable-sandbox'`; Swift macro plugin sandbox nesting otherwise fails. The specific simulator destination and XCTest execution require CoreSimulator access outside that sandbox. The override is not part of project settings.

MVP limitations: AppIcon is a placeholder; budget rollover is annotated, not carried forward; projections are illustrative with fixed rates and no taxes/fees; Premium planner is an explanatory preview. Device authentication, Keychain/Enclave persistence and responsive visual layout still need hands-on simulator/device QA.
