# Apple policy migration: separately gated stages

This is a future migration proposal based on public source at
[`779f9130e80adce66a1825212756d5f0acc8e677`](https://github.com/ovhirup/lakshly/tree/779f9130e80adce66a1825212756d5f0acc8e677).
Web observations were refreshed from `2d79390` to this pin. Apple sources and
shared legacy declarations are unchanged between those pins; native observations
and pending policy decisions remain preserved.
No current helper replacement, policy activation, purchase adapter, native release,
private inspection or app launch is included. The [catalog inventory](PUBLIC-FEATURE-CATALOG.md)
records 43 feature declarations, 19 Apple aliases and six quota reviews; all 258
platform/channel approvals remain pending. Source observations are not runtime,
visual, security or purchase verification.

## Stage 1: compatibility generation first, after review

After owner review of the proposal, separately scope a generated legacy
compatibility map. Preserve all 19 enum cases and raw values, their existing tiers,
the current two Apple limit entries (`setupExtraEmails` 3/10 and `mailSyncConnect`
1/5), `Int.max` unlimited conventions, missing-limit fallback, and unknown-map
Premium behavior (Free denied, Premium allowed). Map 17 existing shared IDs and
retain an explicit two-widget compatibility extension until
[widgets](PUBLIC-FEATURE-CATALOG.md#decision-widgets) resolves the proposed
`widgets.basic`/`widgets.extra` names. Neither is `review.widget`.

Do not introduce all 43 features as active Apple functionality. Generation verifies
consistency and preserves current behavior; it does not implement missing features,
schedulers, permissions, purchase authority or quotas. This first implementation
requires its own reviewed file scope and verification, without coupling it to a
new availability-first evaluator.

## Stage 2: trusted context adaptation separately

Current `EntitlementStore` reads StoreKit current entitlements and distinguishes
verified/unverified results. The reduced snapshot contains product ID, expiry,
revocation, upgrade and verification facts; it does not capture purchase/start dates.
A future trusted context must be derived from actual verified StoreKit transactions,
not a public SuperUser switch, local Web plan, or Stable demo flag. Private enrollment
and cross-platform ownership are not inferred from public purchase facts.

Official APIs expose [purchaseDate](https://developer.apple.com/documentation/storekit/transaction/purchasedate),
[expirationDate](https://developer.apple.com/documentation/storekit/transaction/expirationdate),
[revocationDate](https://developer.apple.com/documentation/storekit/transaction/revocationdate),
and [VerificationResult](https://developer.apple.com/documentation/storekit/verificationresult).
These facts do not choose a purchaseDate-to-policy-start conversion, offline grace,
cross-platform account ownership, or new subscription policy. Those require explicit
approved rules and synthetic verification. See
[storeKitTime](PUBLIC-FEATURE-CATALOG.md#decision-storeKitTime) and
[nativeChannels](PUBLIC-FEATURE-CATALOG.md#decision-nativeChannels).

## Stage 3: explicit time rules and expiry fixtures

Pinned Apple resolution rejects expiry only when `expiration < now`; equality
remains Premium and `willRenew` uses `>= now`. The unwired v1 reference interval is
`start <= asOf < end`, so exact-end equality becomes Free. Do not silently change
that boundary while generating a compatibility table.

Approve mapping of start/purchase dates, Date-to-integer UTC seconds and fractional
timestamps separately; do not automatically choose flooring or rounding. Include
before/equal/after expiry, exact/future start, refunded/revoked facts, and renewal
intent distinct from current access. Cached `tier` is read by feature calls; no
per-operation clock reevaluation is visible, so cached expiry reevaluation also
needs a separately approved design. No offline grace is introduced by this proposal.
Decision: [storeKitTime](PUBLIC-FEATURE-CATALOG.md#decision-storeKitTime).

## Stage 4: availability and operation quotas separately

Inspect and review exact callers before stricter unknown, unimplemented or unreleased
feature denial. A tier entry is not availability: native mailbox/background/password
storage/reminder entries currently have inactive or stubbed implementation. Preserve
all eleven declared Free rights and plan their gaps without weakening them; see
[freeRights](PUBLIC-FEATURE-CATALOG.md#decision-freeRights).

Resolve [budgets](PUBLIC-FEATURE-CATALOG.md#decision-budgets) before counting grouped
budgets or category records. Free one-budget and six-line allowances must survive;
Apple starter currently caps six for every tier and saves without a tier guard.
Resolve [history](PUBLIC-FEATURE-CATALOG.md#decision-history) before choosing window,
display or retention semantics; never silently delete imported history. Premium
minimum labels for budgets/history cannot mechanically precede their finite Free
allowances in an access-first evaluator.

Resolve [extraEmails](PUBLIC-FEATURE-CATALOG.md#decision-extraEmails): Web counts
extras plus primary (totals 4/11), Apple counts all addresses (totals 3/10), and
Apple reducer/save paths do not enforce the UI cap. Resolve
[mailboxes](PUBLIC-FEATURE-CATALOG.md#decision-mailboxes) before operation-level
connected-account counts or promotion of inactive connectors. Resolve
[merchantRules](PUBLIC-FEATURE-CATALOG.md#decision-merchantRules) before normalizing
the absent Premium key in raw `{free:null}`; explicit future Premium null should
preserve legacy unlimited behavior only after approval.

Generated tables alone do not enforce operations. Introduce save/reducer/connector
guards only after units, caller compatibility and safety semantics are approved,
with dedicated boundary fixtures and meaningful operation tests.

## Stage 5: native channel and coverage gates

Channel must remain orthogonal to Debug/Release safeguards. Pinned build scripts
strip resources using literal Release configuration checks; adding a named Beta
configuration must not bypass them. Establish native distribution/channel identity
and authority through [nativeChannels](PUBLIC-FEATURE-CATALOG.md#decision-nativeChannels),
not through screenshot/debug arguments or Web's simulated plan.

Per-platform Beta/Stable approval needs actual iPhone and Mac compilation, hosted
unit tests, relevant purchase/device evidence, skip explanations, and applicable
permission/data safeguards. Independent runtime and visual form-factor evidence is
also needed for parity claims. Source sharing and headless reference parity are
not native runtime/visual verification. All release rows remain pending under
[releaseEvidence](PUBLIC-FEATURE-CATALOG.md#decision-releaseEvidence).

The unwired reference proposals [PR 36](https://github.com/ovhirup/lakshly/pull/36)
and [PR 39](https://github.com/ovhirup/lakshly/pull/39) are comparison inputs, not
activated consumers or dependencies of this documentation branch. No private suite,
real account, statement, payment credential or deployed environment was inspected.
