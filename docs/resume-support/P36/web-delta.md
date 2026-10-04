P36-C1 Web delta audit complete. All observations below are pinned to **`779f9130e80adce66a1825212756d5f0acc8e677`**, compared with **`2d79390e04196acc98ac67eb3be27004bcd64914`**. I read the newer files with argument-array `subprocess.run(["git", "show", ref + ":" + path], ...)`; the old working tree was not used as implementation evidence. No writes, tests, installs, network operations, Git mutations, or GUI/runtime launches occurred.

**Three existing rows need status changes:** `security.lock` → `sourcePartial`, `data.export` → `sourceImplemented`, `setup.freshnessReminders` → `sourceImplemented`. Other affected rows retain their status with updated scope, semantics, or anchors. Apple/shared legacy declarations remain unchanged. All Beta/Stable approvals must remain pending.

### Qualified status and observation changes

Paths are repository-relative. The quoted needles below resolve at the listed line in pinned `779f9130`.

| Existing ID | Old → new status | Updated source observation and exact anchors |
|---|---|---|
| `security.lock` | `sourceStub` → **`sourcePartial`** | New **imported-vault lock**, not established whole-app lock. `apps/web/components/VaultLock.tsx:43`: `A passphrase wraps the key for your imported data. The demo stays available.` UI enables, unlocks and locks now. `apps/web/lib/vault.ts:77`: `export async function enableVaultLock(passphrase: string): Promise<void> {`; `:85`: `await tx("readwrite", (s) => s.delete("key"));`; `:98`: `export function lockVaultNow(): void {`; `:105`: `if (await readLock()) throw new VaultLockedError();`. Integration `apps/web/components/DataState.tsx:79`: `const onLock = () => { setUser(null); setVaultLocked(true); };`; `:170`: `if (d.source === "demo") return <>{children}</>;`; `:171`: `if (d.vaultLocked) return (`. Profile/navigation/demo remain accessible. No full-app gate or proof of clearing already-loaded sensitive Setup/Review/Game provider state in this bounded integration. Keep partial/hold under unchanged **“App lock”** label. |
| `data.export` | `notFoundInAudit` → **`sourceImplemented`**, bounded scope | Profile now consumes `can("data.export")`, exports active dataset JSON and transactions CSV. `apps/web/app/profile/page.tsx:146`: `{can("data.export") && (`; `:151`: button calls `datasetJson(dataset)`; `:152`: button calls `transactionsCsv(dataset.transactions)`. Browser download implementation `:57`: `function saveFile(filename: string, text: string, type: string) {`. `apps/web/lib/export.ts:4`: `export function datasetJson(dataset: LakshlyDataset): string {`; `:15`: `export function transactionsCsv(transactions: Transaction[]): string {`. JSON serializes the dataset, CSV transactions with paise. **Not a complete vault/UserData backup:** separately stored holdings, statement metadata, import logs, goals/profile/review/game records are not included by `datasetJson(dataset)`. Exports the books currently open, including demo when active; no source evidence of export/restoration UI round-trip. |
| `setup.freshnessReminders` | `notFoundInAudit` → **`sourceImplemented`**, in-app only | Premium in-app cadence reminders, snooze7days, optional foreground check only for an already connected Gmail tab. `apps/web/components/FreshnessReminder.tsx:43`: `if (!can("setup.freshnessReminders") || clock.snoozed) return null;`; `:44`: `const due = dueStatements(importTargets(state), state.progress, clock.today);`; `:66`: `void checkConnectedMailbox().then((r) => {`; `:74`: Not now calls `snooze(7)`. Pure source selection `apps/web/lib/setup.ts:335`: `export function dueStatements(`; `:344`: skips skipped sources; `:346`: selects due/stale; `:352`: `export function freshnessNotice(item: DueStatement, email: string | null, gmailInThisTab: boolean): { detail: string; canCheck: boolean } {`. Rendered inside TodayCard at `apps/web/components/TodayCard.tsx:36`: `{fresh && <FreshnessReminder row />}`; mounted Overview `apps/web/app/page.tsx:36`: `<TodayCard />`. No push/background scheduler or Gmail authorization verification claimed. |
| `security.encryption` | `sourceImplemented` unchanged | Vault now supports optional passphrase-wrapped device key and in-memory unlocked key. `apps/web/lib/vault.ts:23`: `let sessionKey: CryptoKey | null = null;`; `:81` fresh extractable key for wrapping; `:108` nonextractable default key if no lock; `:116` AES-GCM dataset encryption; `:133` AES-GCM record encryption. `apps/web/lib/vault-lock.ts:2`: `export const VAULT_LOCK_ITERATIONS = 210_000;`; `:26` PBKDF2/SHA256; `:38` wrap; `:47` unwrap into nonextractable key. Source-only cryptographic presence is **not security readiness**. Preserve origin-code limitation at `vault.ts:5`. Enabling lock migrates records sequentially (`:64` reencrypt) and persists lock/delete-key in separate transactions (`:84`, `:85`); atomic migration/recovery and all-sensitive-memory protection are not established by this audit. |
| `data.delete` | `sourceImplemented` unchanged | Keep blocked-delete caveat, update location. `apps/web/lib/vault.ts:153`: `export function deleteVault(): Promise<void> {`; `:157`: `req.onblocked = () => resolve();`. Provider deletion moved to `apps/web/components/DataState.tsx:137`, calls deletion at `:138`. New lock-state/session-key interactions are not independently verified; do not claim guaranteed vault erasure or broaden security assurance. Existing Import confirmation anchor57 unchanged. |
| `history.full` | **`sourcePartial` unchanged** | Former “no applied window” statement is now stale. Net-worth chart points are sliced to allowance, while savings balance history and cashflow totals still use all transactions. `apps/web/app/history/page.tsx:18`: `const months = limit("history.full");`; `:23`: `const worth = (months === null ? netWorthHistory(accounts, transactions) : netWorthHistory(accounts, transactions).slice(-months))`; `:20`: all-transaction `balanceHistory`; `:21`: all-transaction `monthlyCashflow`. `apps/web/lib/selectors.ts:55`: `export function netWorthHistory(accounts: Account[], txns: Transaction[]) {`; `:66` iterates only sorted transaction month keys. **Unit now observed:** last N returned transaction-month points for this chart, not guaranteed trailing N calendar months, general history window, or retention. Imported history is not deleted by this code. |
| `review.reminder` | `sourceImplemented` unchanged | Former opt-in Sunday-evening wording is stale. Now default-on unless explicitly false, real local Sunday regardless hour, pending inbox,7day snooze, in-app Today row. `apps/web/lib/review.ts:203`: `export function sundayReminderOn(stored: unknown): boolean {`; `:204`: `return stored !== false;`; `:214`: `export function showSundayReminder(day: number, count: number, enabled: boolean, snoozed: boolean): boolean {`; `:215`: `return day === 0 && count > 0 && enabled && !snoozed;`. Explicit gate `apps/web/components/ReviewParts.tsx:75`: `if (!can("review.reminder") || !showSundayReminder(...)) return null;`; snooze `:67`; rendered Today `TodayCard.tsx:19`. `apps/web/app/review/page.tsx:25` defaults remindertrue; `:329` copy describes Sunday card and7day Not now. No push/notification support. |
| `review.inbox` | `sourceImplemented` unchanged | Pure inbox implementation remains; anchor moved `apps/web/lib/review.ts:158` → **`:170`**, needle unchanged `export function buildInbox(txns: readonly ReviewTxn[], state: ReviewState, now: Date, opts: InboxOptions = {}): Inbox {`. Review page changes are reminder/quest presentation; do not claim a new inbox entitlement or quantity rule. |
| `review.merchantRules` | `sourceImplemented` unchanged | Merchant storage remains unlimited/no finite guard. Rule action anchor moved `apps/web/lib/review.ts:248` → **`:278`**: `if (action.rememberMerchant) state.merchantRules[merchantKey(row.tx)] = { category: action.category, nwv: action.nwv };`. UI checkbox at `app/review/page.tsx:67` remains. |
| `review.worthIt` | `sourceImplemented` unchanged | Existing rating feature remains. New related **3-day wait quest** should be recorded as separate uncovered functionality, not silently expand this ID. Ratings source is now `apps/web/lib/review.ts:296`; ratio function at `:392`; thumbs UI `apps/web/app/review/page.tsx:33` unchanged. WorthItCard moved `components/ReviewParts.tsx:63` → **`:126`**; quest start UI at `:158`, scoped to wishlist/custom, other quest kinds still coming soon `:161`. |
| `credit.insights` | `sourceImplemented` unchanged | Credit page/gate unchanged; adds Premium in-app card payment reminder consumed by Today. `apps/web/components/CardDueReminder.tsx:47`: `if (!can("credit.insights") || snap.snoozed) return null;`; `:54`: `.filter((c) => cardDueSoon(c.days))`; `:71` Not now snoozes7days. `apps/web/lib/card-due.ts:3`: `export const CARD_DUE_WINDOW_DAYS = 3;`; `:26`: `export function cardDueSoon(days: number, windowDays = CARD_DUE_WINDOW_DAYS): boolean {`; includes0..3days. Add qualified note if catalog describes current gate consumption; no push, no payment execution, no delivery/runtime assertion. |
| `mailSync.connect` | **`sourcePartial` unchanged** | Foreground/manual read-only Gmail remains; no automatic/background or multi-mailbox limit enforcement. New same-tab checking and disconnect UI cleanup. `apps/web/components/GoogleConnect.tsx:156`: `export async function checkConnectedMailbox(): Promise<{ connected: false } | { connected: true; found: number }> {`; `:157` requires existing token/client; `:239`: Disconnect sets consentfalse and calls disconnectGmail. `:144` disconnect clears memory and revokes token. Search anchor moved169→**178** (`async function find() {`); connect101 unchanged. `apps/web/lib/edition.ts:18` remains Beta-or-explicit-flag Gmail availability; provenance is browser/testing access, not paid/private authority. |
| `themes.premium` | `sourceImplemented` unchanged | General theme gate unchanged; Beta MoodGrid gate moved `apps/web/components/ThemeV2.tsx:130` → **`:177`**: `const premium = can("themes.premium");`. New liquid-glass slider is a distinct setting, not automatically a Premium feature: `ThemeV2.tsx:141`: `function GlassSlider() {`; no `can()` in that component, local glass preference, reduced-transparency disable at152. Do not fold its tier/release rule into “3 extra themes.” |
| `core.tabs` | `sourceImplemented` unchanged | Core routes remain ungated; NAV declaration20 unchanged. New Owed/Ask routes added without catalog IDs (`Shell.tsx:27`, `:32`). MOBILE core list moved35→**37**. Overview source function moved18→**19**. History function moved9→**15**. No app-wide entitlement/policy migration. |
| `budgets.unlimited` | `sourcePartial` unchanged | Save operation remains uncapped, moved `apps/web/components/DataState.tsx:98` → **`:116`**. New source semantics clarify monthly plans repeat until changed: `apps/web/lib/selectors.ts:219`: `export function planFor(budgets: Budget[], month: string): Budget[] {`; chooses own month, else latest earlier/earliest later lines. This does not resolve the “one budget” grouping/count decision or create count enforcement. |
| `budgets.lines` | `sourceImplemented` unchanged, UI-only qualification retained | Display/setup line allowance unchanged; persistence still lacks cap, saveBudgets anchor now116. Budget page gate16 and setup581/587/592 unchanged. No new operation-level enforcement. |

