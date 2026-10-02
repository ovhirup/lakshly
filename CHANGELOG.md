# Changelog

## Built with you 💛
*Every shipped request is credited here, with gratitude, to the people who asked for it (opt-in).*

_No releases yet. Your idea could be the first one listed here._

## [Unreleased]
- Apple: Feedback, Request and Bug forms now preview and open a prefilled GitHub issue for you to review and submit, with privacy-limited environment details and Premium priority labels.
- Apple: StoreKit 2 Lakshly Premium for local testing (`app.lakshly.premium.monthly` ₹119, `app.lakshly.premium.yearly` ₹999) with a custom paywall. No App Store Connect products yet.
- Apple: on-device statement and CAS import with PDFKit. The Import tab parses bank, credit-card, and CAMS/KFintech PDFs plus generic CSV on the device, asks for a password only in memory, and merges transactions into the encrypted local store.
- `packages/parsers`: on-device statement and CAS parsers. Adapters for CAMS/KFintech CAS, HDFC/SBI/ICICI bank statements and HDFC/SBI credit-card statements, plus generic bank and card fallbacks and CSV import. Supports password-protected PDFs, masks numbers to the last 4 digits, and dedupes on re-import.
- Web: Import flow (drag-drop, password prompt, review and edit categories, confirm), AES-GCM-encrypted IndexedDB vault, toggle between demo data and my data, and "delete all my data".
- `site/`: static landing page with waitlist (no tracking, no third-party resources, strict CSP, DPDP consent; endpoint not wired yet). There is also a manual-only GitHub Pages workflow.

## [0.1.0] – Phase 1 web MVP (unreleased)
- `apps/web`: local-first Next.js web app (static export, no backend, no network calls, no analytics) on synthetic demo data.
- Tabs: Overview, Spend, Budget, Debt, Credit, Investments/SIPs, Rewards, History, Feedback & Requests.
- Liquid Glass-inspired design with light/dark themes, responsive layout, Recharts charts, INR formatting from paise.
- Free vs Premium demo toggle with tasteful upsell (no payments).
- CI workflow building, linting, type-checking and testing the web app on PRs.

## [0.0.1] – Phase 0 (unreleased)
- Repository foundations: README, plan, JSON Schema v0.1.0, synthetic demo-data generator, security & contribution docs, issue templates.
