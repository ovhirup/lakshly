import CryptoKit
import Foundation
import Security

/// Loads or creates the local encryption key, wrapping it with Secure Enclave when available.
final class KeyManager {
  private struct Envelope: Codable {
    let enclavePrivate: Data
    let ephemeralPublic: Data
    let wrapped: Data
  }
  private let service = "app.lakshly.Lakshly.encryption"
  private(set) var persisted = false
  private(set) var enclaveWrapped = false
  private var cached: SymmetricKey?
  private let info = Data("Lakshly AES wrapping v1".utf8)

  func key() -> SymmetricKey {
    if let cached { return cached }
    do {
      let query: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
        kSecAttrAccount as String: "dataset-key", kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
      ]
      var result: CFTypeRef?
      let status = SecItemCopyMatching(query as CFDictionary, &result)
      if status == errSecSuccess, let data = result as? Data {
        let key: SymmetricKey
        if let envelope = try? JSONDecoder().decode(Envelope.self, from: data) {
          let privateKey = try SecureEnclave.P256.KeyAgreement.PrivateKey(
            dataRepresentation: envelope.enclavePrivate)
          let publicKey = try P256.KeyAgreement.PublicKey(
            x963Representation: envelope.ephemeralPublic)
          let wrapping = try privateKey.sharedSecretFromKeyAgreement(with: publicKey)
            .hkdfDerivedSymmetricKey(
              using: SHA256.self, salt: Data(), sharedInfo: info, outputByteCount: 32)
          key = SymmetricKey(
            data: try AES.GCM.open(AES.GCM.SealedBox(combined: envelope.wrapped), using: wrapping))
          enclaveWrapped = true
        } else {
          guard data.count == 32 else { throw KeyError.invalid }
          key = SymmetricKey(data: data)
        }
        persisted = true
        cached = key
        return key
      }
      guard status == errSecItemNotFound else { throw KeyError.keychain(status) }
      let newKey = SymmetricKey(size: .bits256)
      let raw = newKey.withUnsafeBytes { Data($0) }
      let stored: Data
      if SecureEnclave.isAvailable {
        // Only the Enclave can use this private key. Persist its opaque representation,
        // the disposable peer's public key, and the authenticated wrapped AES key.
        let enclave = try SecureEnclave.P256.KeyAgreement.PrivateKey()
        let ephemeral = P256.KeyAgreement.PrivateKey()
        let wrapping = try enclave.sharedSecretFromKeyAgreement(with: ephemeral.publicKey)
          .hkdfDerivedSymmetricKey(
            using: SHA256.self, salt: Data(), sharedInfo: info, outputByteCount: 32)
        let box = try AES.GCM.seal(raw, using: wrapping)
        stored = try JSONEncoder().encode(
          Envelope(
            enclavePrivate: enclave.dataRepresentation,
            ephemeralPublic: ephemeral.publicKey.x963Representation, wrapped: box.combined!))
        enclaveWrapped = true
      } else {
        stored = raw
      }
      let attributes: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
        kSecAttrAccount as String: "dataset-key",
        kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
        kSecValueData as String: stored,
      ]
      let add = SecItemAdd(attributes as CFDictionary, nil)
      guard add == errSecSuccess else { throw KeyError.keychain(add) }
      persisted = true
      cached = newKey
      return newKey
    } catch {
      // Unsigned development builds can lack Keychain access. Never overwrite an
      // existing encrypted file with this temporary key; SecureStore enforces that.
      let temporary = SymmetricKey(size: .bits256)
      cached = temporary
      persisted = false
      enclaveWrapped = false
      return temporary
    }
  }
  private enum KeyError: Error {
    case invalid
    case keychain(OSStatus)
  }
}