### Authority/demo correction

Replace assertions that Beta **always forces** Premium or cannot test Free:

- `apps/web/lib/edition.ts:11` — `export function resolveStoredPlan(isBeta: boolean, stored: string | null): "free" | "premium" {`
- `:13` — `if (isBeta && stored === "free") return "free";`
- `:14` — `return isBeta ? "premium" : "free";`
- `apps/web/components/AppState.tsx:40` — `return resolveStoredPlan(IS_BETA, stored);`
- `apps/web/components/Shell.tsx:86` — Beta includes `<PlanSwitch ... label="Tester plan" />`.
- `apps/web/lib/themes-v2.ts:87` — prepaint script preserves explicit `"free"`/`"premium"` instead of unconditionally rewriting Premium.
- `apps/web/app/profile/page.tsx:137` — payments not live; preview local/no charge. The existing qualifier moved119→137.
- `apps/web/components/Identity.tsx:75` now distinguishes Beta Free preview.

These are **local demo/tester controls**, not verified billing, signed grants, private authorization, or approved release eligibility. Some descriptive Beta copy still says Premium/every look unlocked; actual plan/gate logic is the evidence to inventory.

### All six quota reviews

1. **`budgets.unlimited`**: same Free1/Premiumnull declaration; no count consumer/guard. Update save anchor98→116 and qualify repeating plans. Proposed grouping still pending.
2. **`budgets.lines`**: same Free6/Premiumnull; UI/suggestions only. Save anchor98→116, no persistence guard added.
3. **`history.full`**: update `noGuardFound` to qualified **`sourceUIOnly`** for the net-worth chart, with evidence18/23 and uncapped other history20/21. Observed unit “last returned transaction-month points for net-worth chart only.” Pending calendar/display/retention decision remains; do not silently mark fully enforced.
4. **`setup.extraEmails`**: unchanged extras beyond primary, totals4/11. Existing anchors283/292 resolve unchanged.
5. **`mailSync.connect`**: same intended mailbox1/5; one active foreground client, no count guard. Connect101 unchanged, find169→178. Same-tab freshness check does not consume another connected account or establish background sync.
6. **`review.merchantRules`**: unchanged raw `{free:null}`, Premium absent in catalog and allowed/unlimited fallback in legacy helper. Storage248→278; helper33 unchanged. Future explicit Premiumnull normalization remains owner decision.

