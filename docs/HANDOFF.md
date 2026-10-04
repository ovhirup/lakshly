# Lakshly handoff

Public status for the two agents on this repo. No private data, no account numbers, and no amounts.

Owners: **Cursor** (`cursor/<topic>`, web, site, workers, web CI) and **Codex** (`codex/<topic>`, Apple, parsers, Apple CI). Shared contracts in `packages/shared` and `packages/schema` need a CLAIM line here before either agent edits them. `sync/handoff` is fast-forward only.

## Now (claims)

- **Cursor:** `docs/HANDOFF.md` on `sync/handoff`. #31 is now in `cursor/beta-liquid-glass-polish` at `9cc9024` (`apps/web/app/beta-glass.css` only). Not merging #29 into `web/beta` until Abhirup says so.
- **Codex CLAIM:** `apps/apple/**` and `.github/workflows/apple.yml` on `codex/apple-ci`, based on `main`. No shared package/schema changes are claimed. PR 30 is implemented and verified; merge approval and local-only rescue decisions remain pending.

## Cursor status

- **Done:** Draft #29, Beta glass polish for cards, navigation, and dialogs. CI was green on `44cf675`.
- **Done:** #31's blur-order commit `9cc9024` is fast-forwarded onto #29. CI on that commit is the next check. Do not merge #29 into `web/beta` until Abhirup says so.
- **Next:** Re-check blur in Chromium, attach screenshots, then ask to merge #29. After that, Gmail connect end-to-end on beta, then record which commit beta.lakshly.com serves.
- **Blockers:** Abhirup's OK before any merge to `web/beta` or `main`. Gmail CAS-password retry is his.

## Codex status

- Done: CAS identity repair merged into `web/beta` via PR 28; Overview PR 30 is implemented with green checks; glass blur fix PR 31 is merged into Cursor's branch.
- In progress: Apple CI. The existing iOS suite is configured; the macOS scheme currently has no test target. Add genuine macOS testing and an unsigned, path-filtered workflow.
- Next: obtain a green Apple CI run on a draft PR to `main`, report actual test results and any known skips, then request review. Runtime tests run on hosted CI; local work remains headless without app or simulator launches.
- Boundaries: no web edits, private-edition edits, branch reconciliation, or feature merges in this batch. No Google client secret or real financial data is used.
- Local-only work: `notch-panel`, uncommitted `apple-feedback`, and archived `codex/cas-import-success-message` are **local only, keep** pending explicit rescue decisions. Existing local integration work is also preserved. Private-edition source remains outside this public repository and is not accessed by this task.


## Parity

Versions: private web, public web beta, public web main, public Mac, public iPhone, private Mac, private iPhone. Private web is not in this repo (parity debt only).

| Feature | Private web | Web beta | Web main | Public Mac | Public iPhone | Private Mac | Private iPhone |
|---|---|---|---|---|---|---|---|
| Setup wizard | debt | done, with Gmail step | done | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Theme v2 + Lotus Glass | done (not in git) | first pass; polish in #29/#31 | not on main | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Liquid Glass slider | done (not in git) | not in #29 | no | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Gmail connect | n/a | code on beta, Testing mode | not on main | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Tester name | n/a | done | todo | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| CDSL/NSDL CAS | debt | done (#25, #28); #30 open | parser via #24 | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Net worth over time | done (not in git) | todo | todo | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Owed-to-me tracker | done (not in git) | todo | todo | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Notch panel part 2 | n/a | n/a | n/a | built locally, not on GitHub | Not applicable | Edition unverified | Not applicable |
| Apple CI | n/a | n/a | n/a | In progress; new test target | In progress; existing suite | Outside public CI | Outside public CI |
| iPhone Duo | n/a | n/a | n/a | Edition unverified | Edition unverified | Edition unverified | Edition unverified |
| Ask Lakshly | not started | todo | todo | Edition unverified | Edition unverified | Edition unverified | Edition unverified |

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
| #29 | `cursor/beta-liquid-glass-polish` | `web/beta` | Head is `9cc9024` (includes #31). Screenshots and Abhirup's OK. Do not merge yet. |
| #31 | `codex/beta-glass-blur-fix` | #29's branch | Merged 4 Oct 2026, 12:53 IST. |
| #30 | `codex/cas-overview` | `web/beta` | Implemented and verified; green CI and synthetic browser check; Abhirup's screenshot/merge OK. |

`main` is `cb58f9f`. `web/beta` is `f25573f`. They have diverged (commits only on each side). Do not rebase either branch.

## Local only, keep

These are not on GitHub. Do not delete, reset, or clean them.

- `notch-panel` (worktree `~/dev/lakshly-notchpanel`): public notch part 2. Codex pushes only after Abhirup says yes.
- Uncommitted Apple feedback parity in `~/dev/lakshly-feedback`. Codex commits only after Abhirup says yes.
- `codex/cas-import-success-message` in Codex's clone.
- Private Mac/iPhone app: local only, no commits. Never copy it into this repo.

## Questions for Abhirup

1. After #31 is in #29 and screenshots are attached, may #29 merge into `web/beta`?
2. May #30 merge into `web/beta` when its CI is green?
3. Merge `web/beta` into `main` this week (beta-only behaviour stays behind the edition flag), or keep them separate?
4. Did Gmail connect work for the Testing-mode test users, and did the CAS password retry succeed?
5. May Codex push notch-panel and the Apple feedback work? Should the private Apple app get a private GitHub repo?
6. Has the retired OAuth client secret been deleted in Google Cloud? Do not paste the secret here.

## Nightly sync

Owner-approved automation `lakshly-nightly-handoff-sync`: 21:00 IST, October 4–10; at most seven runs, stopping earlier after three consecutive unchanged runs. Doc-only, public-safe coordination; quiet unless meaningful progress, failure, or an owner decision is needed. Scheduled runs completed: 0; consecutive unchanged scheduled runs: 0.

## Log

### 2026-10-04 (Cursor)

Opened `sync/handoff` from `main` at `cb58f9f`. Fast-forwarded #29 from `44cf675` to `9cc9024` (Codex's blur-order fix). No merge to `web/beta`. Blocker: Abhirup's OK, plus a fresh blur check, before #29 merges.

### 2026-10-04 (Codex)

- Adopted the owner-authorized handoff and started Apple CI on `codex/apple-ci` from `main` at `cb58f9f`.
- Confirmed that `sync/handoff` did not exist; initialized this public-safe document and the Codex claim. No shared contracts or Cursor files were changed.
- PR 30 remains draft with green checks. GitHub recheck shows PR 31 merged into Cursor's branch, with PR 29's updated head `9cc9024` green and still draft.
- Local-only public work is marked keep. No private source, finance data, GUI app, or simulator was opened.
- Created the owner-approved nightly handoff automation with the seven-run limit and three-unchanged-run stop condition. Its first run is scheduled for October 4 at 21:00 IST.

- Cursor created this shared branch concurrently; combined the doc-only histories without rebasing or overwriting Cursor's status or log.
