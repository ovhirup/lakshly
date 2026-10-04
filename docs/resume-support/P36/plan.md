PLAN P36-C1 — refresh the existing public feature proposal to a newer pinned source snapshot

This batch updates the four documentation files on `codex/public-feature-catalog` and draft PR 59. It preserves every pending policy decision and changes no application, entitlement helper, shared catalog, or release eligibility.

I read the original P35 plan, current documentation/checker, the complete P36 Web delta report, and the original scope manifest. The Web delta was audited independently; this plan relies on that report rather than repeating its inventory. The user’s supplied Stackwich instructions govern single-writer ownership, independent verification, and the two-cycle repair limit.

## Inputs and fixed references

Repository:

`/Users/abhirupbanerjee/Documents/ChatGPT/Lakshly/repo`

Published proposal head:

`7bf0ef74a7f5d8cbf1f87995cf2ef7c021ea4671`

Previous source snapshot:

`2d79390e04196acc98ac67eb3be27004bcd64914`

New source snapshot:

`779f9130e80adce66a1825212756d5f0acc8e677`

Required intact inputs:

- `/private/tmp/lakshly-P35-C1-plan.md`
- `/private/tmp/lakshly-P35-web-inventory.md`
- `/private/tmp/lakshly-P35-apple-inventory.md`
- `/private/tmp/lakshly-P36-web-delta.md`
- `/private/tmp/lakshly-P36-original-scope.json`

The P36 report supplies the qualified Web changes and exact source anchors. Resolve source through argument-array `git show <new-pin>:<path>`, never through the older working-tree app files. A subsequently advanced remote branch does not change this batch’s pin.

## Ownership and limits

The executor owns modifications to exactly:

1. `docs/public-feature-catalog.proposal.json`
2. `docs/PUBLIC-FEATURE-CATALOG.md`
3. `docs/APPLE-POLICY-MIGRATION.md`
4. `docs/scripts/check-public-feature-catalog.mjs`

Preserve existing untracked Web instruction files and concurrent work. Remain on the published proposal branch; do not merge, rebase, force-push, or update application source to the new pin.

No app, package, shared catalog/schema, helper, test, configuration, workflow, private-source, or Cursor-owned changes. No app tests/builds, installs, GUI launches, real accounts/statements, secrets, billing operations, deployment, or policy activation.

Root already published the ownership claim. Root handles normal signed-off publication after verification and advisor approval. Later catalog activation, Apple migration, merge, or deployment requires separately authorized scope; this batch does not perform those actions.

## Step 1 — verify the untouched inputs

Before edits:

```sh
git rev-parse HEAD
git status --short
git diff --exit-code \
  2d79390e04196acc98ac67eb3be27004bcd64914 \
  779f9130e80adce66a1825212756d5f0acc8e677 \
  -- apps/apple packages/shared/entitlements.json packages/schema
node --check docs/scripts/check-public-feature-catalog.mjs
node docs/scripts/check-public-feature-catalog.mjs
```

Expected:

- HEAD is `7bf0ef74a7f5d8cbf1f87995cf2ef7c021ea4671`.
- No existing tracked modifications; preserved untracked Web instructions remain.
- Apple/shared/schema comparison exits zero with no diff.
- Existing checker syntax and default verification exit zero.
- Existing counts are 43 features, 129 platform observations, 258 pending approvals, 19 aliases comprising 17 mapped and two pending, 11 Free rights, and six quota reviews.

Compare the four original file hashes with `/private/tmp/lakshly-P36-original-scope.json`. If the baseline has changed, stop and return the mismatch to root rather than adapting silently.

## Step 2 — refresh the JSON inventory

Preserve the existing JSON shape and version. Change only source metadata, qualified Web observations/evidence, affected Web release suggestions/rationales, and Web quota observations.

Set `sourceCommit` to the new full pin. Keep:

- `proposalVersion: 1`
- `kind: "public-feature-review-inventory"`
- `status: "pending-owner-approval"`
- `runtimeEvidence: "not-reverified"`
- `privateSuiteEvidence: "not-inspected"`

Preserve all 43 IDs and their order, complete `legacy` objects, `freeRight` membership, 11 rights, raw six quota declarations, 19 Apple aliases, policy-reference records, and all ten owner-decision records exactly.

The legacy catalog checksum remains:

`da4673a75251aa7dbe72f2f5cbc28b66c87ade176f5fb3debd440e91e785e2be`

Do not normalize the absent Premium merchant-rule limit. Do not add widget IDs or uncovered Web features to the catalog.

