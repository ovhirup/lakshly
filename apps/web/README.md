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
