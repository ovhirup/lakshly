# Lakshly agent handoff

Status as of 2026-10-04 IST. This document lives only on `sync/handoff` and records coordination; feature branches remain separate. Pending and unverified mean that completion has not been established for that edition.

## Now (claims)

- CLAIM — Codex: `apps/apple/**` and `.github/workflows/apple.yml` for Apple CI on `codex/apple-ci`, based on `main`. No shared schema or package changes are claimed.
- Cursor owns web, site, workers, and existing web CI. Cursor's claims are owner-maintained below.
- Codex edits only its status, relevant parity evidence, the PR list, and append-only log. Never force-push this branch.

## Cursor status

Owner-maintained; awaiting Cursor's first update. PR 31 is now merged into Cursor's branch; draft PR 29 includes the blur fix at `9cc9024` and its updated checks are green.

## Codex status

- Done: CAS identity repair merged into `web/beta` via PR 28; Overview PR 30 is implemented with green checks; glass blur fix PR 31 is merged into Cursor's branch.
- In progress: Apple CI. The existing iOS suite is configured; the macOS scheme currently has no test target. Add genuine macOS testing and an unsigned, path-filtered workflow.
- Next: obtain a green Apple CI run on a draft PR to `main`, report actual test results and any known skips, then request review. Runtime tests run on hosted CI; local work remains headless without app or simulator launches.
- Boundaries: no web edits, private-edition edits, branch reconciliation, or feature merges in this batch. No Google client secret or real financial data is used.
- Local-only work: `notch-panel`, uncommitted `apple-feedback`, and archived `codex/cas-import-success-message` are **local only, keep** pending explicit rescue decisions. Existing local integration work is also preserved. Private-edition source remains outside this public repository and is not accessed by this task.

## Parity table

| Feature | Private web | Public web beta | Public web main | Mac public | Mac private | iPhone public | iPhone private |
|---|---|---|---|---|---|---|---|
| CAS folio identity repair | Unverified / parity debt | Merged PR 28 | Not yet reconciled from beta | Swift changes in beta; main reconciliation pending | Unverified / parity debt | Swift changes in beta; main reconciliation pending | Unverified / parity debt |
| Holdings-only CAS Overview | Unverified / parity debt | Draft PR 30; checked | Pending | Unverified / parity debt | Unverified / parity debt | Unverified / parity debt | Unverified / parity debt |
| Beta glass polish and Chromium blur fix | Unverified / parity debt | Draft PR 29 includes merged PR 31; green checks | Beta-only; unchanged by these PRs | Pending | Unverified / parity debt | Pending | Unverified / parity debt |
| Apple CI | Not applicable | Not applicable | Workflow PR pending | In progress; test target required | Outside public CI | In progress; existing suite | Outside public CI |
| Tester-name / Gmail-results parity | Not applicable | Present in beta; current end-to-end status unverified | Reconciliation pending | Pending assessment | Unverified / parity debt | Pending assessment | Unverified / parity debt |
| Theme v2 / glass slider | Unverified / parity debt | First pass plus pending polish; slider unverified | Reconciliation pending | Pending; depends on approved scope and reconciliation | Unverified / parity debt | Pending; depends on approved scope and reconciliation | Unverified / parity debt |

## PR status

| PR | Base | Observed status | Waits on |
|---|---|---|---|
| [29 — Beta glass polish](https://github.com/ovhirup/lakshly/pull/29) | `web/beta` | Draft, green checks at `9cc9024`; includes PR 31 | Cursor completes required browser/fallback coverage and obtains screenshot/merge approval |
| [30 — Holdings-only CAS Overview](https://github.com/ovhirup/lakshly/pull/30) | `web/beta` | Draft, green checks; synthetic browser check passed | Owner's screenshot/merge approval |
| [31 — Chromium blur fix](https://github.com/ovhirup/lakshly/pull/31) | `cursor/beta-liquid-glass-polish` | Merged; one CSS file | Complete; incorporated into PR 29 |

Glass/Overview integration verification: 264 web tests, typecheck, lint, and Beta build passed. Calm/light, Vivid/dark, Classic solid, mobile panels, protected Lotus styles, and Feedback exclusions were checked. Reduced-transparency/contrast fallbacks were checked in compiled CSS; runtime preference emulation was unavailable in that review.

## Questions for owner

- Approve the reviewed screenshots and merge sequence for PRs 29–31 when ready. This handoff does not grant merge approval.
- Decide separately whether local-only public work should be rescued to new branches. Keep all existing copies until then.
- Daily sync is authorized at 21:00 IST for October 4–10: maximum seven runs, stopping earlier after three consecutive unchanged runs. Automation `lakshly-nightly-handoff-sync` is active and performs public-safe, doc-only coordination. Scheduled runs completed: 0; consecutive unchanged scheduled runs: 0.

## Log (append-only, IST)

### 2026-10-04 (Codex)

- Adopted the owner-authorized handoff and started Apple CI on `codex/apple-ci` from `main` at `cb58f9f`.
- Confirmed that `sync/handoff` did not exist; initialized this public-safe document and the Codex claim. No shared contracts or Cursor files were changed.
- PR 30 remains draft with green checks. GitHub recheck shows PR 31 merged into Cursor's branch, with PR 29's updated head `9cc9024` green and still draft.
- Local-only public work is marked keep. No private source, finance data, GUI app, or simulator was opened.
- Created the owner-approved nightly handoff automation with the seven-run limit and three-unchanged-run stop condition. Its first run is scheduled for October 4 at 21:00 IST.
