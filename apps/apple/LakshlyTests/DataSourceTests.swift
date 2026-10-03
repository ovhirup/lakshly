import XCTest

@testable import Lakshly

@MainActor
final class DataSourceTests: XCTestCase {
  private var defaults: UserDefaults!
  private var suiteName: String!

  override func setUp() {
    super.setUp()
    suiteName = "app.lakshly.tests.data-source.\(UUID().uuidString)"
    defaults = UserDefaults(suiteName: suiteName)
    defaults.removePersistentDomain(forName: suiteName)
  }

  override func tearDown() {
    if let suiteName { defaults?.removePersistentDomain(forName: suiteName) }
    defaults = nil
    suiteName = nil
    super.tearDown()
  }

  func testImportNeverChangesDemoDatasetAndSetsSourceMine() throws {
    let memory = MemoryStoredData()
    let store = DataStore(backing: memory, defaults: defaults)
    let demoTxnIDs = Set(try XCTUnwrap(store.demoDataset).transactions.map(\.id))
    let demoAccountIDs = Set(try XCTUnwrap(store.demoDataset).accounts.map(\.id))
    let demoSipIDs = Set((try XCTUnwrap(store.demoDataset).sips ?? []).map(\.id))
    XCTAssertEqual(store.source, .demo)

    let report = store.importParsed(Self.sampleResult(), now: Date(timeIntervalSince1970: 0))
    XCTAssertEqual(report.added, 1)
    XCTAssertEqual(store.source, .mine)
    XCTAssertEqual(defaults.string(forKey: DataStore.sourceHintKey), "mine")
    XCTAssertEqual(Set(try XCTUnwrap(store.demoDataset).transactions.map(\.id)), demoTxnIDs)
    XCTAssertEqual(Set(try XCTUnwrap(store.demoDataset).accounts.map(\.id)), demoAccountIDs)
    XCTAssertEqual(Set((try XCTUnwrap(store.demoDataset).sips ?? []).map(\.id)), demoSipIDs)
    XCTAssertTrue(try XCTUnwrap(store.userDataset).transactions.contains { $0.id == "txn_imported_1" })
    XCTAssertTrue(try XCTUnwrap(store.dataset).transactions.contains { $0.id == "txn_imported_1" })
    XCTAssertFalse(try XCTUnwrap(store.demoDataset).transactions.contains { $0.id == "txn_imported_1" })
  }

  func testSwitchingBackToDemoShowsUnchangedSeed() throws {
    let store = DataStore(backing: MemoryStoredData(), defaults: defaults)
    let seedIDs = Set(try XCTUnwrap(store.demoDataset).transactions.map(\.id))
    store.importParsed(Self.sampleResult())
    store.setSource(.demo)
    XCTAssertEqual(store.source, .demo)
    XCTAssertEqual(Set(try XCTUnwrap(store.dataset).transactions.map(\.id)), seedIDs)
    XCTAssertFalse(try XCTUnwrap(store.dataset).transactions.contains { $0.id == "txn_imported_1" })
    XCTAssertTrue(try XCTUnwrap(store.userDataset).transactions.contains { $0.id == "txn_imported_1" })
  }

  func testLegacyMixedStoredDataSplitsIntoUserDataset() throws {
    let seed = try DataStore.loadSeed()
    let extraAccount = Self.extraAccount()
    let extraTxn = Self.extraTransaction()
    let extraSip = Self.extraSip()
    let mixed = Dataset(
      schemaVersion: seed.schemaVersion,
      generatedAt: seed.generatedAt,
      synthetic: seed.synthetic,
      notice: seed.notice,
      currency: seed.currency,
      accounts: seed.accounts + [extraAccount],
      transactions: seed.transactions + [extraTxn],
      budgets: seed.budgets,
      debts: seed.debts,
      sips: (seed.sips ?? []) + [extraSip],
      rewards: seed.rewards)
    let migrated = StoredData(dataset: mixed, requests: []).separatingUserRows(seed: seed)
    XCTAssertEqual(migrated.source, .mine)
    XCTAssertEqual(Set(migrated.dataset.accounts.map(\.id)), Set(seed.accounts.map(\.id)))
    XCTAssertEqual(Set(migrated.dataset.transactions.map(\.id)), Set(seed.transactions.map(\.id)))
    XCTAssertEqual(Set((migrated.dataset.sips ?? []).map(\.id)), Set((seed.sips ?? []).map(\.id)))
    XCTAssertEqual(migrated.userDataset?.accounts.map(\.id), [extraAccount.id])
    XCTAssertEqual(migrated.userDataset?.transactions.map(\.id), [extraTxn.id])
    XCTAssertEqual(migrated.userDataset?.sips?.map(\.id), [extraSip.id])
  }

  func testLegacyFileWithoutExtraRowsStaysDemo() throws {
    let seed = try DataStore.loadSeed()
    let migrated = StoredData(dataset: seed, requests: []).separatingUserRows(seed: seed)
    XCTAssertEqual(migrated.source, .demo)
    XCTAssertNil(migrated.userDataset)
  }

