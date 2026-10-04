# Lakshly handoff

Public status for the two agents on this repo. No private data, no account numbers, and no amounts.

Owners: **Cursor** (`cursor/<topic>`, web, site, workers, web CI) and **Codex** (`codex/<topic>`, Apple, parsers, Apple CI). Shared contracts in `packages/shared` and `packages/schema` need a CLAIM line here before either agent edits them. `sync/handoff` is fast-forward only.

## Now (claims)

- **Cursor:** Beta Free/Premium tester switch on `cursor/beta-plan-switch` (draft PR 43, base `web/beta`). Also drafted: PR 42 data export, PR 41 Gmail disconnect. Still open and green or in CI: PRs 35, 37, 38, 40. Not touching Codex's feature-policy files. No merges until Abhirup says so. Codex resumes after 19:37 IST.
- **Codex:** Completed public feature inventory and staged Apple migration proposal in draft PR 59 (`codex/public-feature-catalog`, head `7bf0ef7`, base `main`), pinned to audited public source `2d79390`. No active writer; proposal claim released. PRs 36/39 remain unwired foundations. Newer-source refresh and compatibility-only Apple generation follow owner review in separate scopes; no shared catalog/helper/app activation. PRs 30/32/33 remain separate review items.

## Cursor status

- **Done:** #29 merged into `web/beta` as `afee887` (4 Oct 2026, 15:01 IST), including #31. Chromium shows `blur(24px)` on quiet cards and `blur(20px)` on the sidebar. Hero blur stays none. Safari was not launched.
- **Done:** Checked https://beta.lakshly.com on 4 Oct 2026, 15:19 IST. The CSS includes #29 (`blur(24px)`, webkit property first, `lotusGlass`, `beta-ribbon`). The HTML is the public edition: title is not "Lakshly Beta", and `data-edition` is never set, so Theme v2 and the Gmail card stay off. Gmail unit tests: 14 passed. Live privacy page matches the browser-only Gmail claims. No Google secret used. No live mailbox sign-in.
- **Next:** A beta rebuild needs `NEXT_PUBLIC_LAKSHLY_EDITION=beta` on the Cloudflare Pages project, then a redeploy. That waits on Abhirup. After the beta UI is actually live, he still needs to retry connect and the CAS password as a Testing-mode user.
- **Blockers:** Cloudflare env/redeploy, and his Gmail retry. Do not merge `web/beta` into `main` until he says so.

## Codex status

- Done: CAS identity repair merged into `web/beta` via PR 28; Overview PR 30 is ready for review with green checks; glass blur fix PR 31 is merged into Cursor's branch.
- Done, pending review: Apple CI PR 32 to `main`, head `afd3156`. Hosted run 37189181792 passed: iOS 111 tests / 2 skips / 0 failures; macOS 105 tests / 8 skips / 0 failures. Both platforms generated synthetic fixtures, preserved committed expected results, and uploaded test bundles.
- Coverage limits: two opt-in render tests skipped on each platform; six macOS StoreKit session tests also skipped under the existing compatibility helper. All ten iOS StoreKit methods passed. macOS purchase flows, normal scene/menu runtime behavior, visual parity, and private editions remain unverified. A CI-only Debug host isolates macOS unit tests from the observed scene/menu startup loop; its production cause remains unresolved.
- Done: owner-authorized six-version public-source audit and architecture proposal, draft PR 33 at `1fe183b`; two independent platform audits and advisor review passed. This is documentation, not implemented access or release policy.
- Done: draft PR 36 at `3b87a4c` adds the unwired feature-policy v1 contract, strict schema/runtime validation, and synthetic cases. Independent gate and advisor review passed: 156 shared tests, typecheck and whitespace checks; 54 literal decisions also matched an independent integer model. No production catalog or application consumer was changed.
- Done: stacked draft PR 39 at `80ea6ee` generates 11 Swift models and 10 enums, plus an explicitly authored reference adapter. Independent gate and advisor review passed: 54 original literal decisions and 38 additional mutation decisions match TypeScript/Swift; numeric, malformed transport, required-null round-trip, immutability, and drift checks passed. Shared tests remain 156 passing; typecheck/whitespace passed. C1 schema/evaluator/types/fixtures/tests are byte-identical. Only the headless Foundation/CoreFoundation CLI ran.
- Done: draft PR 59 at `7bf0ef7` adds the four-file public feature inventory and staged Apple migration proposal. Pinned source `2d79390`: 43 features / 129 platform observations / 258 pending release approvals; 19 Apple aliases (17 mapped, two widget decisions); 11 preserved Free rights and six raw quota reviews. Independent checker, seven rejection cases, citation/scope/hash/whitespace gate and final advisor review passed after one four-citation repair. Runtime and newer-source behavior were not reverified.
- Next: owner review PRs 33/36/39/59 and the ten catalog decisions, then separately claim a newer-source refresh and compatibility-only Apple generation. Full policy activation, trusted purchase/time mapping, quota guards, native channels and private authorization remain separate scopes. PRs 30/32 remain owner review items; their latest merge state is not reverified by this documentation batch.
- Boundaries: no web or private-edition edits, branch reconciliation, or feature merges in the Apple CI batch. No real financial data, Gmail account, Google client secret, local app, or simulator was used.
- Local-only work: `notch-panel`, uncommitted `apple-feedback`, and archived `codex/cas-import-success-message` remain **local only, keep** pending explicit rescue decisions. Local integration work is also preserved. Private source was not accessed.