All iPhone/macOS feature observations, native quota observations, and Apple alias records remain byte-equivalent as JSON values to the published proposal. Their source files and lines are unchanged at the new pin.

### Three Web status changes

Apply precisely:

| Existing ID | New Web status | Required qualification |
| --- | --- | --- |
| `security.lock` | `sourcePartial` | Imported-vault passphrase locking exists. Demo, profile and navigation remain accessible; whole-app locking, clearing all sensitive provider state, and security readiness are not established. |
| `data.export` | `sourceImplemented` | Active dataset JSON and transaction CSV downloads exist. This is not a complete vault/UserData backup and does not establish restoration round-trip behavior. |
| `setup.freshnessReminders` | `sourceImplemented` | Premium in-app cadence notice, seven-day snooze, optional foreground check of an already connected Gmail tab. No push/background scheduler or verified Gmail authority. |

For lock, retain `holdForImplementationOrScopeDecision` for both channels under the unchanged “App lock” declaration. Replace the removed planned-passphrase evidence with actual scoped implementation and integration anchors from the report:

- `apps/web/components/VaultLock.tsx:43`
- `apps/web/lib/vault.ts:77`, `:98`
- `apps/web/components/DataState.tsx:79`, `:170`, `:171`

For export, use the actual exporter and gated profile action anchors:

- `apps/web/lib/export.ts:4`, `:15`
- `apps/web/app/profile/page.tsx:146`, `:151`, `:152`

For freshness reminders, use the mounted implementation and due-selection anchors:

- `apps/web/components/FreshnessReminder.tsx:43`, `:44`
- `apps/web/lib/setup.ts:335`
- `apps/web/components/TodayCard.tsx:36`

Copy literal evidence needles from the pinned lines. The report’s quoted snippets or relevant full pinned line can be used; do not fabricate a needle from prose.

Export and freshness become `evidenceReviewCandidate` for both Beta and Stable. Their rationales must retain the bounded scope and source-only limitations. Every approval remains `"pending"`.

All other Web source statuses remain unchanged.

### Other qualified Web observations

Update notes and their evidence only as established by the delta report:

- `security.encryption`: optional wrapped device key and in-memory unlocked key; preserve origin-code limitations. Do not imply atomic migration/recovery, protection of all sensitive memory, or audited security.
- `data.delete`: retain blocked-delete uncertainty; update moved deletion anchors. Lock/session-key interactions were not independently verified.
- `history.full`: remains partial. The net-worth chart slices the last returned transaction-month points; savings balance and cashflow history remain uncapped. This is not a general calendar window or retention rule.
- `review.reminder`: default-on unless explicitly false, local Sunday without an evening-hour restriction, pending inbox, seven-day snooze, in-app Today presentation.
- `review.inbox`, `review.merchantRules`, `review.worthIt`: update moved anchors; do not expand WorthIt into the separate wait quest.
- `credit.insights`: record the observed Premium in-app card-payment reminder consuming that existing gate; no payment execution or notification-delivery claim.
- `mailSync.connect`: same-tab foreground check and disconnect cleanup; remains partial manual/foreground read-only Gmail with no multi-mailbox count guard or background sync.
- `themes.premium`: update MoodGrid anchor; the glass slider is a separate local preference with no demonstrated Premium entitlement rule.
- `core.tabs`: updated route/function anchors; Owed and Ask routes have no matching shared IDs.
- `budgets.unlimited`: repeated monthly plans do not resolve the counting unit or establish a count guard.
- `budgets.lines`: retain UI-only qualification and uncapped save behavior.

Preserve the delta report’s unchanged 27-ID set. Reanchor all existing structured Web citations and explicit note citations at the new pin, including citations in rows whose status stays unchanged. Do not use blind global line-number replacements: replace each reference by its path and corresponding symbol/needle.

Retain the corrected Apple note paths from the P35 repair:

- `apps/apple/Lakshly/Setup/SetupCanvas.swift:709`
- `apps/apple/Lakshly/Features/Settings/SettingsView.swift:16`

### Quota refresh

Preserve quota IDs/order, `legacyLimits`, `proposedUnit`, `migrationHazard`, decision references, and native observations exactly.

Update only the Web observations/evidence:

