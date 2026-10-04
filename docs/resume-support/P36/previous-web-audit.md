Read-only scan complete: **all 43 exact feature IDs accounted for; all 6 quota definitions assessed.** Source evidence only; no runtime verification, tests, installs, or writes. `git status --short` still shows only the preserved untracked Web AGENTS/CLAUDE files.

All references below are relative to `/Users/abhirupbanerjee/Documents/ChatGPT/Lakshly/repo/`. I read `apps/web/AGENTS.md`; no Web code was written. Existing policy namespace and unmerged Cursor PRs were not inventoried.

| Exact feature ID | Web source status | Implementation and consumption evidence |
|---|---|---|
| `core.tabs` | Implemented | `apps/web/components/Shell.tsx:20` declares Overview/Spend/Budget/History routes; `:35` mobile core routes. No explicit gate for this ID. Real source views: `apps/web/app/page.tsx:18`, `app/spend/page.tsx:14`, `app/budget/page.tsx:11`, `app/history/page.tsx:9`. |
| `import.statements` | Implemented | `apps/web/lib/import/client.ts:18` handles CSV/TSV and PDF/CAS via worker; `apps/web/app/import/page.tsx:43` mounts Importer. Free label `:30`; no ID gate. |
| `security.encryption` | Implemented, bounded threat model | `apps/web/lib/vault.ts:47` creates nonextractable AES-GCM256 key; `:52` encrypts dataset, `:69` named records. `:3` states casual browser-profile protection, not protection from origin code. No ID gate. |
| `security.lock` | Stub/planned | `apps/web/lib/vault.ts:4` explicitly says passphrase lock is planned. Catalog assertion `packages/shared/entitlements.json:13`; no app-lock implementation found in scoped Web source. |
| `data.delete` | Implemented, deletion caveat | `apps/web/app/import/page.tsx:57` confirmation UI; `apps/web/components/DataState.tsx:119` calls deleteVault and clears state. `apps/web/lib/vault.ts:96` resolves `onblocked` before successful database deletion, so guaranteed deletion under blocked IDB remains unverified. No ID gate. |
| `data.export` | No evidence | Catalog at `packages/shared/entitlements.json:15`. No financial dataset export flow in bounded Web app/components/lib scan; badge PNG export is a separate feature. |
| `themes.premium` | Implemented | `apps/web/components/ThemeSwitcher.tsx:51`, `:130`, `:165` consume gate for theme choice; Beta mood picker also consumes it at `components/ThemeV2.tsx:130`. Catalog “3 extra themes” label does not fully describe Beta ThemeV2 scope. |
| `budgets.unlimited` | Partial | Catalog `packages/shared/entitlements.json:17` defines Free1/Premium unlimited; no runtime `limit` consumer for this ID. `apps/web/components/DataState.tsx:98` saves/replaces a month’s lines without budget-count validation. |
| `budgets.lines` | Implemented UI allowance; persistence gap | `apps/web/app/budget/page.tsx:16` reads allowance and `:23` slices visible lines. Setup reads it at `app/setup/page.tsx:581`, uses maxLines in suggestions `:587`, addition `:592`. `DataState.tsx:98` persistence itself does not validate cap. |
| `history.full` | Partial/display-only allowance | `apps/web/app/history/page.tsx:12` reads limit; `:20` describes 12months/unlimited. `:14` balanceHistory and `:15` cashflow use all transactions; no cap applied to visible data or retention. |
| `debt.planner` | Implemented | `apps/web/app/debt/page.tsx:15` amortisation baseline/prepayment; `:23` explicit PremiumGate; `:45` interactive amount slider. Navigation gate `components/Shell.tsx:26`. |
| `credit.insights` | Implemented | `apps/web/app/credit/page.tsx:16` derives cards; `:20` explicit PremiumGate; `:28` utilisation and `:42` statement/due dates. Navigation gate `Shell.tsx:27`. |
| `investments.insights` | Implemented, dataset limitations | `apps/web/app/investments/page.tsx:12` accounts-based holdings; `:15` SIP projections; `:26` explicit PremiumGate. `:78` DataGate asks for SIP/mutual-fund evidence; depository-only holdings support is not established by this page. Navigation gate `Shell.tsx:28`. |
| `rewards.tracking` | Implemented tracking view | `apps/web/app/rewards/page.tsx:7` reward dataset; `:12` explicit PremiumGate; balances/value/expiry `:19`. `:23` promises expiry nudge; actual general nudge candidate generation is separate `components/Game.tsx:103`. Navigation gate `Shell.tsx:29`. |
| `priorityFeedback` | Implemented client priority marking; delivery outcome unverified | `apps/web/lib/github-issue.ts:68` adds priority label via `can`; `apps/web/app/feedback/page.tsx:170` also consumes ID. Source establishes outgoing priority metadata, not service response priority or SLA. |
| `setup.wizard` | Implemented | `apps/web/app/setup/page.tsx:37` Wizard handles persisted/deep-linked steps `:50`; `components/SetupState.tsx:49` provider. No explicit ID gate. |
| `setup.emailGuide` | Implemented | `apps/web/app/setup/page.tsx:525` renders source search guide; Gmail URL `:540`, Outlook query/copy/open `:542`. No ID gate. |
| `setup.extraEmails` | Implemented | `apps/web/app/setup/page.tsx:283` reads limit; `:292` dispatches total maximum `1+extra`; `:316` Add another address condition. Unit is extra guide addresses beyond primary. |
| `setup.suggestions` | Implemented | `apps/web/app/setup/page.tsx:587` budget suggestion and `:589` first-goal suggestion; `apps/web/lib/setup-suggest.ts:47` history/starter budget algorithm. No ID gate. |
| `setup.health` | Implemented | `apps/web/app/setup/page.tsx:725` consumes ID; `:730` derives freshness/cadence; `:734` status and `:735` import action. |
| `setup.freshnessReminders` | No evidence beyond catalog | `packages/shared/entitlements.json:30`; source has health statuses, but no consumer/scheduler for this ID in bounded Web source. |
| `mailSync.connect` | Partial, foreground read-only Gmail | `apps/web/components/GoogleConnect.tsx:101` requests/validates Gmail access; `:169` user-triggered search, `:175` download/import. Availability determined by `apps/web/lib/edition.ts:11` Beta or explicit Gmail flag and setup `:322`; no tier/mailbox quota consumer. UI fallback calls automatic sync coming soon at setup `:323`. This is not automatic background sync. |
| `mailSync.imap` | No Web implementation | Catalog labels Apple at `packages/shared/entitlements.json:32`; setup `apps/web/app/setup/page.tsx:329` directs IMAP to Apple. No Web IMAP path. Native implementation unknown from this scan. |
| `mailSync.statementPasswordKeychain` | No Web implementation | Catalog labels Apple at `packages/shared/entitlements.json:33`. Web parser `apps/web/lib/import/client.ts:17` uses password for call only. Gmail bulk `apps/web/lib/gmail-bulk.ts:44` retains passwords in an in-memory map for a run, clears at `:79`; not keychain/persistent device storage. |
| `mailSync.background` | No evidence beyond catalog | `packages/shared/entitlements.json:34`. Foreground Gmail token expires with closing tab per `apps/web/components/GoogleConnect.tsx:218`; no Web background scheduler in scoped source. |
| `privacy.mode` | Implemented | `apps/web/components/Privacy.tsx:64` derives mask, `:66` applies formatter mask; toggle UI `:145`. Free by `components/PrivacySettings.tsx:13`; no ID gate. |
| `privacy.shake` | Implemented, device capability dependent | `apps/web/components/Privacy.tsx:113` motion listener and hide-only detector; `PrivacySettings.tsx:21` coarse-pointer/motion capability checks and `:24` permission request. No ID gate. |
| `privacy.autoHide` | Implemented | `apps/web/components/Privacy.tsx:99` blur/focus/visibility transient masking; settings toggle `PrivacySettings.tsx:39`. No ID gate. |
| `privacy.widgetMask` | Partial configuration only | `apps/web/lib/privacy.ts:9` field; `:11` default hidden; `:18` persistence parsing. No Web widget display consumer found. |
| `review.inbox` | Implemented | `apps/web/lib/review.ts:158` buildInbox; `apps/web/app/review/page.tsx:281` renders rows/actions; persisted provider `components/useReview.ts:64`. No ID gate. |
| `review.merchantRules` | Implemented | `apps/web/app/review/page.tsx:67` remember checkbox; `:225` dispatch; `apps/web/lib/review.ts:248` stores rule, `:139` suggestion reads rules. No quota consumer; existing allowance unlimited. |
| `review.reminder` | Implemented in-app only | `apps/web/app/review/page.tsx:226` persisted toggle; `:328` explicitly no notifications. SundayBanner at `components/ReviewParts.tsx:47` checks Sunday after17h/inbox. No ID gate. |
| `review.widget` | No Web widget evidence | Catalog `packages/shared/entitlements.json:42`. In-app navigation count badge `apps/web/components/ReviewParts.tsx:11` exists; do not equate it to OS/home-screen widget. |
| `review.worthIt` | Implemented | `apps/web/app/review/page.tsx:33` thumb chips, `:181` action; `apps/web/lib/review.ts:266` persists rating; monthly ratio `:352`; display `components/ReviewParts.tsx:63`. No ID gate. |
| `badges.core` | Implemented | `apps/web/components/Game.tsx:78` facts, `:82` evaluation, `:95` append-only ledger, `:102` XP. No tier input to earning/evaluation; `apps/web/app/badges/page.tsx:102` Free statement. |
| `badges.cabinet` | Implemented | `apps/web/app/badges/page.tsx:106` families/grid and detail panel around `:140`; no ID gate. |
| `badges.share` | Implemented | `apps/web/app/badges/page.tsx:25` on-device PNG of badge name/tier/date; share/download `:44`; button `:148`. No amounts in card code; no ID gate. |
| `badges.themes` | No evidence beyond catalog | `packages/shared/entitlements.json:47`; no ID consumer or dedicated badge theme picker found. General themes and animated frames are separate implementation. |
| `badges.animatedFrames` | Implemented | `apps/web/app/badges/page.tsx:62` gate, `:63` combines preference, `:117` framed class; `apps/web/components/game.css:40` animated sheen and `:70` reduced-motion suppression. |
| `nudges.core` | Implemented | `apps/web/components/Game.tsx:103` candidate/decision engine; `:206` NudgeCard, `:228` Not now, `:229` Why, `:236` snooze. No general ID gate. |
| `nudges.tone.hype` | Implemented | `apps/web/components/CoachSettings.tsx:9` Hype/Straight/Roast options; `:26` permits Hype/Straight unconditionally. No explicit hype ID consumer. |
| `nudges.tone.roast` | Implemented | `apps/web/components/CoachSettings.tsx:18` consumes ID; `:26` disallows selection absent Premium. Runtime nudge engine gets allowed flag `components/Game.tsx:54`, `:104`. |
| `nudges.notifications` | No Web implementation | Catalog Apple label `packages/shared/entitlements.json:52`; `apps/web/components/CoachSettings.tsx:51` explicitly says in-app cards only, nothing pushed. Native implementation unknown from this scan. |

