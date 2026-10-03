import Foundation
import Observation

@MainActor @Observable final class DataStore {
  static let sourceHintKey = "data.source"

  private(set) var source: DataSource = .demo
  var demoDataset: Dataset?
  var userDataset: Dataset?
  var requests: [CommunityRequest] = []
  var setup: SetupState?
  var goals: [Goal]?
  var imports: [ImportLogEntry] = []
  /// Bumps when setup, flags, and goals are cleared so an in-memory wizard drops its copy.
  var setupEpoch = 0
  var error: String?
  var selectedMonth = "2026-09"
  private let backing: StoredDataBacking
  private let defaults: UserDefaults
  private var writable = true
  private var importSerial: UInt8 = 0

  /// Active dataset: the bundled seed on Demo, the imported rows (or an empty dataset) on My data.
  var dataset: Dataset? {
    switch source {
    case .demo: demoDataset
    case .mine: userDataset ?? Self.emptyUserDataset()
    }
  }

  var encryptionStatus: String {
    backing.keyPersisted
      ? (backing.keyEnclaveWrapped
        ? "AES-GCM · Secure Enclave wrapped key" : "AES-GCM · Keychain key")
      : "Encryption key not persisted (dev build)"
  }

  var months: [String] {
    Array(Set((dataset?.transactions ?? []).map { String($0.date.prefix(7)) })).sorted()
  }

  var transactions: [Transaction] {
    (dataset?.transactions ?? []).filter { $0.date.hasPrefix(selectedMonth) }
  }

  var categoryTotals: [AmountGroup] {
    totals(transactions.filter { $0.amount < 0 }, by: { $0.category })
  }

  var hasUserData: Bool {
    if !(goals ?? []).isEmpty || !imports.isEmpty { return true }
    guard let user = userDataset else { return false }
    return !user.accounts.isEmpty || !user.transactions.isEmpty || !(user.sips ?? []).isEmpty
      || !(user.debts ?? []).isEmpty || !(user.rewards ?? []).isEmpty || !(user.budgets ?? []).isEmpty
  }

  func totals(_ transactions: [Transaction], by group: (Transaction) -> String) -> [AmountGroup] {
    Dictionary(grouping: transactions, by: group).map {
      AmountGroup(name: $0.key, amount: $0.value.reduce(0) { $0 + abs($1.amount) })
    }.sorted { $0.amount > $1.amount }
  }

  init(backing: StoredDataBacking = SecureStore(), defaults: UserDefaults = .standard) {
    self.backing = backing
    self.defaults = defaults
    do {
      let seed = try Self.loadSeed()
      if let saved = try backing.load() {
        let migrated = saved.separatingUserRows(seed: seed)
        demoDataset = migrated.dataset
        userDataset = migrated.userDataset
        source = migrated.source ?? .demo
        requests = migrated.requests
        setup = migrated.setup
        goals = migrated.goals
        imports = migrated.imports ?? []
        persistSourceHint()
        if saved.source == nil { save() }
      } else {
        source = .demo
        persistSourceHint()
        try applySeed(seed, persist: true)
      }
    } catch {
      writable = false
      self.error =
        "Saved data could not be opened. Demo data is shown; your saved file is preserved. Reset demo data to replace it."
      try? applySeed(try? Self.loadSeed(), persist: false)
    }
    applyLaunchSource()
  }

  func save() {
    guard writable, let demoDataset else { return }
    do {
      try backing.save(
        StoredData(
          dataset: demoDataset, requests: requests, source: source, userDataset: userDataset, setup: setup,
          goals: goals, imports: imports))
      error = nil
    } catch { self.error = "Could not save locally: \(error.localizedDescription)" }
    GlancePublisher.publish(dataset: dataset)
  }

  func submit(title: String, details: String, type: String, premium: Bool) -> Bool {
    requests.append(
      CommunityRequest(
        title: title, details: details, type: type, author: "Demo user", priority: premium,
        status: "Received"))
    save()
    if error != nil {
      requests.removeLast()
      return false
    }
    return true
  }

  func setSource(_ new: DataSource) {
    if new == .mine, userDataset == nil {
      userDataset = Self.emptyUserDataset()
    }
    source = new
    persistSourceHint()
    selectLatestMonth()
    save()
  }

  func adoptUserDataset(_ dataset: Dataset) {
    userDataset = dataset
    source = .mine
    persistSourceHint()
    selectLatestMonth()
    save()
  }

  func deleteMyData() {
    userDataset = nil
    imports = []
    source = .demo
    persistSourceHint()
    selectLatestMonth()
    clearSetup(save: false)
    save()
  }

  /// Reloads the bundled synthetic seed. Imported user data is kept. Setup, goals, and flags are cleared.
  func reset() {
    writable = true
    clearSetup(save: false)
    do {
      try applySeed(try Self.loadSeed(), persist: true)
    } catch { self.error = error.localizedDescription }
  }

  func clearSetup(save shouldSave: Bool = true) {
    setup = nil
    goals = nil
    SetupFlags.clear(defaults)
    setupEpoch += 1
    if shouldSave { save() }
  }

  func nextImportID(now: Date) -> String {
    importSerial &+= 1
    let millis = UInt64(max(0, now.timeIntervalSince1970 * 1000))
    return String(format: "imp_%012llx%02x", millis & 0xffffffffffff, importSerial)
  }

  static func emptyUserDataset(now: Date = Date()) -> Dataset {
    Dataset(
      schemaVersion: "0.1.0",
      generatedAt: isoTimestamp(now),
      synthetic: false,
      notice: nil,
      currency: "INR",
      accounts: [],
      transactions: [],
      budgets: [],
      debts: [],
      sips: [],
      rewards: [])
  }

  static func loadSeed() throws -> Dataset {
    guard let url = Bundle.main.url(forResource: "sample.synthetic", withExtension: "json") else {
      throw CocoaError(.fileNoSuchFile)
    }
    return try JSONDecoder().decode(Dataset.self, from: Data(contentsOf: url))
  }

  private func applySeed(_ seed: Dataset?, persist: Bool) throws {
    guard let seed else { throw CocoaError(.fileNoSuchFile) }
    demoDataset = seed
    requests = Self.seedRequests()
    if persist { save() }
  }

  func selectLatestMonth() {
    if let latest = months.last { selectedMonth = latest }
  }

  func persistSourceHint() {
    defaults.set(source.rawValue, forKey: Self.sourceHintKey)
  }

  private func applyLaunchSource() {
    #if DEBUG
    guard let override = LaunchOptions.current.dataSource else { return }
    switch override {
    case "mine":
      source = .mine
      if userDataset == nil { userDataset = Self.emptyUserDataset() }
    case "demo":
      source = .demo
    default:
      return
    }
    selectLatestMonth()
    #endif
  }

  private static func seedRequests() -> [CommunityRequest] {
    zip(
      [
        "Category colours", "SIP reminders", "Larger type", "Rollover clarity", "Search merchants",
        "Debt milestones",
      ], ["Asha R.", "Dev M.", "Mira K.", "Sam T.", "Ira P.", "Nila S."]
    ).enumerated().map { index, pair in
      CommunityRequest(
        title: pair.0, details: "A synthetic community suggestion for a calmer finance experience.",
        type: index == 2 ? "Bug" : "Feature", author: pair.1, priority: index == 1 || index == 4,
        status: ["Shipped", "Planned", "In progress", "Received", "Shipped", "Received"][index])
    }
  }
}