- Budget count/line save anchor moves to `DataState.tsx:116`; count remains `noGuardFound`, lines remain `sourceUIOnly`.
- `history.full` Web enforcement changes from `noGuardFound` to `sourceUIOnly`. Its observed unit becomes **“Last returned transaction-month points for the net-worth chart only.”** Notes must state that other history and retention are uncapped. Evidence includes history limit line 18, limited worth line 23, and uncapped balance/cashflow lines 20/21.
- Extra-address totals remain Web 4/11 and Apple 3/10; existing Web source guard remains.
- Gmail `find` anchor moves to line 178; connected-mailbox quota remains `noGuardFound`.
- Merchant-rule write anchor moves to `review.ts:278`; unlimited/fallback semantics and missing Premium declaration remain unchanged.

### Authority correction

Replace every assertion that Beta always forces Premium or cannot test Free.

The qualified observation is: Beta defaults to local Premium, but explicit stored Free and the tester-plan switch are honored. Normal/public mode also uses a local chosen plan. These controls are not verified billing, signed grants, private authorization, or release approval.

Use pinned anchors from the report, including `edition.ts:11–14`, `AppState.tsx:40`, `Shell.tsx:86`, and profile payment-preview copy at line 137. Store individual evidence entries with their actual line/needle rather than a line range.

## Step 3 — refresh the human documents

In `PUBLIC-FEATURE-CATALOG.md`:

- Replace the snapshot link with the new pin.
- Add a short refresh statement identifying the previous and new pins, the bounded Web delta, and unchanged Apple/shared declarations.
- State that the proposal branch was not merged/rebased and the evidence is pinned source, not live/deployed or runtime verification.
- Regenerate all three marked matrix sections from the refreshed JSON using the checker’s existing rendering format.
- Update Free-right gap prose: imported-vault lock is partial; active-dataset export now exists on Web; native export remains not found in the bounded audit; sync remains partial/inactive as previously qualified.
- Update history quota prose to chart-point UI enforcement rather than “no applied window.”
- Correct Beta plan-authority prose as above.
- Preserve all ten owner-decision records and anchors, 258 pending approvals, raw quotas, alias qualifications, and unwired PR 36/39 references.

Add a bounded “functionality outside the 43-feature inventory” paragraph/list recording the report’s gaps:

- Ask’s hardcoded 10/100 monthly limits are outside the shared catalog.
- Owed view/copied draft has no matching ID.
- The three-day wait quest is separate from WorthIt ratings.
- Glass preference has no demonstrated entitlement ID.
- Island storyboard/film pages have no matching ID.
- TodayCard is a composition surface, not an OS widget or quota.
- Card-payment reminder currently consumes `credit.insights`.

Use report anchors where citations are included. Do not create IDs, assign tiers/release approval to these gaps, or launch those surfaces. Mention newer test source only as source presence if useful; no test-pass or runtime claims.

In `APPLE-POLICY-MIGRATION.md`:

- Update the snapshot link and add a brief statement that the Apple/shared source contracts are unchanged between these pins while the Web observations were refreshed.
- Preserve the five stages and their semantics: compatibility generation first; trusted context separately; explicit timestamp/start/expiry decisions; availability/operation quotas separately; native channel/coverage gates.
- Preserve the official Apple API links, exact-end discrepancy, cached-tier caveat, widget compatibility extension, Free allowances, unknown-map behavior, and pending decisions.
- Do not replace any helper or select timestamp quantization, purchaseDate-to-start conversion, offline grace, or native channel identity.

## Step 4 — strengthen the existing read-only checker

In `check-public-feature-catalog.mjs`:

1. Change `pinned` to the new full pin.
2. Keep all current exact-shape, declaration, mapping, pending-approval, structured-evidence and matrix checks.
3. Add explicit prose citation validation, using existing `safePath` and cached `source` retrieval.

Introduce:

- `embeddedCitations(value, label)`: recursively visits JSON string values, arrays and object values.
- `citationText(value, label)`: scans each string for explicit full application paths followed by `:<digits>`.

Use this regex:

```js
/\b(apps\/(?:web|apple)\/[^\s`"'<>():]+):([0-9]+)\b/g
```

For every match:

- Call `safePath(path)`.
- Require a safe integer line in `1..1_000_000`.
- Retrieve the pinned file through existing argument-array `git show`.
- Require that line to exist and contain non-whitespace content.
- Include the containing JSON/document label and citation in failure output.

Validate:

- All string values of the proposal.
- Both Markdown documents.

Run these checks before the final PASS output. Count checked citation occurrences and print:

```text
Explicit prose application citations: <actual count> checked
```

Do not hardcode the earlier count of 163: refreshed notes and Markdown may change it. Require a positive count.

This check validates citation existence and line bounds, not semantic correctness of the prose. The independent source review still checks that the cited line supports the observation. Shortened continuation references such as `:85` are not automatically validated; update them deliberately or expand them to full references where needed.

Retain the existing CLI interface, standard-library-only dependencies, source-cache limits/timeouts, and no-write behavior. No generic schema framework, app import, extra configuration or new tracked file.

## Step 5 — verify immutable proposal sections

Run this exact read-only comparison after edits:

```sh
node --input-type=module <<'NODE'
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';

