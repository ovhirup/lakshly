# apps/web: Lakshly web (placeholder)

A client-only **Next.js (static export) PWA**: React, Tailwind, Motion, and Recharts/visx charts. Glassmorphism uses `backdrop-filter`, layered gradients and specular highlights to echo Apple's Liquid Glass.

- Data stays in the browser: IndexedDB, encrypted with WebCrypto AES-GCM. The key is derived from a passkey (WebAuthn PRF) or a passphrase (Argon2id) and is non-extractable.
- No server-side rendering of user data and no third-party trackers.
- Types are generated from `packages/schema`. The demo mode loads `demo-data/sample.synthetic.json`.

Phase 1 will scaffold the app here (`npx create-next-app`).
