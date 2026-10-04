Read-only inventory complete: **43 shared feature IDs and all 19 Apple enum cases accounted for**. No files changed, tests run, apps launched, dependencies installed, or private sources inspected.

All anchors below are relative to `/Users/abhirupbanerjee/Documents/ChatGPT/Lakshly/repo`. “Implemented” means concrete public source exists, not a fresh runtime validation or release approval.

Apple shares the same application source across targets: `apps/apple/project.yml:17` includes `Lakshly` for iOS at line 21; macOS target at line 77 includes it at line 81. Feature support below therefore applies to both unless noted.

### 19 Apple cases → shared IDs

The enum is `apps/apple/Lakshly/Store/Entitlements.swift:17`; manual tier dictionary begins at line 50.

| Apple case | Canonical shared ID | Current tier | Mapping evidence |
|---|---|---|---|
| premiumThemes | themes.premium | Premium | Settings theme lock: `Features/Settings/SettingsView.swift:42`; Premium themes at `Components/ThemeDefinitions.swift:18`, `:22`, `:26` |
| debtPlanner | debt.planner | Premium | `Features/Debt/DebtView.swift:9`, `:52` |
| creditInsights | credit.insights | Premium | `Features/Credit/CreditView.swift:22` |
| investmentInsights | investments.insights | Premium | `Features/Investments/InvestmentsView.swift:44`, `:66` |
| rewardsInsights | rewards.tracking | Premium | `Features/Rewards/RewardsView.swift:13` |
| priorityFeedback | priorityFeedback | Premium | Exact existing raw name; `Features/Feedback/FeedbackView.swift:29` |
| basicWidgets | **Unmapped** | Free | No matching shared ID; budget pace/upcoming bill map here at `Glance/GlanceSnapshot.swift:217` |
| extraWidgets | **Unmapped** | Premium | No matching shared ID; net worth/debt map here at `Glance/GlanceSnapshot.swift:218` |
| importStatements | import.statements | Free | Exact raw ID, `Store/Entitlements.swift:29` |
| setupWizard | setup.wizard | Free | Exact raw ID, `:30` |
| setupEmailGuide | setup.emailGuide | Free | Exact raw ID, `:31` |
| setupExtraEmails | setup.extraEmails | Free | Exact raw ID, `:32`; tier-dependent quantity |
| setupSuggestions | setup.suggestions | Free | Exact raw ID, `:33` |
| setupHealth | setup.health | Free | Exact raw ID, `:34` |
| mailSyncConnect | mailSync.connect | Free | Exact raw ID, `:35`; allowance does not imply live sync |
| mailSyncIMAP | mailSync.imap | Free | Exact raw ID, `:36`; pure query planning only |
| mailSyncStatementPasswordKeychain | mailSync.statementPasswordKeychain | Free | Exact raw ID, `:37`; no persistence implementation found |
| mailSyncBackground | mailSync.background | Premium | Exact raw ID, `:39`; no scheduler implementation found |
| setupFreshnessReminders | setup.freshnessReminders | Premium | Exact raw ID, `:41`; no notification implementation found |

Counts: **8 legacy/raw-name cases**, including the two widget cases; **11 explicit dotted raw IDs**. Of the 19, **17 canonical mappings** exist. Widgets require deliberate canonical IDs or a documented adapter extension; neither maps to `review.widget`, which promises a review-count widget rather than the implemented finance widgets.

### All 43 shared IDs: Apple implementation inventory

For brevity, anchors in this table start below `apps/apple/Lakshly/`.

