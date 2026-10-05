import CryptoKit
import XCTest

@testable import Lakshly

@MainActor
final class SetupStoreTests: XCTestCase {
  private var defaults: UserDefaults!
  private var suiteName: String!

  override func setUp() {
    super.setUp()
    suiteName = "app.lakshly.tests.setup.\(UUID().uuidString)"
    defaults = UserDefaults(suiteName: suiteName)
    defaults.removePersistentDomain(forName: suiteName)
  }

  override func tearDown() {
    if let suiteName { defaults?.removePersistentDomain(forName: suiteName) }
    defaults = nil
    suiteName = nil
    super.tearDown()
  }

  func testEmailIsAbsentFromFlagsAndSealedBytes() throws {
    let memory = MemoryStoredData()
    let store = DataStore(backing: memory, defaults: defaults)
    let session = SetupSession(store: store, defaults: defaults)
    let address = "setup.check@example.com"
    session.dispatch(.setEmail(address, provider: .gmail, pickerProvider: .google))
    for key in [SetupFlags.seen, SetupFlags.dismissed, SetupFlags.percent] {
      XCTAssertFalse(String(describing: defaults.object(forKey: key) ?? "").contains(address), key)
    }
    XCTAssertTrue(defaults.bool(forKey: SetupFlags.seen))
    XCTAssertFalse(defaults.bool(forKey: SetupFlags.dismissed))
    XCTAssertNotNil(defaults.object(forKey: SetupFlags.percent) as? Int)
    let blob = try XCTUnwrap(memory.payload)
    let email = Data(address.utf8)
    XCTAssertNotNil(blob.range(of: email))
    let key = SymmetricKey(size: .bits256)
    let sealed = try SecureStore.seal(blob, key: key)
    XCTAssertNil(sealed.range(of: email))
    let opened = try SecureStore.open(sealed, key: key)
    XCTAssertNotNil(opened.range(of: email))
    let decoded = try JSONDecoder().decode(StoredData.self, from: opened)
    XCTAssertEqual(decoded.setup?.email.primary, address)
  }

  func testDemoModeNeverCompletes() {
    let store = DataStore(backing: MemoryStoredData(), defaults: defaults)
    let session = SetupSession(store: store, defaults: defaults)
    session.dispatch(.chooseMode(.demo), pin: false)
    XCTAssertEqual(session.state.mode, .demo)
    XCTAssertEqual(session.state.currentStep, .email)
    XCTAssertTrue(session.state.sources.isEmpty)
    XCTAssertNil(session.state.completedAt)
    XCTAssertFalse(session.state.events.contains { $0.event == "setup.completed" })
    XCTAssertFalse(session.presented)
  }

  func testResetClearsSetupFlagsAndGoalsButKeepsImports() throws {
    let store = DataStore(backing: MemoryStoredData(), defaults: defaults)
    let session = SetupSession(store: store, defaults: defaults)
    session.dispatch(.setEmail("setup.check@example.com", provider: .other, pickerProvider: .other))
    session.saveGoal(
      Goal(
        id: "goal_setup01", name: "Emergency fund · 3 months", kind: .emergency, target: 100_000, saved: 0,
        monthly: 10_000, due: "2027-10-03", createdAt: "2026-10-03T00:00:00Z", createdBy: "setup"))
    _ = store.importParsed(Self.sampleResult(), fileName: "statement.csv")
    XCTAssertFalse(store.imports.isEmpty)
    store.reset()
    session.syncFromStore()
    XCTAssertNil(store.setup)
    XCTAssertNil(store.goals)
    XCTAssertNil(defaults.object(forKey: SetupFlags.seen))
    XCTAssertNil(defaults.object(forKey: SetupFlags.percent))
    XCTAssertFalse(store.imports.isEmpty)
    XCTAssertNil(session.state.completedAt)
  }

  func testDeleteMyDataClearsSetupAndImports() {
    let store = DataStore(backing: MemoryStoredData(), defaults: defaults)
    let session = SetupSession(store: store, defaults: defaults)
    session.dispatch(.setEmail("setup.check@example.com", provider: .other, pickerProvider: .other))
    _ = store.importParsed(Self.sampleResult())
    store.deleteMyData()
    session.syncFromStore()
    XCTAssertNil(store.setup)
    XCTAssertNil(store.goals)
    XCTAssertTrue(store.imports.isEmpty)
    XCTAssertEqual(store.source, .demo)
    XCTAssertNil(defaults.object(forKey: SetupFlags.seen))
  }

  func testDeepLinksOpenSetup() throws {
    let email = try XCTUnwrap(URL(string: "lakshly://setup?step=email"))
    XCTAssertEqual(GlanceLinks.effect(for: email, locked: false), .openSetup(step: "email"))
    XCTAssertEqual(GlanceLinks.effect(for: email, locked: true), .deferSetup(step: "email"))
    let plain = try XCTUnwrap(URL(string: "lakshly://setup"))
    XCTAssertEqual(GlanceLinks.effect(for: plain, locked: false), .openSetup(step: nil))
    let path = try XCTUnwrap(URL(string: "lakshly:///setup"))
    XCTAssertEqual(GlanceLinks.effect(for: path, locked: false), .openSetup(step: nil))
    let unknown = try XCTUnwrap(URL(string: "lakshly://setup?step=nope"))
    XCTAssertEqual(GlanceLinks.effect(for: unknown, locked: false), .openSetup(step: nil))
    let budget = try XCTUnwrap(URL(string: "lakshly://budget"))
    XCTAssertEqual(GlanceLinks.effect(for: budget, locked: false), .select("budget"))
    XCTAssertEqual(GlanceLinks.effect(for: URL(string: "https://example.com")!, locked: false), .ignore)
  }

