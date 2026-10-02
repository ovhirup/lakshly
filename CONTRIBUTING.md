# Contributing to Lakshly

Thank you for helping. Every rupee, and every contribution, on target. 💛

## Ground rules

1. **Synthetic data only.** Never commit real statements, account numbers, names, amounts, emails or screenshots of real finances. Use or extend `demo-data/generate.py`.
2. **Privacy first.** Do not add analytics SDKs, network calls in Free-tier paths, or logging of amounts/descriptions.
3. **Schema is the contract.** Change `packages/schema/lakshly.schema.json` first, bump `schemaVersion`, then regenerate the Swift/TS types.
4. Be kind. Assume good intent.

## Workflow

- Open or pick an issue (use the templates), then fork or branch: `feat/…`, `fix/…`, `parser/<bank>`.
- Keep PRs small. Include tests against synthetic fixtures (`python3 demo-data/generate.py --check` must pass).
- Use Conventional Commits (`feat:`, `fix:`, `docs:`…). Sign off your commits (`git commit -s`, [DCO](https://developercertificate.org/)).

## Licensing of contributions

- App code (`apps/`, `services/`) is **AGPL-3.0-or-later**. `packages/` and `demo-data/` are **MIT**.
- Because the Apple apps are distributed through the App Store, contributions to `apps/` are accepted under the DCO **plus** a grant to the maintainers to also distribute your contribution under other terms (for example App Store distribution terms). By opening a PR to `apps/` you agree to this. A formal CLA may replace this note before the first release.

## Good first areas

- Statement parsers for more banks (against synthetic fixtures)
- Category rules in the taxonomy
- Accessibility and localisation (Hindi, Bengali, Tamil, Kannada…)
- Liquid Glass / glassmorphism UI components