| Shared ID | iPhone | macOS | Evidence and limits |
|---|---|---|---|
| core.tabs | Implemented | Implemented | Overview/Spend/Budget/History at `App/LakshlyApp.swift:169`, `:177`, `:184`, `:230`; `.sidebarAdaptable` at `:240`. Data-dependent gates remain. |
| import.statements | Implemented | Implemented | CSV dispatch and PDF/CAS parsing at `Features/Import/ImportView.swift:102`, `:117`; confirmed merge/persistence at `:53` and `Import/DatasetImport.swift:31`. |
| security.encryption | Implemented | Implemented | AES-GCM seal/open and encrypted persistence at `Store/SecureStore.swift:35`, `:47`; Keychain/Secure Enclave wrapping at `Store/KeyManager.swift:5`, `:74`. Dev key fallback is explicitly surfaced at `Store/DataStore.swift:31`. |
| security.lock | Implemented | Implemented | LocalAuthentication unlock at `Security/AppLock.swift:59`; authenticated disable at `:94`; relock at `App/LakshlyApp.swift:301`. |
| data.delete | Implemented | Implemented | Settings destructive action at `Features/Settings/SettingsView.swift:130`; removal/reset of imported dataset, logs/setup at `Store/DataStore.swift:136`. |
| data.export | No evidence | No evidence | No user dataset export action, `fileExporter`, or `ShareLink` found in bounded source. `SetupCanvas.swift:709` “Export guides” is external statement download guidance, not exporting Lakshly user data. |
| themes.premium | Implemented | Implemented | Settings selection lock at `Features/Settings/SettingsView.swift:38`; three Premium theme definitions at `Components/ThemeDefinitions.swift:18`, `:22`, `:26`. Gate currently uses `isPremium` through `ThemeAppIcon`, rather than the Feature case directly. |
| budgets.unlimited | Partial | Partial | Budget saving supports multiple month sets at `Setup/SetupSession.swift:284`; view shows selected-month lines at `Features/Budget/BudgetView.swift:9`. No tier-dependent count restriction or corresponding Apple Feature case. |
| budgets.lines | Partial | Partial | Starter category selection hard-caps at six for **all tiers**, `Setup/SetupCanvas.swift:760`; budget save accepts incoming lines without tier guard, `Setup/SetupSession.swift:284`. No Premium-unlimited distinction. |
| history.full | Partial | Partial | All transaction history is read and displayed at `Features/History/HistoryView.swift:9`, `:20`, `:37`; no 12-month Free boundary or Premium gate. |
| debt.planner | Partial | Partial | Premium planner card at `Features/Debt/DebtView.swift:52` contains explanation only; no interactive extra-payment what-if or repayment ordering implementation. The existing amortization chart at `:10`, `:36` is available independently of this gate. |
| credit.insights | Implemented | Implemented | Premium statement date, next due date, utilization guidance at `Features/Credit/CreditView.swift:22`. Snapshot guidance, no score service. |
| investments.insights | Implemented | Implemented | Gated SIP details and illustrative ten-year projection at `Features/Investments/InvestmentsView.swift:44`, `:66`; projection computation at `:13`. Data gates may require SIPs before opening page (`App/LakshlyApp.swift:214`). |
| rewards.tracking | Implemented | Implemented | Imported/demo reward balances, gated redemption value and expiry at `Features/Rewards/RewardsView.swift:9`, `:13`. No external reward-account sync implied. |
| priorityFeedback | Implemented | Implemented | Tier-selected priority at `Features/Feedback/FeedbackView.swift:29`; user-reviewed GitHub link at `:87`; `Features/Feedback/GitHubIssueLink.swift:117` emits priority label. “Triaged first” is a process claim, not code-verifiable service behavior. |
| setup.wizard | Implemented | Implemented | Session/reducer/live actions at `Features/Setup/SetupView.swift:36`; iPhone full-screen setup at `App/LakshlyApp.swift:245`, Mac separate setup window at `:65`, `:293`. |
| setup.emailGuide | Implemented | Implemented | Tailored manual source queries at `Setup/SetupCanvas.swift:394`; Gmail/Outlook query and URL builders at `Setup/SetupLinks.swift:41`, `:53`, `:61`. External browser searches. |
| setup.extraEmails | Partial | Partial | Functional saved manual search addresses at `Setup/SetupCanvas.swift:372`; quota-conditioned “add” control at `:381`. Counts **primary plus extras**, not extras alone (`:323`); reducer itself has no quota guard (`Setup/SetupReducer.swift:148`). |
| setup.suggestions | Implemented | Implemented | Budget/goal suggestions invoked at `Setup/SetupCanvas.swift:742`; interactive saving at `:785`, `Setup/SetupSession.swift:284`, `:305`. |
| setup.health | Implemented | Implemented | Checklist/done UI at `Setup/SetupCanvas.swift:966`; source freshness display at `:1003`; pure freshness rules at `Setup/SetupReducer.swift:69`, `:76`. |
| setup.freshnessReminders | Stub | Stub | Tier case only at `Store/Entitlements.swift:41`, `:70`. Existing freshness labels are passive; “Remind me” at `Setup/SetupCanvas.swift:789` just shows a toast, no notification scheduling. |
| mailSync.connect | Stub | Stub | Connect/consent UI exists; agreement sets notice and saves email for manual search only, `Setup/SetupSession.swift:230`, `:237`. Explicit unavailable copy at `Setup/SetupCanvas.swift:366`. |
| mailSync.imap | Stub | Stub | Pure `UID SEARCH` construction at `Setup/MailSync/MailSyncPlanner.swift:69`; file explicitly says synthetic rehearsal/no network at `:3`. No IMAP connection/client implementation found. |
| mailSync.statementPasswordKeychain | Stub | Stub | Feature/tier entry at `Store/Entitlements.swift:37`, `:68`; password UI clears entered text at `Features/Import/ImportView.swift:224`. Existing KeyManager is dataset-key storage, not statement-password storage. Setup says “We never store statement passwords” at `Setup/SetupCanvas.swift:292`. |
| mailSync.background | Stub | Stub | Feature/tier entry at `Store/Entitlements.swift:39`, `:69`; no background mail transport or scheduling implementation found. |
| privacy.mode | Partial | Partial | Setup-only hide amounts toggle at `Setup/SetupCanvas.swift:167`, session state at `Setup/SetupSession.swift:12`, live action at `Features/Setup/SetupView.swift:66`; some budget/goal masking at `Setup/SetupCanvas.swift:778`, `:853`, `:940`. No general dashboard-wide amount masking found. |
| privacy.shake | No evidence | No evidence | No shake/motion handler found in public app source; no corresponding Apple Feature case. Mac physical-shake applicability needs explicit product decision. |
| privacy.autoHide | Partial | Partial | Scene transition relocks with app-lock preference at `App/LakshlyApp.swift:301`; no separate auto-hide amounts setting or privacy masking transition. Mac menu panel reacts to device locking (`Glance/MenuBarPanel.swift:98`). Do not equate app-lock behavior automatically with this feature contract. |
| privacy.widgetMask | Implemented | Implemented | Settings show-amounts preference at `Features/Settings/SettingsView.swift:173`; actual mask/amount selection at `Glance/GlanceSnapshot.swift:259`. Separate Lock Screen preference defaults false (`SettingsView.swift:16`). |
| review.inbox | No evidence | No evidence | No weekly review feature/module/action found. “Review” text matches are import/feedback review, not this feature. |
| review.merchantRules | No evidence | No evidence | No merchant rule persistence/editing or corresponding Apple Feature case found. Parser categorization is not user-defined merchant rules. |
| review.reminder | No evidence | No evidence | No Sunday reminder scheduler or UserNotifications implementation found. |
| review.widget | No evidence | No evidence | Existing glance kinds are budget pace/upcoming bill/net worth/debt only (`Glance/GlanceSnapshot.swift:212`); no review-count kind. |
| review.worthIt | No evidence | No evidence | No user worth-it tag UI/action found; generic transaction `tags` alone does not implement it. |
| badges.core | No evidence | No evidence | No badge/XP model, accrual, or cabinet modules found. SF Symbol names using “badge” are unrelated. |
| badges.cabinet | No evidence | No evidence | No cabinet view/model found. |
| badges.share | No evidence | No evidence | No badge image generator/share path found. |
| badges.themes | No evidence | No evidence | App themes exist, but no badge system/theme implementation. |
| badges.animatedFrames | No evidence | No evidence | No badge frames or animation implementation found. |
| nudges.core | No evidence | No evidence | No coach nudge model/UI or Not now/Why/snooze action found. |
| nudges.tone.hype | No evidence | No evidence | No tone selection/content implementation found. |
| nudges.tone.roast | No evidence | No evidence | No tone selection/content implementation found. |
| nudges.notifications | No evidence | No evidence | No UserNotifications scheduler/client found in bounded source. UIKit haptic success feedback (`Features/Setup/SetupView.swift:135`) is not user notification delivery. |