The six quota definitions need distinct migration treatment:

| ID | Legacy allowance | Observed unit and enforcement |
|---|---|---|
| `budgets.unlimited` | Free1; Premiumnull | Claimed “monthly budget” at `app/budget/page.tsx:15`; exact counting model unclear because records are lines keyed by month/category, and `DataState.tsx:100` retains all other months. No count enforcement. |
| `budgets.lines` | Free6; Premiumnull | Category lines per monthly budget. UI/suggestions enforce six; persistence API does not. |
| `history.full` | Free12; Premiumnull | Months per catalog/UI. Label only, neither retention nor display-window enforcement found. Need choose intended quantity meaning before evaluator requests. |
| `setup.extraEmails` | Free3; Premium10 | Extra guide addresses plus one primary, totals4/11. Explicit UI and reducer input cap. These are not connected mailbox accounts. |
| `mailSync.connect` | Free1; Premium5 | Connected mailbox count intended by catalog/UI copy. Current Web code holds a single active Gmail client; no limit consumer or multi-mailbox accounting. |
| `review.merchantRules` | Freenull; Premium key omitted | Unique normalised merchant rules; current map overwrites key, no finite cap. Legacy Premium falls back to allowed/unlimited. Explicit migration Premiumnull should preserve existing semantics. |