Access-first migration hazards remain: Premium-minimum budget/history IDs coexist with finite Free limits; do not mechanically copy minimum tiers into a deny-before-quota policy. Unknown Premium helper behavior remains unchanged.

### Declared Free rights

All11 declarations preserved. Web lock/export gap text must be updated:

- **Lock:** sourcePartial imported-vault support now exists; whole “App lock” scope remains incomplete/unverified.
- **Export:** sourceImplemented for active dataset/transactions, with broader backup scope explicit.
- **Sync:** remains partial foreground/manual, not automatic sync.
- Encryption/deletion require bounded security statements; do not equate new lock helper tests with audited vault/UI behavior.

### Remaining IDs considered and unchanged

Existing source status/qualified observations remain for:

`import.statements`, `debt.planner`, `investments.insights`, `rewards.tracking`, `priorityFeedback`, `setup.wizard`, `setup.emailGuide`, `setup.extraEmails`, `setup.suggestions`, `setup.health`, `mailSync.imap`, `mailSync.statementPasswordKeychain`, `mailSync.background`, `privacy.mode`, `privacy.shake`, `privacy.autoHide`, `privacy.widgetMask`, `review.widget`, `badges.core`, `badges.cabinet`, `badges.share`, `badges.themes`, `badges.animatedFrames`, `nudges.core`, `nudges.tone.hype`, `nudges.tone.roast`, `nudges.notifications`.