  func testSetupDemoLaunchFlags() {
    #if DEBUG
    let options = LaunchOptions.parse(arguments: ["Lakshly", "-setupDemo", "plan", "-setupConsent", "yes"])
    XCTAssertEqual(options.setupDemo, "plan")
    XCTAssertEqual(options.setupConsent, true)
    #else
    XCTAssertNil(LaunchOptions.current.theme)
    #endif
  }

  func testSetupDemoFixtureStaysInMemory() throws {
    #if DEBUG
    let memory = MemoryStoredData()
    let store = DataStore(backing: memory, defaults: defaults)
    let before = memory.payload
    let session = SetupSession(store: store, defaults: defaults)
    let stateURL = try XCTUnwrap(
      Bundle(for: SetupStoreTests.self).url(forResource: "state.midway", withExtension: "json", subdirectory: "__fixtures__"))
    let dataURL = try XCTUnwrap(
      Bundle(for: SetupStoreTests.self).url(
        forResource: "dataset.after-import", withExtension: "json", subdirectory: "__fixtures__"))
    try session.loadDemo(
      step: "email", consent: true, stateData: Data(contentsOf: stateURL), datasetData: Data(contentsOf: dataURL))
    XCTAssertEqual(memory.payload, before)
    XCTAssertNil(store.setup)
    XCTAssertEqual(session.state.currentStep, .email)
    XCTAssertTrue(session.showConsent)
    XCTAssertTrue(session.presented)
    #else
    XCTAssertNil(LaunchOptions.current.appearance)
    #endif
  }

  func testEmbeddedImportAttributesHdfc() throws {
    let store = DataStore(backing: MemoryStoredData(), defaults: defaults)
    let session = SetupSession(store: store, defaults: defaults)
    session.dispatch(.chooseMode(.mine))
    session.dispatch(.toggleSource("hdfc-bank"))
    let url = try XCTUnwrap(
      Bundle(for: SetupStoreTests.self).url(
        forResource: "hdfc-bank.synthetic", withExtension: "pdf", subdirectory: "Parsers"))
    let document = try extractPdfText(data: Data(contentsOf: url), fileName: "hdfc-bank.synthetic.pdf")
    let result = parseDocument(document)
    XCTAssertEqual(result.adapter, "bank.hdfc")
    let report = store.importParsed(result, fileName: "hdfc-bank.synthetic.pdf")
    let entry = try XCTUnwrap(store.imports.last)
    XCTAssertTrue(entry.id.hasPrefix("imp_"))
    XCTAssertFalse(entry.accountIds.isEmpty)
    session.completeImport(
      report: report, result: result, importId: entry.id, fileName: "hdfc-bank.synthetic.pdf")
    let source = try XCTUnwrap(session.state.sources.first { $0.catalogId == "hdfc-bank" })
    XCTAssertEqual(source.status, .imported)
    XCTAssertTrue(source.importIds?.contains(entry.id) == true)
  }

  private static func sampleResult() -> ParseResult {
    ParseResult(
      adapter: "bank.hdfc", adapterLabel: "HDFC Bank", kind: "bank", confidence: 0.9,
      accounts: [
        ParseAccount(
          id: "acc_setup_1", name: "Imported Savings", type: "savings", institution: "HDFC Bank", mask: "0001",
          currency: "INR", balance: 10_000, invested: nil, creditLimit: nil, statementDay: nil, dueDay: nil,
          asOf: "2026-10-01", source: "import")
      ],
      transactions: [], sips: [], holdings: [], meta: [], warnings: [])
  }
}

final class SetupRenderTests: XCTestCase {
  @MainActor func testRenderSetupShots() throws {
    let environment = ProcessInfo.processInfo.environment
    let directory = environment["LAKSHLY_SHOTS_DIR"] ?? environment["TEST_RUNNER_LAKSHLY_SHOTS_DIR"]
    guard let directory, !directory.isEmpty, !directory.contains("$") else {
      throw XCTSkip("Set LAKSHLY_SHOTS_DIR to render setup shots.")
    }
    #if DEBUG
    let catalogURL = try XCTUnwrap(Bundle.main.url(forResource: "sources.catalog", withExtension: "json"))
    let stateURL = try XCTUnwrap(Bundle.main.url(forResource: "state.midway", withExtension: "json"))
    let dataURL = try XCTUnwrap(Bundle.main.url(forResource: "dataset.after-import", withExtension: "json"))
    let catalog = try SourcesCatalog.load(data: Data(contentsOf: catalogURL))
    let midway = try JSONDecoder().decode(SetupState.self, from: Data(contentsOf: stateURL))
    let dataset = try JSONDecoder().decode(Dataset.self, from: Data(contentsOf: dataURL))
    try SetupShotRenderer.render(
      to: URL(fileURLWithPath: directory, isDirectory: true), catalog: catalog, midway: midway, dataset: dataset)
    let themes = ["lakshmi-dark", "monochromeGold-light"]
    let names = ["welcome", "email", "accounts", "import", "plan", "done", "health", "consent"]
    for theme in themes {
      for name in names {
        let file = URL(fileURLWithPath: directory).appendingPathComponent("ios-\(name)-\(theme).png")
        let data = try Data(contentsOf: file)
        XCTAssertGreaterThan(data.count, 1000, file.lastPathComponent)
      }
    }
    #else
    throw XCTSkip("Setup rendering is compiled into DEBUG builds.")
    #endif
  }
}