Critical conversion hazards:

- `apps/web/lib/entitlements.ts:33` returns catalog numeric limits **before checking `can()`**. Both `budgets.unlimited` and `history.full` are marked `minTier:premium` but provide usable finite Free allowances. Copying their `minTier` into the new evaluator directly would deny Free’s budget/history allowances before quota evaluation.
- The legacy “fails closed” comment is inaccurate for Premium unknown features: helper `:29` treats unknown as Premium, and `apps/web/tests/entitlements.test.ts:36` expressly expects unknown Premium access. New evaluator denies unknown IDs; migration must test known call sites and treat this as intentional behavior change.
- Generated catalog membership is not feature implementation: `apps/web/scripts/gen-entitlements.mjs:11` mechanically exports every catalog ID. `apps/web/app/profile/page.tsx:111` mechanically lists every Premium item, including unimplemented ones.
- Beta Premium is simulation: `apps/web/components/AppState.tsx:38` forces Premium; normal mode reads local plan storage `:40`; profile `:119` confirms payments are not live. Source presence/edition branches do not establish Beta/Stable release approval.
- The 11 Free rights include **unimplemented Web lock/export** and **partial sync**. Preserve declared access intent separately from availability/implementation. Do not turn catalog promises into available features.
- No native support or private authorization inference was made. No release eligibility decision was made.
