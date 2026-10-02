# apps/web: Lakshly web MVP

A local-first, client-only **Next.js 16 (App Router, static export)** app with a Liquid Glass-inspired UI. No backend, no network calls, no analytics. It loads **synthetic** demo data only (`demo-data/sample.synthetic.json`, synced at build time). Types are generated from `packages/schema`.

```bash
npm ci
npm run dev        # http://localhost:3000
npm run build      # static export to ./out
npm run lint && npm run typecheck && npm test
npm run gen:types  # regenerate lib/schema.gen.ts from the JSON Schema
```

**Tabs:** Overview, Spend, Budget, Debt\*, Credit\*, Investments & SIPs\*, Rewards\*, History, Feedback & Requests (\* = Premium; use the Free/Premium demo switch in the sidebar. No payments.)

Plan, theme and feedback live in `localStorage` on your device only.

## Themes

`docs/themes.json` is the source of truth (Lakshmi, Monochrome Gold, Graphite, Ocean, Forest, Rose Quartz). `npm run gen:themes` (`node scripts/gen-themes.mjs`, stdlib only) reads it and writes `app/themes.gen.css` and `lib/themes.gen.ts`. Do not edit those files. The generator runs before `dev`, `build`, `test`, `typecheck`, and `lint`.

Each theme is `html[data-theme="<id>"][data-appearance="light|dark"]`. `data-appearance` is the resolved scheme. Flags: `data-semantic-icons`, `data-spacious`, `data-clear-glass`. If those attributes are missing, the page is Lakshmi and follows `prefers-color-scheme`.

Storage, on this device only:

- `lakshly.themeId` — theme id, default `lakshmi`
- `lakshly.appearance` — `system`, `light`, or `dark`, default `system`
- `lakshly.plan` — `free` or `premium` (demo switch, no payment)

A previous `lakshly.theme` value of `light` or `dark` is copied into `lakshly.appearance` once and removed. An inline script in the root layout applies the saved theme before CSS paints, checks the id against the six known themes, and never throws. `system` follows the OS and updates if that preference changes. A stored Premium theme falls back to Lakshmi while the plan is free; the saved id is kept and returns if you preview Premium.

Screenshot query params are read only by that script and are not saved:

- `?theme=<id>&appearance=light|dark` — `appearance` is `light` or `dark`. A premium id in the query is shown for that load even on the free plan.
- `?switcher=open` — opens the theme switcher

Ocean, Forest, and Rose Quartz are Premium. On the free plan they show a lock. Choosing one opens an upsell; "Preview Premium (demo)" sets the local plan to premium and applies the theme. No payment is collected. Monochrome Gold uses direction glyphs (↙ income, ↗ spend), extra space, and flat clear glass.
