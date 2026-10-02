import CryptoKit
import Foundation

/// Encrypts local demo data and preserves saved files when a persistent key is unavailable.
final class SecureStore {
  let keys = KeyManager()
  private let file: URL
  init() {
    let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[
      0]
    file = support.appendingPathComponent("Lakshly", isDirectory: true).appendingPathComponent(
      "dataset.aesgcm")
  }
  static func seal(_ data: Data, key: SymmetricKey) throws -> Data {
    try AES.GCM.seal(data, using: key).combined!
  }
  static func open(_ data: Data, key: SymmetricKey) throws -> Data {
    try AES.GCM.open(AES.GCM.SealedBox(combined: data), using: key)
  }
  func load() throws -> StoredData? {
    let key = keys.key()
    guard keys.persisted, FileManager.default.fileExists(atPath: file.path) else { return nil }
    return try JSONDecoder().decode(
      StoredData.self, from: Self.open(Data(contentsOf: file), key: key))
  }
  func save(_ value: StoredData) throws {
    let key = keys.key()
    // In-memory fallback deliberately keeps changes in memory, preserving any saved file.
    guard keys.persisted else { return }
    try FileManager.default.createDirectory(
      at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
    try Self.seal(JSONEncoder().encode(value), key: key).write(to: file, options: .atomic)
  }
}
