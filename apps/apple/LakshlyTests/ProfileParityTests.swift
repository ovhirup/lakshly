import XCTest
@testable import Lakshly

final class ProfileParityTests: XCTestCase {
  func testUnsetAndCleaning() {
    XCTAssertEqual(ProfileRecord().displayName, "You")
    XCTAssertNil(ProfileRecord().initial)
    XCTAssertEqual(ProfileRecord.clean("  Asha   Rao  "), "Asha Rao")
    XCTAssertEqual(ProfileRecord.clean(" \n" + String(repeating: "a", count: 45) + "  ")?.count, 40)
    XCTAssertEqual(ProfileRecord.clean("A\u{202E}sha\u{0000}"), "Asha")
    var record = ProfileRecord()
    record.save(" Asha ")
    XCTAssertEqual(record.name, "Asha")
    XCTAssertEqual(record.initial, "A")
    record.clear()
    XCTAssertEqual(record.displayName, "You")
  }
  func testMigrationRunsOnce() {
    for seed in ProfileRecord.legacySeedNames {
      let migrated = ProfileRecord.migrate(record: nil, legacyName: "  " + seed.uppercased() + "  ")
      XCTAssertNil(migrated.name)
      XCTAssertTrue(migrated.legacyMigrationComplete)
      XCTAssertEqual(migrated.version, 2)
      XCTAssertEqual(migrated.nameSource, "user")
      XCTAssertNil(ProfileRecord.migrate(record: migrated, legacyName: "Asha").name)
      let user = ProfileRecord(name: seed)
      XCTAssertEqual(ProfileRecord.migrate(record: user, legacyName: nil).name, seed)
    }
    XCTAssertEqual(ProfileRecord.migrate(record: nil, legacyName: "  Asha ").name, "Asha")
  }
  @MainActor func testEncryptedRoundTripSaveClearAndLegacySetupMigration() throws {
    let memory = MemoryStoredData()
    let defaults = UserDefaults(suiteName: UUID().uuidString)!
    var state = initialSetup(now: "2026-10-10T00:00:00Z")
    state.profile.name = ProfileRecord.legacySeedNames[0]
    try memory.save(StoredData(dataset: DataStore.loadSeed(), requests: [], source: .demo, setup: state))
    let store = DataStore(backing: memory, defaults: defaults)
    XCTAssertNil(store.profile.name)
    XCTAssertEqual(store.setup?.profile.name, "")
    XCTAssertTrue(try XCTUnwrap(memory.load()?.profile).legacyMigrationComplete)
    store.saveProfile(" Asha ")
    XCTAssertEqual(try memory.load()?.profile?.name, "Asha")
    XCTAssertEqual(DataStore(backing: memory, defaults: defaults).profile.displayName, "Asha")
    store.clearProfile()
    XCTAssertNil(try memory.load()?.profile?.name)
    XCTAssertEqual(store.setup?.profile.name, "")
  }
  func testCurrencyAloneCompletesProfile() {
    let state = initialSetup(now: "2026-10-10T00:00:00Z")
    let score = checklist(state, SetupDataset(transactions: [], accounts: [], budgets: [], goals: []), .ios, today: "2026-10-10")
    XCTAssertTrue(score.items.first { $0.id == "profile" }?.done == true)
  }
  func testNoLegacySeedNameLiteralInAppSourcesOutsideMigrationList() throws {
    let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent().appendingPathComponent("Lakshly")
    guard FileManager.default.fileExists(atPath: root.path) else { throw XCTSkip("Source checkout required for source scan") }
    let files = try XCTUnwrap(FileManager.default.enumerator(at: root, includingPropertiesForKeys: nil))
    for case let file as URL in files where file.pathExtension == "swift" {
      for line in try String(contentsOf: file, encoding: .utf8).components(separatedBy: .newlines) {
        if file.lastPathComponent == "Profile.swift", line.contains("static let legacySeedNames =") { continue }
        for seed in ProfileRecord.legacySeedNames {
          XCTAssertFalse(line.lowercased().contains("\"" + seed + "\""), file.lastPathComponent)
        }
      }
    }
  }
}