This27-ID set plus the16 affected IDs above accounts for all43 once. Their existing primary structured evidence anchors continue to resolve except the moved/replaced anchors explicitly listed above. Important bounded qualifications:

- New History allocation uses privacy masking, but does not implement a Web widget. `privacy.widgetMask` stays configuration-only `sourcePartial`.
- Today’s Sunday/freshness/card-payment/quest rows are in-app UI, **not** `review.widget` or `nudges.notifications`.
- New Owed calculations do not establish a change to gated `debt.planner`.
- Existing investments page remains accounts/SIPs/DataGate limited; new generic net-worth history does not fix depository-only investments gating.
- Existing badge themes absence is unchanged.
- IMAP, statement password keychain, background sync remain notFoundInAudit in Web.

### Exact structured-anchor refresh list

Primary feature evidence changes required:

- `security.encryption`: old vault47 needle now vault108, or stronger dataset encryption vault116.
- `security.lock`: old vault4 planned-passphrase needle **removed**; replace with actual scoped lock anchors77/98 and DataState170/171.
- `data.export`: catalog15 absence anchor must be replaced by export4/profile146/151.
- `setup.freshnessReminders`: catalog30 absence anchor replaced by FreshnessReminder43/setup335.
- `budgets.unlimited`: DataState98→116, needle unchanged.
- `history.full`: History12→18; new scope anchor23 required.
- `review.inbox`: review158→170, needle unchanged.

Quota evidence moves:

- Budget count/lines save98→116.
- History limit12→18, prior balance-history14→20, add limited worth23.
- Gmail find169→178.
- Merchant-rule write248→278.

