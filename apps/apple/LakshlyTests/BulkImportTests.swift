import XCTest
@testable import Lakshly

final class BulkImportTests: XCTestCase {
  private func file(_ name: String, _ content: String) -> BulkImportFile {
    BulkImportFile(name: name, data: Data(content.utf8))
  }
  func testFilterDedupeCopiesNewestAndAlreadyImported() {
    let first = file("Statement.csv", "one")
    var newer = file(" renamed.csv ", "one"); newer.modified = Date(timeIntervalSince1970: 100)
    let fallback = file("RENAMED.csv", "two")
    let other = file("notes.csv", "notes")
    let rows = BulkImportPlan.rows([first, newer, fallback, other], importedHashes: [first.hash]) { $0.name == "notes.csv" ? .notStatement : .statement }
    XCTAssertEqual(rows.count, 2)
    XCTAssertEqual(rows[0].file.id, newer.id)
    XCTAssertEqual(rows[0].copies, 3)
    XCTAssertEqual(rows[0].status, .imported)
    XCTAssertFalse(rows[0].selected)
    XCTAssertEqual(rows[1].status, .notStatement)
    XCTAssertFalse(rows[1].selected)
    let byKey = BulkImportPlan.rows([first], importedFileKeys: [first.fallbackKey]) { _ in .statement }
    XCTAssertEqual(byKey[0].status, .imported)
    let legacy = BulkImportPlan.rows([first], importedLegacyNames: [BulkImportFile.normalizedName(first.name)]) { _ in .statement }
    XCTAssertEqual(legacy[0].status, .imported)
    let stable = BulkImportPlan.rows([first, file("copy.csv", "one")]) { _ in .statement }
    XCTAssertEqual(stable.first?.file.id, first.id)
  }
  @MainActor func testSequentialStatusesPasswordReuseAndClearedBetweenRuns() async {
    let files = [file("first.pdf", "1"), file("second.pdf", "2"), file("third.pdf", "3")]
    let runner = BulkImportRunner(rows: BulkImportPlan.rows(files) { _ in .locked })
    var order: [String] = [], prompts = 0, active = 0
    await runner.run(attempt: { file, password in
      active += 1; XCTAssertEqual(active, 1)
      defer { active -= 1 }
      XCTAssertEqual(runner.rows.first { $0.id == file.id }?.status, .importing)
      XCTAssertTrue(runner.rows.filter { $0.status == .queued }.count <= 2)
      await Task.yield()
      if password != "synthetic-password" { return .needsPassword }
      order.append(file.name)
      return .imported
    }, password: { _, _ in
      prompts += 1
      XCTAssertEqual(runner.rows[0].status, .needsPassword)
      return BulkPasswordAnswer(password: "synthetic-password", reuse: true)
    })
    XCTAssertEqual(order, files.map(\.name))
    XCTAssertEqual(prompts, 1)
    XCTAssertEqual(runner.rows.map(\.status), [.imported, .imported, .imported])
    XCTAssertFalse(runner.running)
    var firstAttempt = true
    await runner.run(ids: [files[0].id], attempt: { _, password in
      if firstAttempt { XCTAssertNil(password); firstAttempt = false }
      return .imported
    }, password: { _, _ in XCTFail("No password needed"); return nil })
  }
  @MainActor func testWrongPasswordSkipFailureAndStop() async {
    let files = (1...4).map { file("statement-\($0).pdf", "\($0)") }
    let runner = BulkImportRunner(rows: BulkImportPlan.rows(files) { _ in .statement })
    var prompts = 0
    await runner.run(attempt: { file, password in
      if file.id == files[0].id { return password == "right" ? .imported : .needsPassword }
      if file.id == files[1].id { return .failed }
      runner.stopRequested = true
      return .imported
    }, password: { _, incorrect in
      prompts += 1
      XCTAssertEqual(incorrect, prompts > 1)
      return BulkPasswordAnswer(password: prompts == 1 ? "wrong" : "right", reuse: false)
    })
    XCTAssertEqual(runner.rows.map(\.status), [.imported, .failed, .imported, .skipped])
    XCTAssertEqual(prompts, 2)
    let skipped = BulkImportRunner(rows: BulkImportPlan.rows([files[0]]) { _ in .locked })
    await skipped.run(attempt: { _, _ in .needsPassword }, password: { _, _ in nil })
    XCTAssertEqual(skipped.rows[0].status, .skipped)
  }
  func testSyntheticParserFixturesFilter() throws {
    let bundle = Bundle(for: Self.self)
    for stem in ["hdfc-bank", "cas", "nsdl-cas", "cdsl-cas"] {
      let url = try XCTUnwrap(bundle.url(forResource: stem + ".synthetic", withExtension: "pdf", subdirectory: "Parsers"))
      let input = BulkImportFile(name: url.lastPathComponent, data: try Data(contentsOf: url))
      XCTAssertEqual(BulkStatementParser.classify(input), .statement, stem)
    }
    let url = try XCTUnwrap(bundle.url(forResource: "hdfc-bank-locked.synthetic", withExtension: "pdf", subdirectory: "Parsers"))
    XCTAssertEqual(BulkStatementParser.classify(BulkImportFile(name: url.lastPathComponent, data: try Data(contentsOf: url))), .locked)
    XCTAssertEqual(BulkStatementParser.classify(file("notes.csv", "shopping list\napples,bread")), .notStatement)
  }
  @MainActor func testFailedSaveRestoresDatasetAndLog() throws {
    let backing = FailingImportBacking()
    let store = DataStore(backing: backing, defaults: UserDefaults(suiteName: UUID().uuidString)!)
    let before = store.userDataset
    let source = store.source
    let month = store.selectedMonth
    let result = parseCsv("Date,Description,Debit,Credit,Balance\n01/09/2026,Synthetic purchase,10.00,,100.00")
    backing.fail = true
    store.importParsed(result, fileName: "Synthetic.csv", contentHash: "synthetic-hash", fileSize: 100)
    XCTAssertNotNil(store.error)
    XCTAssertEqual(store.imports.count, 0)
    XCTAssertEqual(store.userDataset?.accounts.count, before?.accounts.count)
    XCTAssertEqual(store.source, source)
    XCTAssertEqual(store.selectedMonth, month)
  }
  @MainActor func testBackToBackSavesPreserveBothImportsAndHashes() throws {
    let memory = MemoryStoredData()
    let store = DataStore(backing: memory, defaults: UserDefaults(suiteName: UUID().uuidString)!)
    let bundle = Bundle(for: Self.self)
    for stem in ["hdfc-bank", "cas"] {
      let url = try XCTUnwrap(bundle.url(forResource: stem + ".synthetic", withExtension: "pdf", subdirectory: "Parsers"))
      let file = BulkImportFile(name: url.lastPathComponent, data: try Data(contentsOf: url))
      let result = try BulkStatementParser.parse(file, password: nil)
      store.importParsed(result, fileName: file.name, contentHash: file.hash, fileSize: file.data.count)
      XCTAssertNil(store.error)
    }
    let saved = try XCTUnwrap(memory.load())
    XCTAssertEqual(saved.imports?.count, 2)
    XCTAssertEqual(Set(saved.imports?.compactMap(\.contentHash) ?? []).count, 2)
    XCTAssertGreaterThan(saved.userDataset?.accounts.count ?? 0, 1)
  }
}

private final class FailingImportBacking: StoredDataBacking {
  let memory = MemoryStoredData()
  var fail = false
  var keyPersisted: Bool { false }
  var keyEnclaveWrapped: Bool { false }
  func load() throws -> StoredData? { try memory.load() }
  func save(_ value: StoredData) throws {
    if fail { throw CocoaError(.fileWriteUnknown) }
    try memory.save(value)
  }
}