const baseline = '7bf0ef74a7f5d8cbf1f87995cf2ef7c021ea4671';
const result = spawnSync('git', [
  'show', `${baseline}:docs/public-feature-catalog.proposal.json`
], {encoding:'utf8'});
if (result.status !== 0) throw new Error(result.stderr);
const before = JSON.parse(result.stdout);
const after = JSON.parse(readFileSync('docs/public-feature-catalog.proposal.json','utf8'));
const unchanged = p => ({
  metadata: {
    proposalVersion:p.proposalVersion, kind:p.kind, status:p.status,
    runtimeEvidence:p.runtimeEvidence, privateSuiteEvidence:p.privateSuiteEvidence,
    legacyCatalog:p.legacyCatalog, policyReferences:p.policyReferences
  },
  freeBillOfRights:p.freeBillOfRights,
  declarations:p.features.map(f => ({id:f.id,legacy:f.legacy,freeRight:f.freeRight})),
  nativeFeatures:p.features.map(f => ({
    id:f.id,iphone:f.platforms.iphone,macos:f.platforms.macos
  })),
  appleAliases:p.appleAliases,
  quotas:p.quotaReviews.map(q => ({
    id:q.id,legacyLimits:q.legacyLimits,proposedUnit:q.proposedUnit,
    migrationHazard:q.migrationHazard,decisionIds:q.decisionIds,
    iphone:q.platformObservations.iphone,macos:q.platformObservations.macos
  })),
  ownerDecisions:p.ownerDecisions
});
if (!isDeepStrictEqual(unchanged(before),unchanged(after)))
  throw new Error('Immutable declaration/native/decision sections changed');
if (after.sourceCommit !== '779f9130e80adce66a1825212756d5f0acc8e677')
  throw new Error('Wrong refreshed pin');
const changes = after.features.filter((f,i) =>
  f.platforms.web.sourceStatus !== before.features[i].platforms.web.sourceStatus
).map(f => [f.id,f.platforms.web.sourceStatus]);
const expected = [
  ['security.lock','sourcePartial'],
  ['data.export','sourceImplemented'],
  ['setup.freshnessReminders','sourceImplemented']
];
if (!isDeepStrictEqual(changes,expected))
  throw new Error('Unexpected Web status changes');
console.log('Immutable sections and exactly three Web status changes: PASS');
NODE
```

Expected exit zero and the stated PASS line.

## Step 6 — verify syntax, evidence, matrices and eight rejection cases

```sh
node --check docs/scripts/check-public-feature-catalog.mjs
node docs/scripts/check-public-feature-catalog.mjs
```

Both must exit zero. Default output must retain:

```text
43 features; 129 platform observations; 258 pending channel approvals
19 Apple aliases: 17 mapped, 2 pending
11 Free rights; 6 quota reviews
Explicit prose application citations: <actual count> checked
Pinned evidence and review matrices: PASS
```

Run eight independent malformed proposals without filesystem writes. The following harness replaces only the proposal read in each fresh child process; real JSON/Markdown/source reads otherwise remain intact:

```sh
node --input-type=module <<'NODE'
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const proposalPath = resolve('docs/public-feature-catalog.proposal.json');
const checkerPath = resolve('docs/scripts/check-public-feature-catalog.mjs');
const original = fs.readFileSync(proposalPath);
const digest = b => createHash('sha256').update(b).digest('hex');

