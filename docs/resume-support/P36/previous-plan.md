PLAN P35-C1 — public feature inventory and staged Apple migration proposal

This batch produces a reviewable inventory and migration plan. It activates no feature policy and grants no Beta/Stable eligibility. User authorization covers completing and publishing this proposal; later catalog activation and Apple consumer changes require their own approved scope.

I read both intact inventory reports, the legacy catalog, and current Web/Apple entitlement helpers. Applicable single-writer, independent gate, two-cycle repair, public-source, and headless constraints remain binding.

### Ownership and scope

Root creates `codex/public-feature-catalog` from pinned public main:

`2d79390e04196acc98ac67eb3be27004bcd64914`

Executor owns exactly four new files:

1. `docs/public-feature-catalog.proposal.json`
2. `docs/PUBLIC-FEATURE-CATALOG.md`
3. `docs/APPLE-POLICY-MIGRATION.md`
4. `docs/scripts/check-public-feature-catalog.mjs`

No shared catalog/schema/package, app, helper, test, configuration, workflow, Cursor branch, or private-source changes. Preserve existing untracked Web instruction files.

Inputs:

- `/private/tmp/lakshly-P35-web-inventory.md`
- `/private/tmp/lakshly-P35-apple-inventory.md`
- Pinned legacy `packages/shared/entitlements.json`
- Pinned Apple `apps/apple/Lakshly/Store/Entitlements.swift`
- Reference proposals [PR 36](https://github.com/ovhirup/lakshly/pull/36) and [PR 39](https://github.com/ovhirup/lakshly/pull/39), explicitly not dependencies of this documentation branch.

Do not inventory unmerged Cursor PRs 35/37/38/40 or infer current deployed behavior from this source baseline.

### Machine-readable inventory

Use this exact top-level shape:

```text
proposalVersion: 1
kind: "public-feature-review-inventory"
status: "pending-owner-approval"
sourceCommit: "<full pinned commit>"
runtimeEvidence: "not-reverified"
privateSuiteEvidence: "not-inspected"
legacyCatalog: {path, sha256, version}
policyReferences: [{url, purpose}]
freeBillOfRights: [...]
features: [...]
appleAliases: [...]
quotaReviews: [...]
ownerDecisions: [...]
```

This is **not** an executable `FeatureCatalog`. Do not add `policyVersion`, normalized release availability, or an application consumer.

Each feature:

```text
{
  id,
  legacy,                 // exact original feature object
  freeRight,              // membership in unchanged rights list
  platforms: {
    web: PlatformReview,
    iphone: PlatformReview,
    macos: PlatformReview
  }
}
```

`legacy` preserves exact labels, `minTier`, and raw optional `limits`, including missing keys. Do not turn absence into null or zero.

Each `PlatformReview`:

```text
{
  sourceStatus:
    "sourceImplemented" |
    "sourcePartial" |
    "sourceStub" |
    "notFoundInAudit",
  notes,
  evidence: [{path, line, needle}],
  releaseProposal: {
    beta: {suggestion, rationale, approval: "pending"},
    stable: {suggestion, rationale, approval: "pending"}
  }
}
```

Suggestion values are `"evidenceReviewCandidate"` or `"holdForImplementationOrScopeDecision"`.

Populate source status and notes from the reports, preserving qualifications. Do not turn “no evidence” into “unsupported,” “not applicable,” or a claim that private/external implementations do not exist.

Candidate rule for this proposal:

- `sourceImplemented`: evidence-review candidate for both channels.
- All other statuses: hold for implementation/scope decision for both channels.

This is a review suggestion, not availability or approval. All **258 platform/channel approval fields remain pending**, including candidates. State that source implementation alone does not establish test coverage, security readiness, purchase readiness, or release eligibility.

For implemented/partial/stub observations, include appropriate application-source anchors. For `notFoundInAudit`, a legacy declaration anchor plus the bounded absence note is acceptable; declaration evidence must not be described as implementation evidence.

Evidence paths are repository-relative; line numbers and literal source snippets are checked against the pinned commit.

### Apple aliases

Each alias:

```text
{
  appleCase,
  rawValue,
  currentMinTier,
  canonicalId,             // existing shared ID or null
  proposedCanonicalId,     // null except two proposed widget names
  mappingStatus: "mapped" | "ownerDecisionRequired",
  notes,
  evidence: [{path, line, needle}]
}
```

Preserve all 19 existing cases/raw values/tiers.

Mapped cases:

- premiumThemes → themes.premium
- debtPlanner → debt.planner
- creditInsights → credit.insights
- investmentInsights → investments.insights
- rewardsInsights → rewards.tracking
- priorityFeedback → priorityFeedback
- importStatements → import.statements
- setupWizard → setup.wizard
- setupEmailGuide → setup.emailGuide
- setupExtraEmails → setup.extraEmails
- setupSuggestions → setup.suggestions
- setupHealth → setup.health
- mailSyncConnect → mailSync.connect
- mailSyncIMAP → mailSync.imap
- mailSyncStatementPasswordKeychain → mailSync.statementPasswordKeychain
- mailSyncBackground → mailSync.background
- setupFreshnessReminders → setup.freshnessReminders

For `basicWidgets` and `extraWidgets`, canonical IDs remain null; propose `widgets.basic` and `widgets.extra` with owner-decision-required status. These are names for review only, not additions to the shared catalog. Neither maps to `review.widget`.

### Six quota reviews

Each review:

```text
{
  id,
  legacyLimits,
  proposedUnit,
  platformObservations: {
    web: {observedUnit, enforcement, notes, evidence},
    iphone: {observedUnit, enforcement, notes, evidence},
    macos: {observedUnit, enforcement, notes, evidence}
  },
  migrationHazard,
  decisionIds: [...]
}
```

Enforcement values:

- `sourceOperationGuard`
- `sourceUIOnly`
- `noGuardFound`
- `notApplicablePendingDecision`

Use the audits’ actual distinctions; these labels do not claim runtime verification.

Record all six:

- `budgets.unlimited`: grouping/counting unit unsettled; Free allowance 1 despite Premium minimum tier; no current budget-count guard.
- `budgets.lines`: category lines per budget; Web UI/suggestions bounded, persistence gap; Apple starter hard-caps six for every tier, save path lacks tier guard.
- `history.full`: Free 12/Premium unlimited; calendar window versus display versus retention undecided. Neither platform demonstrates enforcement. Never propose silent deletion of imported history.
- `setup.extraEmails`: Web counts extras beyond primary, yielding total 4/11; Apple currently counts total addresses, yielding total 3/10. Separate UI and reducer/save-path enforcement.
- `mailSync.connect`: intended connected mailbox count, 1/5; foreground Web client and inactive native connectors do not establish operation-level multi-mailbox enforcement.
- `review.merchantRules`: preserve raw `{free:null}`; Premium key is absent. Recommend an explicit future Premium-null normalization to preserve legacy unlimited behavior, pending approval.

Do not mechanically copy Premium minimum tiers for budgets/history into an availability-before-access evaluator: doing so would remove existing finite Free allowances.

### Owner decisions

Use records `{id, question, recommendation, status:"pending"}`. Reference them from quota reviews and both Markdown documents.

Include these decisions:

1. Widget canonical IDs versus a documented compatibility extension.
2. Budget counting/grouping and preservation of finite Free allowances.
3. History window semantics and preservation of user data.
4. Extra-address unit consistency and operation enforcement.
5. Mailbox scope, implementation readiness, and connected-account counting.
6. Explicit merchant-rule Premium normalization.
7. Per-platform Beta/Stable approval and required evidence.
8. Incomplete declared Free rights, particularly lock/export/sync, without weakening those rights.
9. StoreKit start mapping, integer-time quantization, expiry equality, and cached-state reevaluation.
10. Native channel/distribution identity and authority boundaries.

These decisions block their dependent future implementation, not completion of this proposal.

### Human review documents

`PUBLIC-FEATURE-CATALOG.md` explains:

- Pinned source-only evidence and audit scope.
- The 43-feature matrix across Web/iPhone/macOS.
- Declared access versus source implementation versus pending release decisions.
- Eleven preserved Free rights, including implementation gaps.
- All six quota discrepancies and 19 aliases.
- Web demo/Beta Premium is not verified payment authority.
- Private source/authentication and deployed environment state were not inspected.
- No catalog/app policy changes occurred.

Include deterministic matrix sections bounded by markers:

```text
<!-- feature-matrix:start --> ... <!-- feature-matrix:end -->
<!-- quota-matrix:start --> ... <!-- quota-matrix:end -->
<!-- apple-alias-matrix:start --> ... <!-- apple-alias-matrix:end -->
```

The checker renders these sections from JSON and requires exact agreement. Feature order follows the legacy catalog; quota order follows its six limits entries; alias order follows Apple’s enum.

`APPLE-POLICY-MIGRATION.md` specifies future separately gated stages:

1. **Compatibility generation first, after proposal approval.** Preserve all 19 enum cases/raw values, existing tiers, current two Apple limits entries, `Int.max` conventions, and current unknown-map Premium behavior. Map 17 canonical IDs and retain an explicit two-widget compatibility extension until approved. Do not introduce all 43 features as active Apple functionality.
2. **Trusted context adaptation separately.** Actual StoreKit verified transactions supply authority; no public SuperUser switch, local Web plan, or Stable demo flag. Purchase/start dates are not currently captured in the reduced snapshot.
3. **Explicit time rules.** Existing expiry comparison keeps Premium at equality; v1 excludes the exact end. Date-to-integer UTC seconds, fractional timestamps, start mapping, cached-tier expiry reevaluation, and refund/revocation fixtures need a separate approved design. Do not select flooring/rounding automatically.
4. **Availability and operation quotas separately.** Review exact callers and feature states before stricter unknown/unimplemented/unreleased denial. Add operation-level guards only after units are approved; generated tables alone do not enforce operations.
5. **Native channel/coverage gates.** Keep channel orthogonal to Debug/Release safeguards. Require actual iPhone/Mac compilation, hosted tests and relevant purchase/device evidence with skip explanations. Headless reference parity is not native runtime/visual verification.

Link the root-provided official Apple API facts:

- [purchaseDate](https://developer.apple.com/documentation/storekit/transaction/purchasedate)
- [expirationDate](https://developer.apple.com/documentation/storekit/transaction/expirationdate)
- [revocationDate](https://developer.apple.com/documentation/storekit/transaction/revocationdate)
- [VerificationResult](https://developer.apple.com/documentation/storekit/verificationresult)

Do not infer automatic `purchaseDate` → policy start conversion, offline grace, cross-platform ownership, or new subscription policy from these APIs.

### Checker and exact verification

Implement `check-public-feature-catalog.mjs` using Node standard libraries only. No dependency installation or application imports.

Default command:

```sh
node docs/scripts/check-public-feature-catalog.mjs
```

Optional `--proposal <path>` supports isolated negative verification. Other arguments fail.

The checker must:

- Validate exact object keys, enums, required fields, array uniqueness, nonempty notes/rationales, pending decision references, and bounded positive evidence line numbers.
- Compare 43 IDs and every complete `legacy` object against the pinned catalog using deep equality.
- Verify catalog checksum/version and current legacy file bytes match pinned source.
- Preserve all 11 rights and verify row membership.
- Require exactly six reviews with exact raw limits, including absent merchant Premium.
- Parse the pinned Apple enum and standard dictionary; require all 19 aliases, raw values, current tiers, 17 exact mappings, two pending widget proposals.
- Require all 129 platform observations and 258 pending channel approvals.
- Reject any premature approved release, widget alias to `review.widget`, or proposed widget ID added among the 43 rows.
- Check safe evidence paths: no absolute/backslash/traversal/NUL paths; allow only `apps/web/`, `apps/apple/`, `packages/shared/`.
- Retrieve pinned source through argument-array `git show`, without a shell; verify every needle occurs on its stated line.
- Validate deterministic Markdown sections.
- Perform no writes.

Expected default exit zero with explicit counts:

```text
43 features; 129 platform observations; 258 pending channel approvals
19 Apple aliases: 17 mapped, 2 pending
11 Free rights; 6 quota reviews
Pinned evidence and review matrices: PASS
```

Executor also verifies seven temporary malformed proposals, each expected exit 1: missing feature, altered legacy label, normalized absent merchant Premium, approved release, widget mapped to review.widget, unsafe path, incorrect evidence needle. Mutate only temporary copies; preserve real proposal bytes.

Final gates:

```sh
node --check docs/scripts/check-public-feature-catalog.mjs
node docs/scripts/check-public-feature-catalog.mjs
git diff --check
git diff --name-only
git status --short
```

Expected: syntax/check/whitespace exit zero; only four planned paths added; preserved Web files unchanged. Check safe content and absence of proposal imports from apps/packages/workflows. No app tests or builds need rerunning for this documentation-only batch.

Freeze full diff, checks, counts, and four file hashes. Verifier receives this original plan, both intact audit reports, executor output, and frozen diff; it independently repeats checker/scope/evidence/matrix checks. Advisor then reviews original plan plus diff and gate.

After approval, root may publish a signed-off normal draft PR. No merge, deployment, real catalog activation, or Apple helper replacement.

Two genuine repair cycles maximum; two repeated failures route back to advisor with outputs before further edits. Infrastructure failures remain separate.
