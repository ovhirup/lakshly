# Lakshly landing page (`site/`)

A static, dependency-free landing page with a waitlist. No build step, no tracking or analytics,
no cookies, no third-party fonts, scripts or CDNs. Every asset is self-hosted, and a strict
Content-Security-Policy (`default-src 'none'`) enforces that.

```
site/
  index.html      landing page
  privacy.html    waitlist privacy notice (DPDP Act 2023)
  island.css/js   island storyboard (no network, no inline styles)
  favicon.ico, robots.txt, sitemap.xml
  styles.css      Lakshmi theme tokens (docs/design-tokens.md) + Liquid Glass
  config.js       the ONLY place to wire the waitlist (WAITLIST_ENDPOINT)
  theme-init.js   applies the saved light/dark choice before first paint
  main.js         theme toggle, mobile menu, ₹/$ pricing (auto by region, manual toggle), waitlist form
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
a native POST of `email`, `embed=1` and any `utm_*` tags from the page URL (`utm_content` goes as
`metadata__utm_content`), opened in a named tab. Buttondown says not to call this endpoint with `fetch`.

The page never claims success on submit. Buttondown sometimes answers the first POST with HTTP 400 and a
Turnstile "Verify your subscription" page, and its pages send `Cross-Origin-Opener-Policy: same-origin`,
so this page can't read the result. The flow is:

1. Pop-up blocked: "Nothing was sent yet", with a "continue in this tab" fallback.
2. Tab opened: neutral "Finish signing up in the Buttondown tab" (verification happens there).
   Coming back without a result shows "Still waiting for Buttondown…".
3. "Almost there 💛" only once Buttondown's after-subscribe redirect lands on
   `https://lakshly.com/?waitlist=subscribed#waitlist`; that tab tells the original one over a
   same-origin `BroadcastChannel` (nothing is stored). `?waitlist=confirmed` shows "You're on the list".

**Buttondown settings this relies on** (Settings → Subscribing): redirect after subscribing to
`https://lakshly.com/?waitlist=subscribed#waitlist`, and after confirming to
`https://lakshly.com/?waitlist=confirmed#waitlist`. Without them, Buttondown keeps visitors on its own
success page and this page stays in the honest "finish in the Buttondown tab" state.

No inline styles anywhere (the CSP is `style-src 'self'`, and the Pages workflow fails on `style="`
in `site/`). Use classes in the CSS files instead.

If `WAITLIST_ENDPOINT` is set back to `""`, the form validates input and shows a "coming soon" thank-you,
but sends, stores and logs nothing.

## Deploying

`.github/workflows/pages.yml` publishes `site/` to GitHub Pages (Source: GitHub Actions) at
https://lakshly.com (`site/CNAME`). It runs on every push to `main` that touches `site/**` or the
workflow, and can also be run manually (`workflow_dispatch`).