Notes referring to helper/UI lines should also be updated, notably vault encryption/save47/52/69→108/113/130, deletion96→157, DataState deletion119→137, Shell MOBILE35→37, Overview18→19, HistoryView9→15, ReviewParts Sunday47→79, WorthItCard63→126, ThemeV2 MoodGrid130→177, profile payments119→137.

### Uncovered functionality: explicit catalog gaps, no added IDs

- **Ask Lakshly**: local arithmetic/questions; separate hardcoded quota10Free/100Premium per month, outside shared43catalog. `apps/web/lib/ask.ts:6` explicitly says not shared catalog; `:7`: `export const ASK_LIMIT = { free: 10, premium: 100 } as const;`; `apps/web/app/ask/page.tsx:24` uses plan/cap, `:35` prospective count. Do not map this to `nudges.core` or invent an ID.
- **Owed to you**: refund/reversal view, family liabilities and user-copied complaint draft. `apps/web/app/owed/page.tsx:14` view; `:27` draft; `:30` clipboard action. No matching shared ID; no external sending action.
- **3-day wait quest**: persisted review quest/start/clear and Today completion UI. `apps/web/lib/review.ts:312` startQuest, `:317` clearQuest; `ReviewParts.tsx:158` start; `TodayCard.tsx:31` clear. Related to WorthIt but not equivalent to its rating entitlement.
- **Liquid-glass level preference**: `ThemeV2.tsx:141`, `apps/web/lib/glass.ts:3` preference key. Not an entitlement ID; do not infer Premium eligibility.
- **Island storyboard/film pages**: `apps/web/app/island/page.tsx:144` `export function IslandBoard({ filmOnLoad = false }...)`; no matching43feature. Visual/demo source presence is not experimental private support or release approval.
- **TodayCard** is a composition surface (`TodayCard.tsx:9`), not an OS widget or new shared quota itself.
- Card payment reminder is currently explicitly **consuming `credit.insights`**, unlike these ungated/unmapped additions; document that observed gate without adding a separate ID.

### Test source evidence, not pass results

Present newer source tests include:

- `apps/web/tests/export.test.ts:7`: dataset JSON/synthetic flag; `:15`: CSV paise/escaping; `:27`: no network calls.
- `apps/web/tests/vault-lock.test.ts:5`: key wrap/unwrap/wrong password helper; **not vault migration, app locking, all-provider clearing or security audit**.
- `apps/web/tests/net-worth-history.test.ts:14`, `:22`: arithmetic/time ordering; **not entire history quota enforcement**.
- `apps/web/tests/edition-plan.test.ts:5`: Beta defaultPremium/explicitFree; `:12`: public defaultFree/chosenPremium.
- `apps/web/tests/review.test.ts:255`: Sunday reminder helper; `:271`:3day quest.
- `apps/web/tests/setup.test.ts:202`, `:217`: due statements and same-tab Gmail notice.
- `apps/web/tests/card-due.test.ts:5`, `:13`, `:18`: due window/rollover/clamping.
- `apps/web/tests/gmail.test.ts:13`: pane reset/disconnect consent.

No tests were executed by this audit, so no new runtime/test-pass claim is warranted.

### Actual read-only command patterns and outcome

- `git diff --name-only 2d79390... 779f9130... -- apps/web` via argument array: identified bounded changed paths.
- `git show 779f9130...:<path>` via argument arrays: numbered actual pinned content for source/tests.
- `git diff --unified=1 2d79390... 779f9130... -- <bounded path>`: checked Identity/ThemeV2/charts deltas.
- Parsed current proposal JSON read-only and searched every existing Web evidence needle against pinned source, identifying moved/deleted anchors.
- `git grep -n -E 'mailSync\.(connect|imap|background|statementPasswordKeychain)|review\.widget|badges\.themes|nudges\.notifications|privacy\.widgetMask' 779f9130... -- apps/web/app apps/web/components apps/web/lib ':(exclude)*.gen.ts'`: exit1/no direct ID consumers, consistent with existing qualified gaps.
- `rg -n` over captured pinned Gmail/glass/test/UI content: extracted exact test/operation evidence; no workspace edits.

No release decisions, runtime verification, private inspection, billing verification or guaranteed vault-security claims were made.
