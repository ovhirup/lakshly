# Lakshly landing page (`site/`)

A static, dependency-free landing page with a waitlist. No build step, no tracking or analytics,
no cookies, no third-party fonts, scripts or CDNs. Every asset is self-hosted, and a strict
Content-Security-Policy (`default-src 'none'`) enforces that.

```
site/
  index.html      landing page
  privacy.html    waitlist privacy notice (DPDP Act 2023)
  styles.css      Lakshmi theme tokens (docs/design-tokens.md) + Liquid Glass
  config.js       the ONLY place to wire the waitlist (WAITLIST_ENDPOINT)
  theme-init.js   applies the saved light/dark choice before first paint
  main.js         theme toggle, ₹/$ pricing (auto by region, manual toggle), waitlist form
  assets/         lotus logo + screenshots (synthetic demo data only)
```

## Preview locally

```sh
cd site && python3 -m http.server 4173   # http://localhost:4173
```

## Wiring the waitlist

1. Choose a backend and set `WAITLIST_ENDPOINT` (plus `WAITLIST_FIELDS` / `WAITLIST_MODE`) in `config.js`.
2. Allow its origin in the CSP `<meta>` in `index.html`: `connect-src` for `cors`/`no-cors`, `form-action` for `form`.
3. Name the provider and a contact/grievance email in `privacy.html`.

The waitlist is wired to Buttondown (newsletter `lakshly`, double opt-in) via its
[embed-subscribe endpoint](https://docs.buttondown.com/building-your-subscriber-base) in `form` mode:
a native POST of `email`, `embed=1`, `tag=waitlist` and optional `metadata__track`, opened in a new tab.
Buttondown says not to call this endpoint with `fetch`. `tag` and `metadata__*` are Buttondown paid add-ons.

If `WAITLIST_ENDPOINT` is set back to `""`, the form validates input and shows a "coming soon" thank-you,
but sends, stores and logs nothing.

## Deploying

`.github/workflows/pages.yml` publishes `site/` to GitHub Pages. It is **manual only**
(`workflow_dispatch`). Pages must first be enabled in repo settings (Source: GitHub Actions).
Nothing deploys on push.