const cases = [
  ['missing feature', p => p.features.pop(), /43 feature IDs\/order/],
  ['altered legacy label', p => { p.features[0].legacy.label += ' invalid'; }, /complete legacy object/],
  ['normalized absent merchant Premium', p => {
    p.features.find(f => f.id === 'review.merchantRules').legacy.limits.premium = null;
  }, /complete legacy object/],
  ['premature approval', p => {
    p.features[0].platforms.web.releaseProposal.beta.approval = 'approved';
  }, /Premature release approval/],
  ['widget mapped to review.widget', p => {
    p.appleAliases.find(a => a.appleCase === 'basicWidgets').canonicalId = 'review.widget';
  }, /Widget canonical ID must remain null/],
  ['unsafe structured path', p => {
    p.features[0].platforms.web.evidence[0].path = '../unsafe';
  }, /Unsafe evidence path/],
  ['wrong structured needle', p => {
    p.features[0].platforms.web.evidence[0].needle = '__P36_MISSING_NEEDLE__';
  }, /incorrect pinned evidence needle/],
  ['wrong explicit note citation', p => {
    const re = /\b(apps\/(?:web|apple)\/[^\s`"'<>():]+):([0-9]+)\b/;
    const feature = p.features.find(f => re.test(f.platforms.web.notes));
    if (!feature) throw new Error('No explicit Web note citation to mutate');
    feature.platforms.web.notes = feature.platforms.web.notes.replace(
      re, 'apps/web/__P36_MISSING_SOURCE__.tsx:$2'
    );
  }, /Pinned source retrieval failed|explicit.*citation/i]
];

for (const [name,mutate,error] of cases) {
  const childCode = `
    import fs from 'node:fs';
    import {syncBuiltinESMExports} from 'node:module';
    import {pathToFileURL} from 'node:url';
    const filename = ${JSON.stringify(proposalPath)};
    const originalRead = fs.readFileSync;
    const p = JSON.parse(originalRead(filename,'utf8'));
    (${mutate.toString()})(p);
    fs.readFileSync = function(file,...rest) {
      return String(file) === filename ? JSON.stringify(p) : originalRead(file,...rest);
    };
    syncBuiltinESMExports();
    await import(pathToFileURL(${JSON.stringify(checkerPath)}).href);
  `;
  const result = spawnSync(process.execPath, ['--input-type=module','-e',childCode], {
    encoding:'utf8',timeout:30_000,maxBuffer:2*1024*1024
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (result.error || result.status !== 1 || !error.test(output))
    throw new Error(`${name}: unexpected result ${result.status}\n${output}`);
  console.log(`${name}: rejected (exit 1)`);
}
if (digest(original) !== digest(fs.readFileSync(proposalPath)))
  throw new Error('Real proposal bytes changed');
console.log('8/8 malformed proposals rejected; real proposal bytes unchanged');
NODE
```

Expected harness exit zero, eight rejection lines, and the final `8/8` line. Each child must exit one for its intended validation failure. The previous seven rejection cases remain covered; the eighth specifically proves that malformed prose evidence is rejected.

The in-memory technique was already probed read-only against the existing checker: missing-feature input exited one with the intended `43 feature IDs/order` error.

## Step 7 — scope, evidence review and freeze

Run:

```sh
git diff --check
git diff --name-only
git status --short
git diff --exit-code \
  2d79390e04196acc98ac67eb3be27004bcd64914 \
  779f9130e80adce66a1825212756d5f0acc8e677 \
  -- apps/apple packages/shared/entitlements.json packages/schema
```

Expected whitespace and source-contract comparison exit zero. Exactly the four owned tracked files change; preserved untracked instruction files remain.

After root stages those four files:

```sh
git diff --cached --check
git diff --cached --name-only
```

Expected exit zero and exactly the same four paths.

Executor reports:

- Full diff and four SHA-256 hashes.
- Actual command outcomes, including eight intended rejection failures.
- Preserved counts and immutable-section comparison.
- Exactly three Web status changes.
- History quota changed only to qualified UI enforcement.
- New pin and source-only limitations.
- No app/shared/helper changes, runtime verification, deployment or policy approval.

Verifier receives this complete plan, both original audits, the complete P36 delta, executor report, frozen diff and scope manifest. It independently repeats the read-only gates and checks:

- Structured and explicit prose references against the new pin.
- Semantic support for the changed observations and migrated references.
- Both matrices and surrounding prose.
- Unchanged Apple records, declarations, raw limits, rights and decisions.
- No stale “Beta always forces Premium,” “Web lock only planned,” “no Web export,” or “history has no applied chart limit” assertions.
- No inference that source implementation constitutes security, billing, runtime or release readiness.

Advisor then reviews this original plan, the frozen diff and intact verifier gate.

## Done condition and repair boundary

Done requires a passing independent gate and advisor approval of this four-file refresh. Root may then publish a normal signed-off update to draft PR 59 and record the new pinned snapshot in the handoff. No merge, rebase, activation, helper replacement or deployment follows from this approval.

Two repair cycles maximum. A repeated verification failure returns its exact output and original plan to advisor before further edits. Infrastructure failures are reported separately. If the final permitted repair fails, stop with the outstanding evidence rather than starting another loop.

Owner decisions remain pending and govern later implementation; they do not block completing this source refresh.
