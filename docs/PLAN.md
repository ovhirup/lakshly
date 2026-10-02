# Lakshly: product & launch plan

> **Every rupee on target.**
> This is the public planning document for Lakshly, written 2 Oct 2026 (IST). Prices and availability were checked on that date; anything marked **unverified** could not be confirmed. All example figures are synthetic or are public competitor prices with sources.

**Decision summary**
- **Name:** **Lakshly** = *Lakshmi* (goddess of wealth and prosperity) + *laksh* (Sanskrit "aim, goal", the root of her name). It's two syllables and easy to say globally (*LUCK-shlee*). See "Naming notes" at the end.
- **Pricing:** Free tier, plus Premium at **₹119/mo or ₹999/yr** in India and **$4.99/mo or $39.99/yr** globally.
- **LLM:** **OpenAI GPT‑6 Luna** for bulk extraction, categorisation and Free chat. **xAI Grok 4.3** for Premium deep insights. Estimated cost: **~$0.01 per Free user per month** and **~$0.25 per Premium user per month**.
- **Stack:** native SwiftUI (iOS 26 / macOS 26 Liquid Glass) plus a Next.js PWA for web, in one monorepo with a shared JSON Schema.
- **Connectors (committed):** statement/CAS import with on-device parsing, and on-device Gmail/Outlook read-only parsing. Plaid only if going global. **Account Aggregator is deferred and demand-gated.**
- **Premium feedback & service:** in-app Feedback & Feature Requests, visible request status, a public "Built with you" changelog, and a 1-business-day Premium response target.

---

## 1. Free vs Premium

| | **Free** | **Premium** |
|---|---|---|
| Accounts | Unlimited manual entries; up to 3 auto-linked sources | Unlimited linked sources, family profiles (up to 4) |
| Import | Statement/CAS PDF import, on-device parsing | + Gmail/Outlook auto-import, scheduled refresh |
| Views | Overview / net worth, Spend, Budget (1), History (12 mo) | All tabs: Debt planner (avalanche/snowball), Credit (utilisation, due dates), Platforms, Rewards, SIPs, Payouts; unlimited history; export CSV/JSON |
| AI | On-device categorisation; 10 chat messages/mo | AI categorisation with fallback, 100 chat/mo + 20 "deep" insights, monthly AI review |
| Sync | Single device (local only) | End-to-end-encrypted sync across iPhone, Mac and web |
| Look | Light/dark | Themes, widgets, Live Activities, app-icon packs |
| Feedback & support | Feedback & Feature Requests (standard queue), request status, credited in changelog | **Priority** queue and voting weight, response within 1 business day (target), early access to shipped requests |
| Lock | Face ID / Touch ID, encrypted store | Same (security is never paywalled) |

**Prices**
- **India:** ₹119/mo or **₹999/yr** (~₹83/mo). A limited "Founding Member" lifetime licence at ₹4,999 is optional.
- **Global:** **$4.99/mo or $39.99/yr**.
- Both: 14-day trial, family sharing included.

**Competitor benchmark** (fetched 2 Oct 2026 unless marked otherwise)

| App | Price | Source |
|---|---|---|
| YNAB | $14.99/mo, $109/yr | https://www.ynab.com/pricing |
| Monarch | Core $14.99/mo or $99.99/yr; Plus $199.99/yr | https://www.monarch.com/pricing |
| Copilot Money | $13/mo or $95/yr ($7.92/mo) | https://www.copilot.money/ |
| Rocket Money | Free; Premium "pay what's fair" $7–14/mo; Premium+ $15/mo | https://www.rocketmoney.com/learn/personal-finance/how-much-does-rocket-money-cost (via search, not fetched directly) |
| Fold (India, AA-based) | Fold Plus ₹2,999/yr regular, early-bird ₹1,499–2,009/yr | https://fold.money/blog/price-of-free-software (launch post, undated; a Sep-2026 Play review mentions "999 a year", so **current price unverified**) |
| ET Money Genius | Was ₹249/mo, billed quarterly; reported ₹399/mo in Jun 2026 | https://www.etmoney.com/ (homepage shows a "₹149/month for first 3 months" offer); ₹399 from a Reddit report, **unverified** |
| INDmoney | Platform free, earns on brokerage (₹0 AMC, 0.1% / ₹20 per order) | https://www.indmoney.com/pricing |
| Jupiter | Free app; banking tiers based on minimum balance (₹5k/₹10k) | https://jupiter.money/ |
| axio (ex-Walnut) | Free PFM, earns on BNPL/loans | https://www.axio.co.in/ |
| CRED | Free to members, earns on payments/credit; no subscription price found | **unverified** (cred.club returned no pricing) |

