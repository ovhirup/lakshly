# Security policy

Lakshly handles some of the most sensitive data people have. Security and privacy are product features, not add-ons.

## Reporting a vulnerability

- **Please do not open a public issue.** Use GitHub's private vulnerability reporting: *Security → Report a vulnerability* on this repository.
- Include the affected component, steps to reproduce, and impact. Please use synthetic data only and never send real financial data.
- We aim to acknowledge reports within **2 business days (IST)** and to share a fix plan within **10 business days**. These are targets for an early-stage project.
- We support coordinated disclosure and will credit reporters (opt-in) in release notes. There is no paid bounty yet.
- In scope: this repository's code, and later the shipped apps. Out of scope: social engineering, DoS, and third-party services.

## Data model & threat model (summary)

| Principle | Implementation (planned) |
|---|---|
| Local-first | The device is the source of truth. The Free tier has no account and no server |
| Encryption at rest | AES-256-GCM. Apple: data key wrapped by a Secure Enclave / Keychain key (`WhenUnlockedThisDeviceOnly`, biometry-bound). Web: WebCrypto, non-extractable key derived from a passkey (WebAuthn PRF) or a passphrase (Argon2id) |
| Access | Face ID / Touch ID lock, auto-lock on inactivity, privacy blur in the app switcher |
| Sync (optional, Premium) | End-to-end encrypted. The server or iCloud stores ciphertext only. Devices are paired via QR code (X25519) |
| Minimal data | Only the last 4 digits of account/card numbers (`mask`). Amounts stored as integers in minor units. No raw statements kept after parsing (user-configurable) |
| Connectors | Statement/CAS import parsed on-device. Gmail/Outlook **read-only** OAuth with PKCE, client-side, limited to an allow-list of senders. Tokens stored in Keychain / encrypted storage, and revocable in one tap |
| AI | On-device redaction (names, account/card/PAN, phone, email, UPI IDs) before any LLM call. Zero-retention API modes. "AI off" switch. A preview of exactly what is sent |
| Telemetry | No third-party analytics SDKs. Crash reports are opt-in and scrubbed |
| Compliance | Designed for India's DPDP Act 2023 / DPDP Rules 2025: notice, purpose-specific consent, deletion, breach notification |

## Repository rules

- **Never commit real financial data**, statements, screenshots of real accounts, tokens or `.env` files. Test fixtures must be synthetic (`demo-data/`).
- Secrets go in local `.env` files (git-ignored) or a CI secret store.
