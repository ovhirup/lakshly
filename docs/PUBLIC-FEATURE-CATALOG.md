# Public feature catalog: review proposal

This proposal inventories public source at pinned commit
[`2d79390e04196acc98ac67eb3be27004bcd64914`](https://github.com/ovhirup/lakshly/tree/2d79390e04196acc98ac67eb3be27004bcd64914).
It changes no app, helper, shared catalog, feature policy, or release eligibility.
The [JSON review inventory](public-feature-catalog.proposal.json) preserves every
legacy feature object and its optional raw keys. It is not an executable policy.

The supplied audits covered public Web app/components/lib and relevant public
Apple app/tests/project metadata. iPhone and Mac share application source, with
form-factor adaptations: setup is full screen on iPhone and a separate Mac window;
widgets, menus, alternate icons and Live Activities have separate platform paths.
This does not prove runtime or visual parity. Runtime evidence was not reverified;
private source/authentication, external implementations and deployed environment
state were not inspected. Unmerged Cursor drafts are outside this pinned inventory.

There are three separate questions: **declared access**, **source implementation**,
and **release approval**. Eleven Free rights and finite allowances remain declared
intent even when implementation is incomplete. `sourceImplemented` means concrete
source exists, with qualifications in the JSON notes; it is only an evidence-review
candidate. `sourcePartial`, `sourceStub`, and `notFoundInAudit` require implementation
or scope decisions. Bounded absence never means a private/external implementation
cannot exist. A catalog declaration anchor is not implementation evidence.

All 258 platform/channel approval fields remain **pending**, including candidates.
Source implementation alone establishes neither test coverage, security readiness,
purchase readiness, device behavior nor Beta/Stable eligibility. Both channels are
reviewed independently on each platform. No policy-version/release availability
records are introduced in this inventory.

## Forty-three features across three platforms

<!-- feature-matrix:start -->
| Feature ID | Legacy minimum | Free right | Web source | iPhone source | macOS source | Beta / Stable |
| --- | --- | --- | --- | --- | --- | --- |
| core.tabs | free | yes | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| import.statements | free | yes | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| security.encryption | free | yes | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| security.lock | free | yes | sourceStub | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| data.delete | free | yes | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| data.export | free | yes | notFoundInAudit | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| themes.premium | premium | no | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| budgets.unlimited | premium | no | sourcePartial | sourcePartial | sourcePartial | pending / pending on all platforms |
| budgets.lines | free | no | sourceImplemented | sourcePartial | sourcePartial | pending / pending on all platforms |
| history.full | premium | no | sourcePartial | sourcePartial | sourcePartial | pending / pending on all platforms |
| debt.planner | premium | no | sourceImplemented | sourcePartial | sourcePartial | pending / pending on all platforms |
| credit.insights | premium | no | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| investments.insights | premium | no | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| rewards.tracking | premium | no | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| priorityFeedback | premium | no | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| setup.wizard | free | yes | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| setup.emailGuide | free | yes | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| setup.extraEmails | free | no | sourceImplemented | sourcePartial | sourcePartial | pending / pending on all platforms |
| setup.suggestions | free | no | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| setup.health | free | no | sourceImplemented | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| setup.freshnessReminders | premium | no | notFoundInAudit | sourceStub | sourceStub | pending / pending on all platforms |
| mailSync.connect | free | yes | sourcePartial | sourceStub | sourceStub | pending / pending on all platforms |
| mailSync.imap | free | no | notFoundInAudit | sourceStub | sourceStub | pending / pending on all platforms |
| mailSync.statementPasswordKeychain | free | no | notFoundInAudit | sourceStub | sourceStub | pending / pending on all platforms |
| mailSync.background | premium | no | notFoundInAudit | sourceStub | sourceStub | pending / pending on all platforms |
| privacy.mode | free | yes | sourceImplemented | sourcePartial | sourcePartial | pending / pending on all platforms |
| privacy.shake | free | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| privacy.autoHide | free | no | sourceImplemented | sourcePartial | sourcePartial | pending / pending on all platforms |
| privacy.widgetMask | free | no | sourcePartial | sourceImplemented | sourceImplemented | pending / pending on all platforms |
| review.inbox | free | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| review.merchantRules | free | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| review.reminder | free | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| review.widget | free | no | notFoundInAudit | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| review.worthIt | free | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| badges.core | free | yes | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| badges.cabinet | free | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| badges.share | free | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| badges.themes | premium | no | notFoundInAudit | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| badges.animatedFrames | premium | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| nudges.core | free | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| nudges.tone.hype | free | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| nudges.tone.roast | premium | no | sourceImplemented | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
| nudges.notifications | free | no | notFoundInAudit | notFoundInAudit | notFoundInAudit | pending / pending on all platforms |
<!-- feature-matrix:end -->

The JSON includes pinned literal evidence needles and full audit qualifications for
all 129 observations. Important qualifications include Web browser-vault protection
against casual profile access, not origin code; blocked IndexedDB deletion remains
unverified; budget persistence lacks caps; Web investments are data-gated and do not
establish depository-only holdings; feedback priority metadata does not establish
service response priority; Web shake masking needs device capability/permission.
Apple debt payoff what-ifs are partial, general privacy masking is partial, and
mail/reminder tier declarations are stubs rather than live transports/schedulers.

## Eleven preserved Free rights

- `security.lock`
- `security.encryption`
- `import.statements`
- `core.tabs`
- `data.delete`
- `data.export`
- `setup.wizard`
- `setup.emailGuide`
- `mailSync.connect`
- `privacy.mode`
- `badges.core`

Web lock is planned/stubbed; dataset export was not found on any audited platform;
Web mailbox sync is only partial foreground, read-only Gmail, while Apple connectors
remain inactive. These gaps do not revoke declared Free rights. Do not convert a
catalog promise into an available feature or weaken rights to hide incomplete work.
See [freeRights](#decision-freeRights) and [releaseEvidence](#decision-releaseEvidence).

## Six quota reviews

<!-- quota-matrix:start -->
| Feature ID | Raw legacy limits | Web enforcement | iPhone enforcement | macOS enforcement | Pending decisions |
| --- | --- | --- | --- | --- | --- |
| budgets.unlimited | `{"free":1,"premium":null}` | noGuardFound | noGuardFound | noGuardFound | budgets, releaseEvidence |
| budgets.lines | `{"free":6,"premium":null}` | sourceUIOnly | sourceUIOnly | sourceUIOnly | budgets |
| history.full | `{"free":12,"premium":null}` | noGuardFound | noGuardFound | noGuardFound | history, releaseEvidence |
| setup.extraEmails | `{"free":3,"premium":10}` | sourceOperationGuard | sourceUIOnly | sourceUIOnly | extraEmails |
| mailSync.connect | `{"free":1,"premium":5}` | noGuardFound | noGuardFound | noGuardFound | mailboxes, nativeChannels, freeRights |
| review.merchantRules | `{"free":null}` | noGuardFound | notApplicablePendingDecision | notApplicablePendingDecision | merchantRules |
<!-- quota-matrix:end -->

These are source observations, not newly verified operation guarantees.
`sourceOperationGuard` records a source input/reducer guard; `sourceUIOnly` records
presentation/suggestion limits with save gaps; `noGuardFound` records the bounded
audit result; `notApplicablePendingDecision` records an unimplemented scope awaiting
a decision. None grants release readiness.

### budgets.unlimited

Pending: grouped budget sets/months versus category records. Legacy minimum Premium coexists with Free allowance 1; availability-before-access migration must preserve finite Free use. Grouping is not yet approved.

web: Month/category lines are retained across months; no budget-count limit consumer or save guard was found. iphone: Saving accepts multiple month sets, no tier-dependent budget-count restriction. macos: Saving accepts multiple month sets, no tier-dependent budget-count restriction.

Decisions: [budgets](#decision-budgets), [releaseEvidence](#decision-releaseEvidence).

### budgets.lines

Category lines per budget (subject to owner approval). Generated allowance tables alone do not guard save operations; retain Free six and review Premium unlimited without treating a UI cap as full enforcement.

web: Budget display slices allowance and setup suggestions/addition are bounded; persistence itself lacks a cap. iphone: Starter hard-caps six for every tier; budget save lacks a tier guard and Premium-unlimited distinction. macos: Starter hard-caps six for every tier; budget save lacks a tier guard and Premium-unlimited distinction.

Decisions: [budgets](#decision-budgets).

### history.full

Pending: calendar window versus display versus retention. Premium minimum plus Free 12 allowance cannot be copied mechanically into an access-first evaluator. Do not silently hide/delete imported history; calendar, display and retention decisions remain pending.

web: Free 12/Premium unlimited text exists, but all transactions feed history without display or retention cap. iphone: All transaction months are displayed; no Free 12-month boundary or Premium gate. macos: All transaction months are displayed; no Free 12-month boundary or Premium gate.

Decisions: [history](#decision-history), [releaseEvidence](#decision-releaseEvidence).

### setup.extraEmails

Pending: extra addresses beyond primary versus total saved addresses. Same raw 3/10 has different units across platforms. Align units and separate UI controls from reducer/save-path enforcement before migration.

web: UI adds one to 3/10 extra allowance and dispatches a reducer input cap. These are manual-search addresses, not connected mailbox accounts. iphone: Add control checks total count; reducer/session save path lacks a quota guard. macos: Add control checks total count; reducer/session save path lacks a quota guard.

Decisions: [extraEmails](#decision-extraEmails).

### mailSync.connect

Pending: active connected mailbox count and operation scope. 1/5 limits and generated tables do not establish live/native/background sync or operation-level multi-mailbox enforcement.

web: User-triggered read-only foreground search/import is partial sync; no multi-mailbox allowance consumer or operation-level count enforcement. iphone: Tier limit exists but no active connector checks prospective count. Consent saves a manual-search email; reducer can append without quota checks. macos: Tier limit exists but no active connector checks prospective count. Consent saves a manual-search email; reducer can append without quota checks.

Decisions: [mailboxes](#decision-mailboxes), [nativeChannels](#decision-nativeChannels), [freeRights](#decision-freeRights).

### review.merchantRules

Unique normalized merchant rules (subject to owner approval). Raw limits preserve only free:null; Premium is absent, not zero or an implicit new null. Recommend explicit future Premium-null normalization pending approval to preserve legacy unlimited behavior.

web: Rule map persists/overwrites keys; no finite cap. Legacy Premium falls back to allowed/unlimited. iphone: No Apple feature/model/editing/enforcement found; this is bounded absence, not a claim of unsupported private/external implementations. macos: No Apple feature/model/editing/enforcement found; this is bounded absence, not a claim of unsupported private/external implementations.

Decisions: [merchantRules](#decision-merchantRules).

## Nineteen Apple aliases

<!-- apple-alias-matrix:start -->
| Apple case | Raw value | Current tier | Canonical ID | Proposed ID | Mapping |
| --- | --- | --- | --- | --- | --- |
| premiumThemes | premiumThemes | premium | themes.premium | none | mapped |
| debtPlanner | debtPlanner | premium | debt.planner | none | mapped |
| creditInsights | creditInsights | premium | credit.insights | none | mapped |
| investmentInsights | investmentInsights | premium | investments.insights | none | mapped |
| rewardsInsights | rewardsInsights | premium | rewards.tracking | none | mapped |
| priorityFeedback | priorityFeedback | premium | priorityFeedback | none | mapped |
| basicWidgets | basicWidgets | free | none | widgets.basic | ownerDecisionRequired |
| extraWidgets | extraWidgets | premium | none | widgets.extra | ownerDecisionRequired |
| importStatements | import.statements | free | import.statements | none | mapped |
| setupWizard | setup.wizard | free | setup.wizard | none | mapped |
| setupEmailGuide | setup.emailGuide | free | setup.emailGuide | none | mapped |
| setupExtraEmails | setup.extraEmails | free | setup.extraEmails | none | mapped |
| setupSuggestions | setup.suggestions | free | setup.suggestions | none | mapped |
| setupHealth | setup.health | free | setup.health | none | mapped |
| mailSyncConnect | mailSync.connect | free | mailSync.connect | none | mapped |
| mailSyncIMAP | mailSync.imap | free | mailSync.imap | none | mapped |
| mailSyncStatementPasswordKeychain | mailSync.statementPasswordKeychain | free | mailSync.statementPasswordKeychain | none | mapped |
| mailSyncBackground | mailSync.background | premium | mailSync.background | none | mapped |
| setupFreshnessReminders | setup.freshnessReminders | premium | setup.freshnessReminders | none | mapped |
<!-- apple-alias-matrix:end -->

Seventeen cases have existing shared IDs. `basicWidgets` and `extraWidgets` describe
finance widgets, not `review.widget`'s review-count widget. `widgets.basic` and
`widgets.extra` are proposed names only: both canonical IDs remain null and neither
is added to the 43-feature catalog. Preserve the legacy cases/raw values/tiers in
an explicit compatibility extension until [widgets](#decision-widgets) is approved.

## Authority and migration limits

Pinned Web Beta forces Premium in local AppState; normal mode reads a local plan,
and profile copy says payments are not live. These are demo/simulation facts,
**not verified payment authority**. Public SuperUser/private authorization cannot
be inferred from them. Local app source and Debug/Release safeguards do not identify
a deployed native Beta channel or establish cross-platform subscription ownership.

Legacy unknown-map behavior denies Free but permits Premium. Web numeric limits
can be returned before access checking, preserving finite Free budget/history
allowances despite Premium minimum labels. The v1 reference proposals
[PR 36](https://github.com/ovhirup/lakshly/pull/36) and
[PR 39](https://github.com/ovhirup/lakshly/pull/39) are unwired and **not dependencies
of this main-based documentation branch**. Their stricter unknown/availability/time
rules require separate compatibility review; no reference files are recreated here.

The [Apple migration plan](APPLE-POLICY-MIGRATION.md) begins with compatibility
generation **after proposal review**, retaining behavior before context, time,
availability and operation-level changes. Approval of this inventory is not
approval to activate those later changes.

## Owner decisions

<a id="decision-widgets"></a>

### widgets — pending

Approve widgets.basic/widgets.extra, or retain a documented compatibility extension?

Recommendation: Review the two proposed names; preserve both Apple widget cases and tiers in an explicit compatibility extension until approved.

<a id="decision-budgets"></a>

### budgets — pending

What counts as a budget, and how do finite Free allowances survive migration?

Recommendation: Approve grouped budget/month and category-line units; preserve Free one-budget/six-line access rather than mechanically copying a Premium minimum tier.

<a id="decision-history"></a>

### history — pending

Is Free history a calendar window, display filter, or retention rule?

Recommendation: Define a reference window and display semantics separately; preserve imported data and avoid silent deletion.

<a id="decision-extraEmails"></a>

### extraEmails — pending

Do 3/10 allowances count extras or total addresses, and where is enforcement required?

Recommendation: Align on an explicit unit after reviewing Web 4/11 versus Apple 3/10 totals; add reducer/save-operation enforcement in a separate approved batch.

<a id="decision-mailboxes"></a>

### mailboxes — pending

Which mailbox operations are implemented, and what counts toward 1/5?

Recommendation: Decide foreground/manual versus active connected mailbox scope; do not promote inactive connectors based on a tier entry.

<a id="decision-merchantRules"></a>

### merchantRules — pending

Approve an explicit Premium null for merchant rules in a future normalized policy?

Recommendation: Preserve raw {free:null} now; future explicit Premium-null normalization should preserve legacy unlimited behavior only after approval.

<a id="decision-releaseEvidence"></a>

### releaseEvidence — pending

Which platform/channel rows can receive Beta or Stable approval, with what evidence?

Recommendation: Review each of 258 pending approvals using implementation, tests, security, purchase/device and deployment evidence; source presence alone grants none.

<a id="decision-freeRights"></a>

### freeRights — pending

How should incomplete declared Free rights, including lock/export/sync, be completed?

Recommendation: Preserve all eleven declared rights and implement or honestly scope their gaps; do not weaken the rights to hide incomplete functionality.

<a id="decision-storeKitTime"></a>

### storeKitTime — pending

How should StoreKit start dates, fractional seconds, expiry equality and cached state be adapted?

Recommendation: Approve timestamp reduction and boundary fixtures separately; do not choose floor/round, start mapping or offline grace implicitly.

<a id="decision-nativeChannels"></a>

### nativeChannels — pending

What identifies Public Beta/Stable on native targets and establishes trusted authority?

Recommendation: Define explicit distribution/channel identity orthogonal to Debug/Release; verified purchases remain separate from demo flags and private authorization.

## Read-only verification

```sh
node --check docs/scripts/check-public-feature-catalog.mjs
node docs/scripts/check-public-feature-catalog.mjs
git diff --check
```

The checker validates exact shapes, pinned declarations/bytes/lines, preserved
rights/limits/aliases, pending approvals, and the three deterministic matrices.
`--proposal <path>` supports isolated malformed copies without changing this
proposal. No application tests or builds need rerunning for this documentation-only
batch; application/runtime readiness remains a later evidence gate.