## Product model (owner clarification, October 4)

Desired product structure: two suites across Web, macOS, and iPhone, yielding six platform versions. Public Beta is a release/testing channel within the public suite, rather than a separate suite. Native beta builds are needed alongside Web Beta to verify native behavior; their implementation and distribution are not yet verified here.

- Private / SuperUser: all feature access unlocked for authorized private users, across all three platforms. New experimental features are tested here first. Public entitlement controls must remain intact; this intent does not authorize an unrestricted public bypass.
- Public: stable functionality with Free and Premium access on all three platforms.
- Design parity: matching visual language and feature behavior, adapted to desktop and phone layouts and appropriate native controls. Pixel-identical screens across different form factors are not a coverage claim.
- Proposed release path: eligible experiments move from Private to Public Beta to Public Stable after verification; private-only features remain private.
- Suite, public entitlement tier, and release channel must be separate concepts. Test data and sandbox purchases stay separate from real user data. Per-platform unit, integration, entitlement, and visual checks are still required; a Web Beta pass does not verify native builds.

Initial public-source observations at Apple CI head `afd3156` (not a private-suite audit):

- `packages/shared/entitlements.json` already defines feature minimum tiers and limits; the Web gate consumes generated data from it.
- `apps/apple/Lakshly/Store/Entitlements.swift` still contains a manually maintained public feature map; its comments defer shared-map generation and a SuperUser edition flag. Cross-platform catalog parity is therefore a concrete follow-up.
- `apps/web/lib/entitlements.ts` explicitly describes Web Premium as a demo plan toggle until verified purchases exist. Public Stable purchase enforcement needs verification/implementation before it can be claimed ready.
- The current access catalog does not establish experimental/beta/stable availability or native beta distribution. Those remain separate design and verification tasks.

Setup sequence requested by the owner: audit existing versions/access/data/channels; define one feature catalog; verify SuperUser and public Free/Premium boundaries and platform parity; establish promotion gates; then consider AI orchestration. The need and extent of an overhaul remain to be assessed.

Future deterministic outcome engine: versioned explicit rules evaluate inputs and verification evidence consistently, with an explanation of each decision. AI agents may propose changes and collect evidence; release and access decisions must obey the defined rules and required owner authority. This engine is a future design request, not implemented or scheduled work.

This records product intent and gaps, not completed implementation. Private source remains outside this public repository and is not accessed by the Apple CI task.

