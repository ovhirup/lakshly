<div align="center">

# 🪷 Lakshly

### Every rupee on target.

**Private-by-design personal finance for iOS, macOS and web.**
Net worth, spending, budgets, debt, credit cards, SIPs, rewards and payouts in one calm, fluid view, without handing your financial life to anyone.

`Status: early development (Phase 1: web MVP)` · `Demo data only` · `Not yet on the App Store`

</div>

---

## ✨ The name

**Lakshly** (*LUCK-shlee*) blends **Lakshmi**, the goddess of wealth, prosperity and good fortune, with **laksh** (लक्ष्), Sanskrit for *aim* or *goal* and the root of her name.
Lakshmi stands for growth and good money habits. *Laksh* stands for staying on target. Together: **every rupee on target.**

## 🧭 What it does

| Area | What you get |
|---|---|
| **Overview** | Net worth across banks, funds, deposits and platforms, with gain/loss at a glance |
| **Spend** | Auto-categorised spending, trends, merchants, recurring charges |
| **Budget** | Monthly category budgets with gentle nudges and streaks |
| **Debt** | Loans and EMIs, payoff planner (avalanche / snowball), interest burn |
| **Credit** | Card utilisation, due dates, statement cycles |
| **Platforms** | Holdings per investment platform |
| **SIPs** | Upcoming and active SIPs, step-ups, missed-SIP alerts |
| **Rewards** | Points and cashback tracking across cards |
| **Payouts** | Dividends, interest, refunds and other inflows |
| **History** | Long-term timeline of balances and net worth |

### Free vs Premium

| | **Free** | **Premium** |
|---|---|---|
| Accounts | Unlimited manual entries; up to 3 auto-linked sources | Unlimited sources, family profiles (up to 4) |
| Import | Statement / mutual-fund CAS import, parsed on-device | + Gmail / Outlook auto-import (on-device), scheduled refresh |
| Views | Overview, Spend, 1 Budget, 12 months of History | Everything: Debt planner, Credit, Platforms, Rewards, SIPs, Payouts; unlimited history; CSV/JSON export |
| AI | On-device categorisation, 10 chat messages/month | AI categorisation, 100 chats + 20 deep insights/month, monthly AI review |
| Sync | Single device, local only | End-to-end-encrypted sync across iPhone, Mac and web |
| Feedback | Feature requests and status tracking | ⭐ Priority queue, 1-business-day response target, early access |
| Security | Face ID / Touch ID, encrypted store | Same. **Security is never paywalled.** |

**Planned pricing:** India ₹119/month or **₹999/year** · Global $4.99/month or **$39.99/year**. 14-day trial, family sharing included. No ads, ever. We never sell data.

## 🔐 Privacy & security model

- **Local-first.** Your device is the source of truth. The Free tier has no account and no server.
- **Encrypted at rest** with AES-256-GCM. On Apple devices the key is protected by the **Secure Enclave / Keychain** (this-device-only) and unlocked with **Face ID / Touch ID**. On the web, WebCrypto with a passkey- or passphrase-derived key.
- **Optional end-to-end-encrypted sync.** Servers only ever see ciphertext.
- **On-device parsing.** Statements and emails are parsed on your device. Email access is **read-only** and limited to known bank/statement senders.
- **AI with redaction.** Names, account, card and PAN numbers, phone, email and UPI IDs are stripped on-device before any AI call. Zero-retention API modes, an "AI off" switch, and a preview of exactly what is sent.
- **DPDP Act 2023 ready.** Purpose-specific consent, minimisation, deletion on request.

See [SECURITY.md](SECURITY.md) for the data model and responsible disclosure.

## 🎨 Design direction: Liquid Glass

- **Apple:** native SwiftUI for iOS 26 / macOS 26 with **Liquid Glass** (`.glassEffect()`, `GlassEffectContainer`): morphing tab bars, glass cards over soft gradients, Swift Charts, widgets and Live Activities. Falls back to materials on older OS versions.
- **Web:** Next.js PWA with a glassmorphism system (`backdrop-filter`, layered gradients, specular highlights), Motion animations, and a fully client-side data layer.
- **Feel:** fluid springs, haptics, calm colour, and a lotus / gold-coin motif.

## 🧱 Stack & repo layout

```
apps/apple/          SwiftUI multiplatform app (iOS + macOS), placeholder
apps/web/            Next.js PWA, placeholder
packages/schema/     JSON Schema for accounts, transactions, budgets, debts, SIPs, rewards
demo-data/           Synthetic INR data generator + committed synthetic sample
services/            (future) optional stateless relay; no user data stored
docs/PLAN.md         Product & launch plan (pricing benchmarks, connectors, LLM costs, roadmap)
```

AI: OpenAI **GPT-6 Luna** for bulk on-device-redacted extraction and categorisation; xAI **Grok 4.3** for Premium insights. Details and cost model are in [docs/PLAN.md](docs/PLAN.md).

## 🗺️ Roadmap

| Phase | Duration | Highlights |
|---|---|---|
| **0: Foundations** | ~2 weeks | Repo, schema, synthetic demo data, security & privacy docs ✅ |
| **1: MVP (local-only)** | 6–8 weeks | Liquid Glass app, core tabs, encrypted store, biometric lock, statement/CAS import, in-app Feedback & Feature Requests ← *we are here* (local-first web MVP in `apps/web`) |
| **2: Private beta** | ~6 weeks | Gmail/Outlook on-device import, AI categorisation & insights, Premium, TestFlight |
| **3: Public launch** | ~4 weeks | App Store, Mac App Store, web; E2EE sync; remaining tabs |
| **Later (demand-gated)** | — | India Account Aggregator live sync, only if Premium users ask for it in numbers |

## 💛 Built with you

Lakshly is shaped by the people who use it.
- **Feedback & Feature Requests** live inside the app. Every request gets an instant thank-you and a visible status: *Received → Planned → In progress → Shipped*.
- **Premium members get priority:** their requests are triaged first and get a human reply within **1 business day (IST)** (target).
- **Credits:** every release's *Built with you* changelog thanks, by name (opt-in), the people whose ideas shipped.

Until the app ships, please use [GitHub Issues](../../issues/new/choose). See [FEEDBACK.md](FEEDBACK.md).

## 🤝 Contributing

Contributions are welcome, especially parsers, tests against **synthetic** fixtures, and design. Please read [CONTRIBUTING.md](CONTRIBUTING.md). **Never commit real financial data.**

## 📄 License

- App code: **AGPL-3.0-or-later** ([LICENSE](LICENSE)). Open and auditable, so the privacy claims can be verified, and protected against closed hosted forks.
- `packages/` and `demo-data/`: **MIT**, so the schema and fixtures can be reused anywhere.

See [CONTRIBUTING.md](CONTRIBUTING.md#licensing-of-contributions) for how contributions are licensed.

> All numbers, names and accounts in this repository are **synthetic demo data**. Lakshly is not a bank, broker or investment adviser and does not provide financial advice.
