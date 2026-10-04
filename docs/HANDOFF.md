# Lakshly handoff

Public status for the two agents on this repo. No private data, no account numbers, and no amounts.

Owners: **Cursor** (`cursor/<topic>`, web, site, workers, web CI) and **Codex** (`codex/<topic>`, Apple, parsers, Apple CI). Shared contracts in `packages/shared` and `packages/schema` need a CLAIM line here before either agent edits them. `sync/handoff` is fast-forward only.

## Now (claims)

- **Cursor:** `docs/HANDOFF.md` on `sync/handoff`. #31 is now in `cursor/beta-liquid-glass-polish` at `9cc9024` (`apps/web/app/beta-glass.css` only). Not merging #29 into `web/beta` until Abhirup says so.
- **Codex:** `codex/cas-overview` (#30) toward `web/beta`. Apple and parser work stays on `codex/` branches. Mac-only rescue (notch panel, Apple feedback, local CAS message) waits for Abhirup.

## Cursor status

- **Done:** Draft #29, Beta glass polish for cards, navigation, and dialogs. CI was green on `44cf675`.
- **Done:** #31's blur-order commit `9cc9024` is fast-forwarded onto #29. CI on that commit is the next check. Do not merge #29 into `web/beta` until Abhirup says so.
- **Next:** Re-check blur in Chromium, attach screenshots, then ask to merge #29. After that, Gmail connect end-to-end on beta, then record which commit beta.lakshly.com serves.
- **Blockers:** Abhirup's OK before any merge to `web/beta` or `main`. Gmail CAS-password retry is his.

## Codex status

Written from the 4 Oct snapshot so Codex can correct it. Cursor does not edit Apple or parser files.

- **Done:** #28 CAS folio identity is on `web/beta`. #31 (blur order) is merged into #29. Draft #30 (holdings-only CAS on Overview) is still open.
- **In progress:** Finish #30.
- **Next:** After Abhirup says yes, push the local notch-panel branch and the uncommitted Apple feedback work, and decide the local CAS success-message commit. Apple CI and Theme System v2 wait on the web merge plan.
- **Blockers:** Abhirup's OK to publish Mac-only branches. Apple Theme v2 waits until Theme v2 is on `main`.

## Parity

Versions: private web, public web beta, public web main, public Mac, public iPhone, private Mac, private iPhone. Private web is not in this repo (parity debt only).

| Feature | Private web | Web beta | Web main | Public Apple | Private Apple |
|---|---|---|---|---|---|
| Setup wizard | debt | done, with Gmail step | done | done (#24); email step not switched on | local build only |
| Theme v2 + Lotus Glass | done (not in git) | first pass; polish in #29/#31 | not on main | not started | not started |
| Liquid Glass slider | done (not in git) | not in #29 | no | no | no |
| Gmail connect | n/a | code on beta, Testing mode | not on main | stub | unknown |
| Tester name | n/a | done | todo | todo | stays SuperUser |
| CDSL/NSDL CAS | debt | done (#25, #28); #30 open | parser via #24 | Swift port in #24 | unknown |
| Net worth over time | done (not in git) | todo | todo | todo | todo |
| Owed-to-me tracker | done (not in git) | todo | todo | todo | todo |
| Notch panel part 2 | n/a | n/a | n/a | built locally, not on GitHub | local build only |
| Apple CI | n/a | n/a | n/a | not started | n/a |
| iPhone Duo | n/a | n/a | n/a | spec only | todo |
| Ask Lakshly | not started | todo | todo | todo | todo |

## Open PRs

| PR | Branch | Base | Waits on |
|---|---|---|---|
| #29 | `cursor/beta-liquid-glass-polish` | `web/beta` | Head is `9cc9024` (includes #31). Screenshots and Abhirup's OK. Do not merge yet. |
| #31 | `codex/beta-glass-blur-fix` | #29's branch | Merged 4 Oct 2026, 12:53 IST. |
| #30 | `codex/cas-overview` | `web/beta` | Codex finishes it; Abhirup's OK. |

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

## Log

### 2026-10-04 (Cursor)

Opened `sync/handoff` from `main` at `cb58f9f`. Fast-forwarded #29 from `44cf675` to `9cc9024` (Codex's blur-order fix). No merge to `web/beta`. Blocker: Abhirup's OK, plus a fresh blur check, before #29 merges.
