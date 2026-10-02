# apps/apple: Lakshly for iOS & macOS (placeholder)

SwiftUI multiplatform app targeting **iOS 26 / macOS 26** with Liquid Glass. Phase 1 will add the Xcode project; for now this folder holds the starting shape and conventions.

Planned modules (Swift packages):

| Package | Responsibility |
|---|---|
| `LakshlyCore` | `Codable` models generated from `packages/schema`, the domain logic |
| `LakshlyCrypto` | AES-256-GCM (CryptoKit), Secure Enclave / Keychain key wrapping, biometric unlock (LocalAuthentication) |
| `LakshlyParsers` | On-device statement / CAS / email parsers (PDFKit), tested against **synthetic** fixtures |
| `LakshlyUI` | Liquid Glass components (`.glassEffect()`, `GlassEffectContainer`), Swift Charts, material fallbacks before iOS 26 |

Rules: no third-party analytics SDKs, no network in the Free tier, and never log amounts or descriptions.
