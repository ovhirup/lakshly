import Foundation

/// Stored only in the encrypted StoredData payload. The marker makes legacy cleanup one-time.
struct ProfileRecord: Codable, Equatable, Hashable {
  static let legacySeedNames = ["abhirup", "tester", "beta tester"]
  var version = 2
  var name: String?
  var nameSource = "user"
  var legacyMigrationComplete = true

  init(name: String? = nil) { self.name = Self.clean(name ?? "") }
  var displayName: String { name ?? "You" }
  var initial: String? { name?.first.map { String($0).uppercased() } }
  mutating func save(_ value: String) { name = Self.clean(value) }
  mutating func clear() { name = nil }

  static func clean(_ value: String) -> String? {
    let scalars = value.unicodeScalars.filter {
      !($0.value < 32 || $0.value == 127 || (0x202A...0x202E).contains($0.value) || (0x2066...0x2069).contains($0.value))
    }
    let spaced = String(String.UnicodeScalarView(scalars)).split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
    let result = String(spaced.prefix(40)).trimmingCharacters(in: .whitespacesAndNewlines)
    return result.isEmpty ? nil : result
  }

  static func migrate(record: ProfileRecord?, legacyName: String?) -> ProfileRecord {
    if let record, record.version == 2, record.legacyMigrationComplete { return record }
    let candidate = clean(record?.name ?? legacyName ?? "")
    let seed = candidate.map { legacySeedNames.contains($0.lowercased()) } ?? false
    return ProfileRecord(name: seed ? nil : candidate)
  }
}