**Positioning:** the Indian incumbents are "free because you are the product" (lending, brokerage, ads). Lakshly is "paid, so you are the customer", with a no-ads, no-data-selling, local-first promise. ₹999/yr sits below Fold's regular price and is roughly a third of US rivals once converted.

After Apple's commission (15% under the Small Business Program, not re-verified at time of writing) and 18% GST, the ₹999 plan nets about ₹700/yr, against roughly ₹250/yr of LLM cost (§6). That is a healthy margin.

## 2. Connectors (committed path: files + on-device email; AA deferred)

1. **Phase A: files first (no regulation needed).**
   - Users import bank/credit-card statement PDFs/CSVs and the MF **CAS** (detailed CAS by email from CAMS/KFintech; the password is usually the PAN).
   - Parsing runs **on the device**: deterministic per-bank templates (PDFKit/pdf.js plus rules), and the MIT-licensed `casparser` logic (https://github.com/codereverser/casparser) ported or re-implemented for CAS.
   - The LLM is used only as a fallback for layouts nothing else recognises, and only on redacted text.
2. **Phase B: email connectors, read-only.**
   - Gmail uses `gmail.readonly`, which Google classes as **restricted**. That needs OAuth verification, and if Gmail data is stored on or passes through *your servers*, an annual third-party **CASA** assessment (https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification).
   - **Design to avoid CASA:** the OAuth flow, mail fetch and parsing all run on the client (iOS/macOS/web via PKCE). Tokens and data never touch a backend. Restricted-scope verification still applies.
   - Narrow the search with a sender allow-list (bank/CAS senders).
   - Outlook: Microsoft Graph `Mail.Read` (delegated, client-side).
   - SMS reading is not possible on iOS. That rules out the Walnut-style approach, so email plus files is the committed automatic path.
3. **Only if going global: Plaid.** Plaid (US/CA/UK/EU) is billed per connected Item per month on pay-as-you-go, with rates shown only in the dashboard (**unverified**; https://plaid.com/docs/account/billing/). Alternatives: GoCardless Bank Account Data (EU/UK), SimpleFIN (US, cheap). Only Plaid-type aggregators need a thin backend; keep it a stateless relay so data is never stored.

### Later, demand-gated: India Account Aggregator
**Not on the committed roadmap.** Revisit only if Premium users keep asking for it, for example a few hundred paying users requesting live bank/MF sync through the Feedback area (§7). It would cover bank, deposits, MF, insurance and NPS. What's involved:
   - **Only RBI/SEBI/IRDAI/PFRDA-regulated entities can be FIUs** (https://sahamati.org.in/fiu/), so an indie developer **cannot be an FIU directly**.
   - Route: a licensed TSP/FIU-of-record partner such as Setu (Anumati AA) or Finvu/OneMoney partner programmes, or later a SEBI RIA/RA registration.
   - Expect certification costs and per-fetch fees. Setu's policy gives ~₹0.01–₹25 per fetch, but real rates are negotiated (**unverified**). Third-party estimates put a direct AA build at ₹5–25 lakh over 5–10 months (vendor claim).
   - Fold shows that AA is the industry standard ("No email scraping, no SMS scraping" on fold.money).
   - Trigger to revisit: tracked in the feature-request board. Below the threshold, keep improving statement/CAS/email parsing instead.

## 3. Security model

- **Local-first.** The device is the source of truth. There is no account and no server in Free.
- **Encryption at rest:**
  - Apple: AES-256-GCM (CryptoKit). The data key is wrapped by a key held in the **Secure Enclave** where available, otherwise Keychain `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, protected with `.biometryCurrentSet`.
  - Web: WebCrypto AES-GCM. The key is derived with Argon2id from a passphrase or a passkey (WebAuthn PRF) and stored in IndexedDB as non-extractable.
- **Biometric lock:** Face ID / Touch ID on launch and after inactivity, a privacy blur in the app switcher, and an optional decoy/hide-amounts mode.
- **Optional E2EE sync (Premium):** CloudKit private DB or a dumb blob store. The client encrypts before upload. Devices are paired by QR code (key exchange via X25519), so the server sees only ciphertext.
- **OAuth tokens:** PKCE, no client secrets in apps. Refresh tokens live in Keychain or encrypted IndexedDB. Request minimal scopes (read-only mail). One-tap revoke, plus auto-purge of raw email after parsing.
- **What goes to the LLM** (never raw statements):
  - On-device redaction first: replace names, account/card/PAN/phone/email/UPI IDs with tokens, round or perturb amounts for chat, and send aggregates rather than rows where possible.
  - Use the xAI zero-data-retention (ZDR) option (default retention is 30 days; https://docs.x.ai/developers/faq/security) and OpenAI zero-retention/no-training settings.
  - Show an "AI off" switch and a per-request "what is sent" preview.
  - Free-tier categorisation uses on-device rules and Apple's on-device Foundation Models (iOS 26 / macOS 26) where supported.
- **DPDP Act 2023 / Rules 2025** (Rules notified 13 Nov 2025; Consent Manager rules from 13 Nov 2026; most obligations from **13 May 2027**):
  - Publish a clear notice and give purpose-specific consent for each connector.
  - Data minimisation and deletion on revocation.
  - Breach reporting to the Board and to users.
  - Grievance contact; parental consent (block users under 18).
  - Local-first keeps you a small data fiduciary with almost no server-side data. Any sync or relay vendors are processors under contract.
  - If AA is ever added (demand-gated), its data comes with its own purpose and retention terms set in the consent artefact.
- **Hygiene:** certificate pinning for any relay (Plaid only if going global), no third-party analytics SDKs (or privacy-preserving TelemetryDeck at most), a reproducible open-source client, a SECURITY.md and a bug-bounty-lite.

## 4. UI direction and stack

- **Apple:** native **SwiftUI** targeting iOS 26 / macOS 26.
  - Liquid Glass through `.glassEffect()` and `GlassEffectContainer` for morphing tab bars and cards, with `.ultraThinMaterial` as the fallback before iOS 26.
  - Swift Charts, Widgets, Live Activities (bill due dates), App Intents/Siri, SwiftData over an encrypted file store.
  - Copilot Money is the reference for the "fluid, playful" feel: spring animations, haptics, gradient hero card.
- **Web:** **Next.js (static export) PWA**, React, Tailwind, Motion (Framer). Glassmorphism via `backdrop-filter`, layered gradients and specular highlights. Charts: Recharts/visx. Fully client-side; deploy to GitHub Pages or Cloudflare Pages.
- **Why not cross-platform:** Liquid Glass, Secure Enclave, widgets and Apple's on-device models are native-only. Flutter and React Native lag on Liquid Glass and add a security surface. Two codebases with shared contracts is the better trade.
- **Repo (monorepo):**
```
lakshly/
  apps/ios-macos/      # SwiftUI multiplatform (Xcode project, SPM packages: Core, Parsers, Crypto, UI)
  apps/web/            # Next.js PWA
  packages/schema/     # JSON Schema / OpenAPI for transactions, holdings, budgets (codegen -> Swift + TS)
  packages/parsers-fixtures/  # SYNTHETIC statements/CAS samples + golden outputs (shared tests)
  packages/categories/ # category taxonomy + merchant rules (data, not code)
  services/relay/      # optional stateless relay (Plaid webhooks, only if going global) – Cloudflare Workers
  demo-data/           # generator for fake users (seeded, deterministic)
  docs/  SECURITY.md  PRIVACY.md  LICENSE (AGPL-3.0-or-later for apps; MIT for packages/ and demo-data/)
```

## 5. LLM choice and cost

**Official prices fetched 2 Oct 2026** (per 1M tokens, given as input / cached input / output):

| Model | Price | Context | Notes |
|---|---|---|---|
| **GPT‑6 Luna** | $0.10 / $0.01 / $0.50 | 1.05M | Batch/Flex half price. Supports function calling, structured output, file search |
| GPT‑6.1 Sol | $2 / $0.10 / $10 | 1.05M | |
| GPT‑6 Astra | $10 / $1 / $50 | | |
| gpt‑5.3‑codex | $1.75 / $0.175 / $14 | | |
| **Grok 4.3** | $1.25 / $0.20 / $2.50 | 1M | 2× price above 200k-token prompts; Batch 20% off; function calling and structured outputs; 10M TPM |
| Grok 4.7 (flagship) | $2 / $0.50 / $6 | 500k | |
| grok‑build‑0.1 (coding) | $1 / $0.20 / $2 | 256k | |

Sources: https://platform.openai.com/docs/pricing, https://platform.openai.com/docs/models, https://docs.x.ai/docs/models, https://docs.x.ai/docs/models/grok-4.3. Codex plans: Free $0, Go $8, **Plus $20**, Pro $100–500 per month (https://developers.openai.com/codex/pricing).

**Model per job**

| Job | Model | Why |
|---|---|---|
| Statement parsing fallback (redacted text → strict JSON schema) | **GPT‑6 Luna**, Batch/Flex | Cheapest input by about 12×, structured outputs, latency is irrelevant |
| Categorisation of unknown merchants | On-device rules + Apple model, then **GPT‑6 Luna** batch | Near-zero cost; results cached per merchant for everyone (only redacted merchant strings) |
| Free chat (10/mo) | **GPT‑6 Luna** | Cents per year |
| Premium "deep insights", monthly review, what-if | **Grok 4.3** | Low output price, 1M context, strong tool calling. Upgrade path: Grok 4.7 or GPT‑6.1 Sol for rare hard queries |
| Coding the app | **Codex (ChatGPT Plus, $20/mo)** with GPT‑6.1 Sol; grok‑build‑0.1 or Grok 4.7 as second opinion and reviewer | A flat subscription beats API billing for a solo developer |

Use a provider-agnostic gateway (Responses-API-style interface) so models can be swapped. A "bring your own xAI/OpenAI key" option for power users is optional.

**Monthly cost per active user.** These are assumptions, not measurements:

| | Free | Premium |
|---|---|---|
| Workload | 300 transactions (20% need LLM) · 1 fallback statement (8k in / 2k out) · 10 chats (4k context, 3k cached, 500 out) · 1 digest | 600 transactions · 4 fallback statements · 80 Luna chats + 20 Grok "deep" (8k context, 1k out) · 4 Grok digests (batch) |
| Cost | **≈ $0.007, round to $0.01** (≈ ₹1) | **≈ $0.23, budget $0.25–0.30** (≈ ₹20–25) |
| Comparison | | All on Grok 4.3 ≈ $0.53; all on GPT‑6.1 Sol ≈ $1.23; all on Luna ≈ $0.06 |

INR figures assume ~₹85–88 per USD (**FX not verified**). Enforce caps per user (messages, tokens) with hard monthly budget alarms. Not verified: real token counts per statement, Apple Foundation Models coverage on older devices, and the xAI ZDR eligibility process.

## 6. Roadmap (solo developer + Codex)

| Phase | Duration | Deliverables |
|---|---|---|
| **0: Foundations** | 2 weeks | Monorepo, schema, synthetic demo-data generator, CI, SECURITY/PRIVACY docs, trademark search and domain decision |
| **1: MVP (local-only)** | 6–8 weeks | SwiftUI iOS/macOS with Liquid Glass: Overview, Spend, Budget, Debt, Credit, SIPs, History; encrypted store + biometric lock; **in-app Feedback & Feature Requests area with request status (received / planned / shipped)**; PDF/CAS import with on-device parsers for top 8 Indian banks + CAS; web PWA read-only demo |
| **2: Private beta** | 6 weeks | Gmail/Outlook client-side import (start Google restricted-scope verification on day 1, as it can take weeks); Luna categorisation; Grok insights; StoreKit 2 tiers; TestFlight to 100 users; DPDP notice/consent flows; Premium priority queue + support response target live; first "Built with you" changelog |
| **3: Public launch** | 4 weeks | App Store + Mac App Store + web; E2EE sync; Platforms/Rewards/Payouts tabs; landing site; Product Hunt / r/IndiaInvestments launch |
| **4: Post-launch** | ongoing | Parser coverage for more banks/cards, request-driven features, Plaid relay only if going global, Android if traction. **AA is not scheduled**: it's demand-gated (§2) |

Total from 2 Oct 2026 to public launch: **~4.5–5 months** (around **mid-March 2027**). That is before the DPDP main obligations start on 13 May 2027, so build to them from the start.

## Top risks
1. **No live bank sync at launch.** AA is deferred, so users must import statements or connect email, which is more friction than Fold-style AA. Mitigation: excellent parsers, one-tap CAS request, email auto-import, and clear messaging. Revisit AA only if Premium demand crosses the threshold (§2).
2. **Gmail restricted scope.** Verification delays, or CASA (cost plus annual re-test) if any server touches mail. Mitigation: strictly client-side, minimal scopes, Outlook and manual forwarding as fallbacks.
3. **Parser brittleness, data accuracy and trust** (more critical now that files and email are the only automatic paths). Bank PDF layouts change, and a privacy slip would be fatal for a finance app. Mitigation: golden synthetic fixtures, LLM fallback on redacted text only, open-source client, security review before launch.
   - Also worth noting: name/trademark clearance, App Store finance-app review, and LLM price changes (OpenAI notes promo pricing on some models).

## 7. Premium feedback & service (part of the MVP)

- **Where it lives:** a clearly visible **Feedback & Feature Requests** entry in the main tab bar's "More" sheet and in Settings, plus a "Suggest this" button on empty states. Users can submit a request, report a bug, or upvote existing requests.
- **Premium priority:** Premium requests are tagged ⭐ and sorted first in the triage queue, and their votes count 3×. Premium users get early-access builds of the features they asked for.
- **Status on every request:** Received → Planned → In progress → Shipped (or "Not now, here's why").
  - Users see the status in the app and get a push/email notification when it changes.
  - Acknowledgement is **automatic and instant**, followed by a human note **within 2 business days**.
- **Premium support target:** first human response **within 1 business day (IST)**; critical issues (data, security, billing) **same day**. Free: best effort within 5 business days. These are targets, not an SLA, stated honestly in the app.
- **"Built with you" changelog:** a public page (on the website and in the app) for each release.
  - It credits every shipped request to the people who asked for it, by first name/handle, opt-in only.
  - It also keeps a running Credits list of everyone whose idea shipped.
- **Tone:** grateful and warm, never corporate. Examples:
  - Acknowledgement: "Thank you, this genuinely helps. We've logged it and you'll hear from us soon 🙏"
  - Shipped: "You asked, we built it. Thank you for making Lakshly better."
- **Privacy:** feedback is never tied to financial data. Attaching a redacted screenshot or diagnostics requires an explicit opt-in.
- **Stack (indie-friendly):** a simple board built on GitHub Issues/Discussions (private triage repo plus a public roadmap) or a hosted board such as Canny or Featurebase (pricing **unverified**). In-app submission goes through a tiny relay that strips PII. Support email plus an in-app chat inbox.
- **Feeds the roadmap:** the request board is also the trigger for demand-gated work such as Account Aggregator sync (§2).


## Naming notes

About 200 Sanskrit-rooted candidates were screened across four rounds, including glass/clarity words, Artha/Vitta/Kosha blends, wealth symbols, and Lakshmi epithets.

Selection rules:
- Avoid existing Indian bank/fintech names.
- Avoid a bare deity name; Indian Trade Marks Act s.9(2)(b) lets the registrar refuse marks likely to hurt religious sentiment.
- Prefer names that are short and easy to say globally.

**Lakshly** was chosen. Registry RDAP lookups on 2 Oct 2026 showed no registration for `lakshly.com`, `lakshly.app` or `lakshly.in`. The GitHub handle `lakshly` was free and the X handle looked free (indicative only).

To do before brand launch: IP India trademark search (classes 9/36/42) and defensive domains. Brand imagery uses a lotus / gold-coin motif, never a deity likeness.
