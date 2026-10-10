import Foundation
import Security
import Observation

protocol FeedbackSecretStoring {
  func save(_ secret: String, for id: String) throws
  func secret(for id: String) throws -> String?
}
struct FeedbackKeychain: FeedbackSecretStoring {
  private func query(_ id: String) -> [String: Any] {
    [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "app.lakshly.feedback",
      kSecAttrAccount as String: id, kSecAttrSynchronizable as String: false]
  }
  func save(_ secret: String, for id: String) throws {
    let attributes: [String: Any] = [kSecValueData as String: Data(secret.utf8),
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
    var status = SecItemUpdate(query(id) as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound { status = SecItemAdd(query(id).merging(attributes) { _, new in new } as CFDictionary, nil) }
    guard status == errSecSuccess else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }
  }
  func secret(for id: String) throws -> String? {
    var q = query(id); q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
    var item: CFTypeRef?
    let status = SecItemCopyMatching(q as CFDictionary, &item)
    if status == errSecItemNotFound { return nil }
    guard status == errSecSuccess, let data = item as? Data else { throw NSError(domain: NSOSStatusErrorDomain, code: Int(status)) }
    return String(data: data, encoding: .utf8)
  }
}
struct FeedbackRequest: Codable, Identifiable, Equatable {
  var id: String
  var kind: FeedbackMessageKind
  var title: String
  var area: String
  var createdAt: Date
  var premium: Bool
  var status: FeedbackStatus
  var replies: [FeedbackReply]
}
@MainActor @Observable final class FeedbackRequestStore {
  private(set) var requests: [FeedbackRequest]
  private let file: URL?
  let secrets: any FeedbackSecretStoring
  init(file: URL? = FeedbackRequestStore.defaultFile, secrets: any FeedbackSecretStoring = FeedbackKeychain(), requests: [FeedbackRequest] = []) {
    self.file = file; self.secrets = secrets
    self.requests = requests
    if let file, FileManager.default.fileExists(atPath: file.path), let data = try? Data(contentsOf: file),
       let saved = try? JSONDecoder().decode([FeedbackRequest].self, from: data) { self.requests = saved }
  }
  nonisolated static var defaultFile: URL {
    FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("app.lakshly.feedback/requests.json")
  }
  func add(_ request: FeedbackRequest, secret: String) throws {
    try secrets.save(secret, for: request.id)
    var next = requests; next.insert(request, at: 0); try persist(next); requests = next
  }
  func update(id: String, remote: FeedbackRemoteStatus) throws {
    var next = requests
    guard let index = next.firstIndex(where: { $0.id == id }) else { return }
    next[index].status = remote.status
    next[index].replies = next[index].replies.filter { $0.from == "auto" } + remote.replies.map {
      .init(from: "team", name: "Abhirup from Lakshly", at: $0.at, text: $0.text)
    }
    try persist(next); requests = next
  }
  private func persist(_ next: [FeedbackRequest]) throws {
    guard let file else { return }
    try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
    try JSONEncoder().encode(next).write(to: file, options: .atomic)
  }
}
struct FeedbackRoadmap: Decodable {
  var updated: String
  var items: [Item]
  struct Item: Decodable, Identifiable {
    var id: String; var title: String; var area: String; var status: FeedbackStatus; var votes: Int
    var shippedIn: String?; var credits: [String]?; var reason: String?
  }
  static func load() -> Self {
    guard let url = Bundle.main.url(forResource: "roadmap", withExtension: "json"),
      let data = try? Data(contentsOf: url), let roadmap = try? JSONDecoder().decode(Self.self, from: data) else { return .init(updated: "", items: []) }
    return roadmap
  }
}