“No evidence” is bounded to public app source, tests, and project metadata. It does not establish that an external service or private app lacks a feature.

### Six quota rows and enforcement gaps

Read of the shared JSON confirms **exactly six feature `limits` entries**, including merchant rules; five have explicit both-tier values.

| Shared ID | Shared limits | Apple quantity/enforcement evidence |
|---|---|---|
| budgets.unlimited | Free 1, Premium unlimited | Intended unit appears budget sets/months, but Apple storage uses one `Budget` per category and month (`SetupSession.swift:291`). Must decide grouping unit before prospective `used + requested`; no current tier guard. |
| budgets.lines | Free 6, Premium unlimited | Category lines per budget. Apple starter UI caps six for every tier (`SetupCanvas.swift:763`); no tier guard in save path (`SetupSession.swift:284`). Generated quota alone would not fix operation enforcement. |
| history.full | Free 12, Premium unlimited | Likely history months from catalog label/current Web contract, but Apple source does not define reference period/window or trimming behavior. Apple renders all transaction months (`HistoryView.swift:9`, `:20`). Policy quantity cannot itself decide calendar-window retention; do not hide/delete imported data without a separate approved rule. |
| setup.extraEmails | Free 3, Premium 10 | Current Apple quota unit is total saved manual-search addresses: primary present counts one (`SetupCanvas.swift:323`). Label says “Extra email addresses” while display says “Up to … addresses.” `setupCanvasModel` injects helper limit (`Features/Setup/SetupView.swift:28`), only button visibility enforces it; reducer/session accepts extras beyond it (`SetupReducer.swift:148`, `SetupSession.swift:257`). |
| mailSync.connect | Free 1, Premium 5 | Intended connected mailboxes; `EntitlementsMap.limits` supplies values (`Entitlements.swift:76`) but no active connector invokes a prospective quota check. Reducer can append mailboxes without quota check (`SetupReducer.swift:163`). Live connection is unavailable. |
| review.merchantRules | Free unlimited, **Premium key absent** | No Apple feature/model/enforcement. Shared contract schema requires both tier keys; missing Premium must be resolved explicitly in migration, not silently read as zero or inferred accidentally. |

