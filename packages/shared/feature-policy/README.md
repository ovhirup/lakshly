# Feature policy v1: unwired reference contract

This directory defines an opt-in contract, pure TypeScript reference evaluator, and
**SYNTHETIC** truth table. No application imports this namespace and the shared
package root does not export it. These synthetic definitions are not a production
release catalog or approval to release any feature. Existing entitlement helpers,
including legacy unknown-feature Premium behavior, remain unchanged. Consumer
migration requires a separate compatibility review.

## Inputs and trust boundary

The catalog identifies policy version `1`, an explicit revision, and feature
definitions. IDs and revisions are nonempty identifiers of at most 128 characters,
matching `^[a-z][A-Za-z0-9._-]*$`. Feature definitions separately describe public or
private audience, implementation, enablement, supported platforms, exact release
availability, public minimum tier, and optional quotas. Public definitions may
explicitly be available to Private Experimental; private definitions cannot have
Public availability. Availability is never inferred from an earlier channel.
Duplicate IDs, platforms, or availability triples are rejected.

The only v1 suite/channel combinations are Public Beta, Public Stable, and Private
Experimental. Platforms are `web`, `macos`, and `iphone`. Existing setup consumers
use `ios`; a future explicit adapter must map that name to `iphone`. This batch
changes neither those consumers nor their types.

Context supplies an evaluation time and upstream-verified entitlement facts:

- `none` kind/provenance/state with null bounds means no entitlement.
- Public Premium uses `verifiedEntitlement`, or `betaSimulation` only in Public
  Beta. State may be active, revoked, or refunded; start is required.
- Private SuperUser uses `verifiedPrivateAuthorization`. State may be active or
  revoked; start is required. Public SuperUser and Private Premium are invalid.
- A consistent Private `none` context is valid input but cannot authorize access.

**Provenance describes facts verified before evaluation. It does not verify those
facts.** JSON, TypeScript types, and JSON Schema cannot authenticate identity,
verify a payment or transaction, check a signature, or enroll a private user. A
caller cannot acquire authority by constructing JSON with a provenance label.
Production adapters must establish those facts at an appropriate trusted boundary.
Beta simulation must remain a synthetic testing mechanism, never an authority for
Stable access. Device permissions, data consent, financial authorization, and
operation safeguards must be enforced independently by product consumers.

All time values are integer UTC epoch seconds from `0` through `253402300799`.
Non-null end must be strictly later than start. Access is active only when state
is active and `start <= asOf < end`, or there is no end. The exact end is expired;
the exact start is active. There is no ambient clock, date parsing, or offline
grace. Future, expired, revoked, or refunded Public Premium becomes Free.
Inactive or missing private authorization denies Private access rather than
creating a Private Free tier.

Requests supply a feature ID and externally established usage: nonnegative
`used` and positive `requested`, both safe integers. A quota is a maximum quantity
**after the proposed operation**, not a calendar period or automatic allowance
reset. Each quota has required `free` and `premium` keys: null means unlimited,
zero is a valid zero allowance, and finite values range through
`Number.MAX_SAFE_INTEGER`. There is no requirement that Premium have a larger
quota. SuperUser has unlimited monetization quota for an otherwise available
feature. No counter is mutated, usage consumed, or storage read by this evaluator.

## Deterministic decision order

1. Validate catalog, context, then request; deny the first invalid category.
2. Find the exact feature; otherwise deny unknown.
3. Deny private-audience features in Public.
4. Deny unimplemented features.
5. Deny disabled features.
6. Deny unsupported platforms.
7. Deny absent exact suite/channel/platform availability.
8. Resolve access using the supplied time and entitlement facts; deny missing or
   inactive Private authorization.
9. Deny Premium minimum tier for Public Free.
10. Apply the selected quota; SuperUser is unlimited. Compare `requested > limit`
    first, then `used > limit - requested`, avoiding unsafe addition.
11. Allow.

Every decision includes version, catalog revision, validated request feature ID,
allowed flag, reason, effective tier, access basis, and selected limit. An invalid
catalog yields a null revision; malformed request feature IDs yield an empty
string. Tier, basis, and limit are null before access resolution. Tier and basis
remain present in tier/quota denials. A null limit means either no quota or an
unlimited quota; **it is not an access grant when `allowed` is false**. Consumers
must inspect the allowed flag and reason, rather than infer access from a limit.
Validation issues expose only a path and code, never input claims or values.

The schema root validates the fixture document; its local definitions also cover
catalog, feature, entitlement, context, request, decision, and individual cases.
Strict Draft 2020-12 tests compile every definition using installed Ajv 2020.
Schema checks structure, required/exact keys, bounds, enums, versions, and array
uniqueness. Context schema deliberately permits structurally valid, semantically
invalid combinations for rejection cases. Runtime validators additionally check
suite/channel/provenance relationships, interval order, ID/triple duplication,
and availability references. Runtime validation is mandatory even if a caller
bypasses JSON Schema or casts untrusted JSON to a TypeScript type.

## Verification and future integration

`fixtures.synthetic.json` contains ten synthetic definitions and literal expected
decisions. Expected decisions were authored independently of the evaluator. Cases
cover all three platforms, Free/Premium/SuperUser access, simulation isolation,
private authorization, availability, timing boundaries, quotas, and safe-integer
boundaries. Tests compare complete decisions, reject malformed input, and verify
repeated, mutation-free evaluation without ambient time.

From the repository root:

```sh
npm --prefix packages/shared test
npm --prefix packages/shared run typecheck
git diff --check
```

No decision here settles real feature graduation, private enrollment, cross-platform
billing, or offline grace. Generated Swift reference definitions and cross-language
fixture parity belong to a separately planned, unwired batch. Web/Apple activation,
authentication, billing verification, deployments, and existing entitlement helper
changes are outside this contract batch.