The detailed audit and proposed sequence are in [draft PR 33](https://github.com/ovhirup/lakshly/pull/33), `docs/SUITE-ARCHITECTURE.md`. Updated Web Beta baseline `afee887` forces Premium, so normal Beta controls cannot currently exercise Free. Existing Web/Apple tier helpers also allow Premium for unknown/missing access keys; the proposed availability contract separately denies unknown, unsupported, private, or unreleased public capabilities. These observations are source evidence, not new runtime tests.

## Parity

Coverage columns represent six suite/platform versions, with Public Web split into Beta and main. Native beta channels are not yet represented or verified separately. Private web is not in this repo (parity debt only).

| Feature | Private web | Web beta | Web main | Public Mac | Public iPhone | Private Mac | Private iPhone |
|---|---|---|---|---|---|---|---|
| Setup wizard | debt | done, with Gmail step | done | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Theme v2 + Lotus Glass | done (not in git) | polish merged (#29) | not on main | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Liquid Glass slider | done (not in git) | draft PR 40 | no | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Gmail connect | n/a | code on beta, Testing mode | not on main | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Tester name | n/a | done | todo | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| CDSL/NSDL CAS | debt | done (#25, #28); #30 open | parser via #24 | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Net worth over time | done (not in git) | draft PR 35 | todo | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Owed-to-me tracker | done (not in git) | draft PR 37 | todo | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Notch panel part 2 | n/a | n/a | n/a | built locally, not on GitHub | Not applicable | Edition unverified | Not applicable |
| Apple CI | n/a | n/a | n/a | PR 32 green: 105 tests, 8 skips; not merged | PR 32 green: 111 tests, 2 skips; not merged | Outside public CI | Outside public CI |
| iPhone Duo | n/a | n/a | n/a | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Ask Lakshly | not started | draft PR 38 | todo | Edition unverified | Edition unverified | Edition unverified | Edition unverified |

Inherited aggregate Apple statements from Cursor's snapshot (reported, not independently verified per edition):

- Setup wizard: public Apple — done (#24); email step not switched on; private Apple — local build only.
- Theme v2 + Lotus Glass: public Apple — not started; private Apple — not started.
- Liquid Glass slider: public Apple — no; private Apple — no.
- Gmail connect: public Apple — stub; private Apple — unknown.
- Tester name: public Apple — todo; private Apple — stays SuperUser.
- CDSL/NSDL CAS: public Apple — Swift port in #24; private Apple — unknown.
- Net worth over time: public Apple — todo; private Apple — todo.
- Owed-to-me tracker: public Apple — todo; private Apple — todo.
- Notch panel part 2: public Apple — built locally, not on GitHub; private Apple — local build only.
- iPhone Duo: public Apple — spec only; private Apple — todo.
- Ask Lakshly: public Apple — todo; private Apple — todo.

## Open PRs

| PR | Branch | Base | Waits on |
|---|---|---|---|
| #30 | `codex/cas-overview` | `web/beta` | Ready for review; green CI and synthetic browser check; owner screenshot/merge approval pending. |
| #32 | `codex/apple-ci` | `main` | Head `afd3156`; both hosted unit jobs green with documented skips; Ready for review after independent approval; owner merge approval pending. |
| #33 | `codex/suite-release-model` | `main` | Draft proposal at `1fe183b`; documentation checks and advisor review passed; owner policy review. No implementation or external change. |
| #36 | `codex/feature-policy-v1` | `main` | Draft unwired contract at `3b87a4c`; 156 tests, typecheck, independent gate and review passed. Consumer integration and merge remain separate. |
| #39 | `codex/feature-policy-swift` | `codex/feature-policy-v1` | Stacked draft at `80ea6ee`; 54+38 decision parity, generation/drift, transport/null checks, 156 shared tests, independent gate and review passed. Unwired; merge/activation separate. |
| #59 | `codex/public-feature-catalog` | `main` | Draft historical proposal at `7bf0ef7`, source pinned `2d79390`; four docs/checker files, independent gates and review passed. Owner decisions, newer-source refresh and Apple compatibility batch remain separate. Hosted preview was in progress at publication. |

#29 merged into `web/beta` at `afee887`. #31 was already merged into #29.

`main` is `2d79390`, including the Cursor/owner merge of `web/beta` via PR 34. `web/beta` remains `afee887`. Published branches must not be rebased. The inherited parity table above predates that merge; code present on `main` still needs edition/channel-specific verification before it counts as public behavior.

Codex public-ref observation at 20:22 IST: `main` advanced to `6cb2da3` and `web/beta` to `ca9833c` through separately merged Cursor work. The paragraph and parity table above record an older baseline. PR 59 deliberately remains the source-only audit snapshot at `2d79390`; it does not describe newer implementations or deployment. Cursor claim/status/log wording is preserved for its owner to update.

## Local only, keep

These are not on GitHub. Do not delete, reset, or clean them.

- `notch-panel` (worktree `~/dev/lakshly-notchpanel`): public notch part 2. Codex pushes only after Abhirup says yes.
- Uncommitted Apple feedback parity in `~/dev/lakshly-feedback`. Codex commits only after Abhirup says yes.
- `codex/cas-import-success-message` in Codex's clone.
- Private Mac/iPhone app: local only, no commits. Never copy it into this repo.

## Questions for Abhirup

1. Done: #29 is on `web/beta`. Redeploy beta.lakshly.com from that branch?
2. May #30 and #32 merge?
3. Done: Cursor merged `web/beta` into `main` via PR 34 at `2d79390`; beta-only behavior stays behind the edition flag.
4. Did Gmail connect work for the Testing-mode test users, and did the CAS password retry succeed?
5. May Codex push notch-panel and the Apple feedback work? Should the private Apple app get a private GitHub repo?
6. Has the retired OAuth client secret been deleted in Google Cloud? Do not paste the secret here.

## Nightly sync

Owner-approved automation `lakshly-nightly-handoff-sync`: 21:00 IST, October 4–10; at most seven runs, stopping earlier after three consecutive unchanged runs. Doc-only, public-safe coordination; quiet unless meaningful progress, failure, or an owner decision is needed. Scheduled runs completed: 0; consecutive unchanged scheduled runs: 0.

## Log

### 2026-10-04 (Cursor)

Opened `sync/handoff` from `main` at `cb58f9f`. Fast-forwarded #29 from `44cf675` to `9cc9024` (Codex's blur-order fix).

### 2026-10-04 (Codex)

- Adopted the owner-authorized handoff and started Apple CI on `codex/apple-ci` from `main` at `cb58f9f`.
- Confirmed that `sync/handoff` did not exist; initialized this public-safe document and the Codex claim. No shared contracts or Cursor files were changed.
- PR 30 remains draft with green checks. GitHub recheck shows PR 31 merged into Cursor's branch, with PR 29's updated head `9cc9024` green and still draft.
- Local-only public work is marked keep. No private source, finance data, GUI app, or simulator was opened.
- Created the owner-approved nightly handoff automation with the seven-run limit and three-unchanged-run stop condition. Its first run is scheduled for October 4 at 21:00 IST.

- Cursor created this shared branch concurrently; combined the doc-only histories without rebasing or overwriting Cursor's status or log.

### 2026-10-04, 14:41 IST (Codex)

- Completed Apple CI repairs on PR 32 at `afd3156`; hosted run 37189181792 is green with actual iOS/macOS counts and known coverage gaps recorded above. No feature branch was merged.
- PR 30 is ready for review; existing Cursor status and log were preserved.
- Owner clarified six platform versions: Private/SuperUser and Public, each on Web, macOS, and iPhone. SuperUser has unlocked feature access for authorized private users and receives experiments first. Public Beta is a testing channel. Recorded setup gaps and the future AI orchestration / deterministic decision-engine intent; no private source or shared contract was edited.
- Nightly handoff schedule remains seven runs, October 4–10 at 21:00 IST, stopping earlier after three unchanged runs. Zero scheduled runs have completed as of this entry.

### 2026-10-04, 15:01 IST (Cursor)

Merged #29 into `web/beta` as `afee887` after Abhirup's OK. Chromium blur is on for quiet cards and the sidebar. Safari was not launched. Next is the Gmail check, not a deploy.

### 2026-10-04 (Codex suite audit)

- Published draft PR 33, one documentation file, from `main` at `cb58f9f`. Audited Web Beta at `afee887` and attributed pending Apple CI evidence to `afd3156`.
- Recorded six suite/platform versions, separate Public Beta/Stable channels, SuperUser/private authority, access versus availability, shared generation, adaptive visual parity, data/distribution boundaries, release gates, and future deterministic evidence rules for bounded AI agents.
- The smallest proposed first batch is Beta Free/Premium testability, owned by Cursor. No Web/Apple code, catalog/schema, signing, billing, deployment, private source, or real data was changed. No app tests were rerun for this documentation task.
- Three delegated passes were used: two independent read-only platform audits and one advisor review, using three subagents. No new automation was created and no scheduled run has executed yet. Preserved Cursor's concurrent status, claim, and logs.

### 2026-10-04, 15:19 IST (Cursor)

beta.lakshly.com already has the #29 glass CSS, but the pages were built without the beta edition flag, so testers still see the public shell. Gmail connect code and the privacy page match; 14 synthetic Gmail tests passed. No redeploy and no live Google sign-in.

### 2026-10-04, 15:43 IST (Cursor)

Merged `web/beta` into `main` as PR 34, merge commit `2d79390`. Beta behaviour stays behind `NEXT_PUBLIC_LAKSHLY_EDITION`. Local web tests: 258 passed. Typecheck and a production build passed; the production HTML is still the public edition. GitHub checks were still running when the merge was accepted. The setup catalog stayed at main's 53 sources. The duplicated depository CAS adapter was removed.

### 2026-10-04 (Codex policy C1)

- Published draft PR 36 at `3b87a4c` from current public `main` at `2d79390`. Exactly six new shared policy files; no app, legacy entitlement, ledger schema, or private-source edits.
- Versioned deterministic availability/access evaluation uses explicit time, upstream-verified entitlement facts, Free fallback, private authority, and overflow-safe quotas. The catalog is synthetic and unwired.
- Independent gate: 156 tests passed (31 existing + 125 new), typecheck/whitespace checks passed; strict Ajv compiled nine definitions. All 54 literal decisions also matched an independent integer model. Advisor approved draft publication only.
- The next separately gated batch is generated Swift contract/reference parity within the claimed namespace on `codex/feature-policy-swift`, stacked on C1. No product app, simulator, private source, merge, or deployment is authorized by this batch.
- Preserved Cursor's History net-worth claim and all status/log entries. No direct message was sent to another chat. Zero scheduled nightly runs have executed.

### 2026-10-04 (Codex policy claim)

Owner authorized shared policy implementation. Claimed the new feature-policy namespace and its dedicated test file before any contract edits. Baseline shared checks passed: 31 tests, typecheck exit 0. Advisor is defining the bounded contract batch; private authorization and production billing/distribution are not implemented or inferred. No shared ledger schema or existing entitlement-map changes are claimed.

### 2026-10-04, 16:05 IST (Cursor)

Draft PR 35 adds month-end net worth and an allocation table on History, synthetic data only. Privacy mode keeps shares and hides rupees. Apple parity for this view is still owed.

### 2026-10-04, 16:25 IST (Cursor)

Draft PR 37 adds Owed to you: a summary of RBI's 20 September 2019 failed-payment turnaround times (not legal advice), a complaint that copies to the clipboard only, and a synthetic family loan counted as a liability. Web tests: 263 passed. Apple does not have this screen yet. PR 35 stays a separate draft. Both drafts edit `selectors.ts` and `globals.css`.

### 2026-10-04, 16:42 IST (Cursor)

Draft PR 38 adds Ask Lakshly. Answers come from the numbers already on the device, own arithmetic is marked my calc, and nothing is sent. Free is 10 questions a month; Premium demo is 100. Web tests: 262 passed. Apple does not have this screen yet. PRs 35 and 37 stay separate drafts.


### 2026-10-04 (Codex policy C2 complete)

- Published stacked draft PR 39 at `80ea6ee`, base `codex/feature-policy-v1` / PR 36. Exactly seven scoped paths; C1 contract bytes and all consumers remain unchanged.
- Schema-derived Swift models/constants and separately authored reference semantics passed 54 original literal cases and 38 mutation cases in both languages. Numeric parsing, malformed transport continuation, explicit-null Codable round-trip, immutability, and isolated drift rejection passed. Shared tests: 156 passed; typecheck/whitespace passed.
- Two advisor-directed generator repair cycles resolved implementation errors; an unrelated default module-cache denial was infrastructure and resolved using the authorized temporary cache. Independent verifier repeated the full final gate; advisor approved unwired draft publication. No third repair cycle.
- This policy work used 14 delegated passes across three reused subagents (advisor, executor, verifier). No new automation was created and zero scheduled runs have executed. No product app/simulator, private source, real statement/account, merge, or deployment was used.
- Released the active shared-file claim after publication. Approved real catalogs, application integration, upstream authority/payment verification, native channels, and visual/release gates remain separate work. Preserved all concurrent Cursor claims/status/logs.

### 2026-10-04, 16:50 IST (Cursor)

Draft PR 40 adds a beta Glass slider for card and navigation blur. The default matches the current 24px / 20px polish. Lotus Glass and the hero are unchanged. Web tests: 261 passed. Apple does not have this control yet. PRs 35, 37, and 38 stay separate drafts.

### 2026-10-04, 17:12 IST (Cursor)

PR 40's web build failed on a lint error in the slider, then passed after `9c6507e`. Classic and Lotus both follow the slider; Abhirup confirmed the look. Draft PR 41 returns Disconnect to the Gmail start screen instead of leaving the consent sheet open. Gmail tests: 15 passed. No shared policy files edited and nothing merged. Codex is paused until 19:37 IST.

### 2026-10-04, 17:25 IST (Cursor)

Draft PR 42 adds the free on-device JSON and transactions CSV download. Draft PR 43 lets beta testers switch to Free and keep that choice; beta still opens on Premium. Order of these drafts is not important. Nothing merged.

### 2026-10-04, 20:22 IST (Codex public catalog proposal complete)

- Published draft PR 59 at `7bf0ef7`, a four-file public feature inventory and staged Apple migration proposal, pinned to public main `2d79390`. All 43 legacy feature objects, 11 Free rights, six raw quota reviews, and 19 Apple aliases are preserved; two widget IDs remain pending. All 129 platform observations are source-only and all 258 release approvals remain pending.
- Executor and independent verifier passed syntax/checker/whitespace/scope/hash gates and independently rejected all seven malformed proposals. Final advisor approved documentation-only draft publication. One advisor-directed repair cycle corrected four explanatory citation paths; no classification or policy changed. App tests/builds were not needed. No app, shared catalog, helper, workflow, private source, real data, merge, or deployment was changed.
- During publication preparation, remote main advanced to `6cb2da3` and Beta to `ca9833c` through separately merged Cursor work. The proposal is explicitly the older pinned audit snapshot; it does not claim current implementation or deployed state. The legacy shared catalog and Apple entitlement helper remained unchanged across those public main heads. A newer-source refresh is separate work.
- Released the proposal claim after publication. Next is owner review of the ten recorded decisions and a separately scoped compatibility-only Apple generation batch. Full policy activation, time/StoreKit authority, operation guards and channel/distribution remain separately gated.
- This batch used nine delegated passes across five subagents: two bounded read-only inventories, advisor planning, one executor, independent verification, and advisor review, plus one executor/verifier/advisor repair pass. No new automation was created; zero scheduled nightly runs had executed before this entry. Preserved Cursor's claim/status/logs verbatim; no direct message to another chat.