  func testDataStoreMigratesLegacyMixedFileOnLoad() throws {
    let seed = try DataStore.loadSeed()
    let extraAccount = Self.extraAccount()
    let extraTxn = Self.extraTransaction()
    let mixed = Dataset(
      schemaVersion: seed.schemaVersion,
      generatedAt: seed.generatedAt,
      synthetic: seed.synthetic,
      notice: seed.notice,
      currency: seed.currency,
      accounts: seed.accounts + [extraAccount],
      transactions: seed.transactions + [extraTxn],
      budgets: seed.budgets,
      debts: seed.debts,
      sips: seed.sips,
      rewards: seed.rewards)
    struct Legacy: Encodable {
      var dataset: Dataset
      var requests: [CommunityRequest]
    }
    let memory = MemoryStoredData()
    memory.payload = try JSONEncoder().encode(Legacy(dataset: mixed, requests: []))
    let decoded = try JSONDecoder().decode(StoredData.self, from: try XCTUnwrap(memory.payload))
    XCTAssertNil(decoded.source)
    XCTAssertNil(decoded.userDataset)

    let store = DataStore(backing: memory, defaults: defaults)
    XCTAssertEqual(store.source, .mine)
    XCTAssertEqual(store.userDataset?.accounts.map(\.id), [extraAccount.id])
    XCTAssertEqual(store.userDataset?.transactions.map(\.id), [extraTxn.id])
    XCTAssertEqual(Set(try XCTUnwrap(store.demoDataset).accounts.map(\.id)), Set(seed.accounts.map(\.id)))
    XCTAssertEqual(defaults.string(forKey: DataStore.sourceHintKey), "mine")
  }

  func testDeleteMyDataClearsUserDatasetAndReturnsToDemo() throws {
    let store = DataStore(backing: MemoryStoredData(), defaults: defaults)
    store.importParsed(Self.sampleResult())
    XCTAssertTrue(store.hasUserData)
    store.deleteMyData()
    XCTAssertEqual(store.source, .demo)
    XCTAssertNil(store.userDataset)
    XCTAssertFalse(store.hasUserData)
    XCTAssertFalse(try XCTUnwrap(store.dataset).transactions.contains { $0.id == "txn_imported_1" })
    XCTAssertEqual(defaults.string(forKey: DataStore.sourceHintKey), "demo")
  }

  func testResetKeepsUserData() throws {
    let store = DataStore(backing: MemoryStoredData(), defaults: defaults)
    store.importParsed(Self.sampleResult())
    store.reset()
    XCTAssertEqual(store.source, .mine)
    XCTAssertTrue(try XCTUnwrap(store.userDataset).transactions.contains { $0.id == "txn_imported_1" })
    XCTAssertFalse(try XCTUnwrap(store.demoDataset).transactions.contains { $0.id == "txn_imported_1" })
  }

  func testPersistedRoundTripKeepsMineSourceAndUserRows() throws {
    let memory = MemoryStoredData()
    let store = DataStore(backing: memory, defaults: defaults)
    store.importParsed(Self.sampleResult(), now: Date(timeIntervalSince1970: 1_700_000_000))
    XCTAssertNotNil(memory.payload)

    let reloaded = DataStore(backing: memory, defaults: defaults)
    XCTAssertEqual(reloaded.source, .mine)
    XCTAssertEqual(reloaded.userDataset?.transactions.map(\.id), ["txn_imported_1"])
    XCTAssertEqual(reloaded.userDataset?.accounts.map(\.id), ["acc_imported_1"])
    XCTAssertFalse(try XCTUnwrap(reloaded.demoDataset).transactions.contains { $0.id == "txn_imported_1" })
    XCTAssertEqual(defaults.string(forKey: DataStore.sourceHintKey), "mine")
  }

  private static func sampleResult() -> ParseResult {
    ParseResult(
      adapter: "test",
      adapterLabel: "Test bank",
      kind: "bank",
      confidence: 1,
      accounts: [
        ParseAccount(
          id: "acc_imported_1", name: "Imported Savings", type: "savings",
          institution: "Imported Bank", mask: "0001", currency: "INR", balance: 50_000,
          invested: nil, creditLimit: nil, statementDay: nil, dueDay: nil, asOf: "2026-10-01",
          source: "import")
      ],
      transactions: [
        ParseTransaction(
          id: "txn_imported_1", accountId: "acc_imported_1", date: "2026-10-01", amount: -2_500,
          description: "Imported coffee", merchant: "Demo Cafe", category: "dining", method: "upi",
          recurring: nil, tags: nil, categorisedBy: "rules")
      ],
      sips: [],
      holdings: [],
      meta: [],
      warnings: [])
  }

  private static func extraAccount() -> Account {
    Account(
      id: "acc_user_extra", name: "Imported Savings", type: "savings", institution: "Imported Bank",
      mask: "4321", currency: "INR", balance: 12_000, invested: nil, creditLimit: nil,
      statementDay: nil, dueDay: nil, asOf: "2026-10-01", source: "import")
  }

  private static func extraTransaction() -> Transaction {
    Transaction(
      id: "txn_user_extra", accountId: "acc_user_extra", date: "2026-10-01", amount: -900,
      description: "Imported snack", merchant: "Kiosk", category: "dining", method: "upi",
      recurring: nil, tags: nil, categorisedBy: "rules")
  }

  private static func extraSip() -> SIP {
    SIP(
      id: "sip_user_extra", scheme: "Imported Flexi Cap", platform: "Imported App", amount: 100_000,
      dayOfMonth: 7, startDate: "2026-01-07", stepUpPctYearly: nil, status: "active",
      accountId: "acc_user_extra")
  }
}