### Existing helpers are tier allowances, not feature availability

- `can`/`EntitlementRule.allows` at `Store/Entitlements.swift:87` compares tier against map entry and defaults a missing map entry to `.premium`. Thus missing entry **denies Free but permits Premium**. Existing test deliberately checks this at `apps/apple/LakshlyTests/StoreKitTests.swift:207`. It is not the new policy’s unknown-feature deny-for-everyone behavior.
- `limit` at `Store/Entitlements.swift:81`: disallowed tier → `0`; missing limits table → `Int.max`; missing selected tier → Premium limit, then `Int.max`.
- `EntitlementStore.can` at `Store/EntitlementStore.swift:68` delegates only to that tier comparison. No platform, implementation status, suite, release channel, or expiry reevaluation occurs per feature operation.
- The enum’s mail/password/reminder cases make them *permitted by tier*, while current UI explicitly leaves mail sync inactive. Migrating tiers alone must not mark stubs implemented.
- No public native suite/channel resolver is visible. `#if DEBUG` screenshots and `LaunchOptions` are build/debug controls, not a Public Beta identity or authorization adapter.

### StoreKit adapter facts and exact expiry discrepancy

- Actual upstream verification is present: `Store/EntitlementStore.swift:93` reads `StoreKit.Transaction.currentEntitlements`, distinguishing `.verified`/`.unverified` at `:96`.
- Snapshot currently stores product ID, expiry, revocation, upgrade flag, verification flag (`Store/Entitlements.swift:100`), populated at `EntitlementStore.swift:104`.
- Resolver requires verified matching product, no revocation, no upgrade (`Entitlements.swift:125`), yearly wins (`:130`, `:143`).
- **Boundary mismatch:** existing resolver excludes expiry only when `expiration < now` at `Entitlements.swift:127`. Equality remains Premium; `willRenew` similarly uses `>= now` at `:138`. New policy uses active interval `start <= asOf < end`, so **at equality it falls back to Free**.
- Purchase/start timestamp is not captured by `EntitlementSnapshot`; future-dated-start rejection therefore cannot currently be preserved by a straightforward adapter. StoreKit source transaction would need an explicit approved timestamp reduction.
- Transaction dates are `Date` with potential subsecond precision; policy uses UTC integer seconds. Flooring/rounding and exact-boundary treatment need an explicit adapter rule and fixtures.
- Revocation/refund and renewal intentions are represented but no local offline grace rule exists. `renewalIntention` reads verified subscription status at `EntitlementStore.swift:175`; auto-renew intention is separate from current access.
- Store state refresh/update is implemented, but a feature call reads cached `tier`. No clock-triggered expiry reevaluation on each `can` call is visible.
- Purchase UI adapts to platform: active UIWindowScene on iPhone (`EntitlementStore.swift:193`) and active NSWindow on Mac (`:198`). No private authorization, Web subscription cross-device identity, or Beta simulated grant adapter found.

### Platform adaptations relevant to integration

- Both targets include the same source with OS-specific UIKit/AppKit paths (`project.yml:21`, `:81`).
- Setup full screen on iPhone (`LakshlyApp.swift:245`) versus separate Mac setup window (`:65`, `:293`).
- Setup model uses platform enum and Mac folder-watch presentation flag (`Features/Setup/SetupView.swift:11`, `:26`); a flag/presentation is not an active folder watcher.
- Widgets use shared Free/Premium gate and mask logic (`GlanceSnapshot.swift:240`, `:259`); Mac menu panel uses extraWidgets Premium (`Glance/MenuBarPanel.swift:30`).
- Live Activities preference/manager and alternate icons are iOS-specific; menu-bar preference is Mac-specific (`SettingsView.swift:17`, `:20`, `:151`). These are separate form-factor features and should not be inferred from the 43-ID tier catalog.
- Release resources are stripped using literal `Release` configuration checks (`project.yml:56`, `:109`). Native Beta channel should remain orthogonal to Debug/Release so adding a named Beta configuration does not bypass those guards.

Suggested bounded migration order: approve widget canonical mapping and quota-unit ambiguities; generate a legacy tier/limit map without changing behavior; separately plan context/StoreKit date adaptation and availability gating; only then wire operation-level quotas and new decision semantics.
