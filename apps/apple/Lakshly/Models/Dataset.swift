import Foundation

struct Account: Codable, Identifiable {
  let id: String
  let name: String
  let type: String
  let institution: String
  let mask: String?
  let currency: String
  let balance: Int64
  let invested: Int64?
  let creditLimit: Int64?
  let statementDay: Int?
  let dueDay: Int?
  let asOf: String
  let source: String?
}

struct Transaction: Codable, Identifiable {
  let id: String
  let accountId: String
  let date: String
  let amount: Int64
  let description: String
  let merchant: String?
  let category: String
  let method: String?
  let recurring: Bool?
  let tags: [String]?
  let categorisedBy: String?
}

struct Budget: Codable, Identifiable {
  let id: String
  let month: String
  let category: String
  let limit: Int64
  let rollover: Bool?
}

struct Debt: Codable, Identifiable {
  let id: String
  let name: String
  let kind: String
  let lender: String?
  let principal: Int64
  let outstanding: Int64
  let annualRatePct: Double
  let emi: Int64
  let startDate: String
  let tenureMonths: Int
  let accountId: String?
}

struct SIP: Codable, Identifiable {
  let id: String
  let scheme: String
  let platform: String?
  let amount: Int64
  let dayOfMonth: Int
  let startDate: String
  let stepUpPctYearly: Double?
  let status: String
  let accountId: String?
}

struct Reward: Codable, Identifiable {
  let id: String
  let program: String
  let kind: String
  let balance: Int64
  let valuePerUnitPaise: Int64?
  let expiresOn: String?
  let accountId: String?
  let asOf: String
}

struct Dataset: Codable {
  let schemaVersion: String
  let generatedAt: String
  let synthetic: Bool?
  let notice: String?
  let currency: String
  let accounts: [Account]
  let transactions: [Transaction]
  let budgets: [Budget]?
  let debts: [Debt]?
  let sips: [SIP]?
  let rewards: [Reward]?
}

/// One imported file, kept with the encrypted dataset so a later setup pass can attribute it.
struct ImportLogEntry: Codable, Equatable, Identifiable {
  var id: String
  var at: String
  var file: String
  var adapter: String
  var accountIds: [String]
  var added: Int
  var duplicates: Int
  var confidence: Double?
  var contentHash: String? = nil
  var fileSize: Int? = nil
}
struct AmountGroup: Identifiable {
  var id: String { name }
  let name: String
  let amount: Int64
}
struct CommunityRequest: Codable, Identifiable {
  var id = UUID().uuidString
  let title: String
  let details: String
  let type: String
  let author: String
  let priority: Bool
  var status: String
}
enum DataSource: String, Codable, CaseIterable {
  case demo, mine
}

struct StoredData: Codable {
  var dataset: Dataset
  var requests: [CommunityRequest]
  var source: DataSource?
  var userDataset: Dataset?
  var setup: SetupState?
  var goals: [Goal]?
  var imports: [ImportLogEntry]?
  var profile: ProfileRecord?

  init(
    dataset: Dataset,
    requests: [CommunityRequest],
    source: DataSource? = nil,
    userDataset: Dataset? = nil,
    setup: SetupState? = nil,
    goals: [Goal]? = nil,
    imports: [ImportLogEntry]? = nil,
    profile: ProfileRecord? = nil
  ) {
    self.dataset = dataset
    self.requests = requests
    self.source = source
    self.userDataset = userDataset
    self.setup = setup
    self.goals = goals
    self.profile = profile
    self.imports = imports
  }

  /// Splits a pre-source saved file: rows whose ids are not in the bundled seed become `userDataset`.
  func separatingUserRows(seed: Dataset) -> StoredData {
    if source != nil {
      return StoredData(
        dataset: seed,
        requests: requests,
        source: source ?? .demo,
        userDataset: userDataset,
        setup: setup,
        goals: goals,
        imports: imports, profile: profile)
    }
    let user = dataset.userRows(notIn: seed)
    return StoredData(
      dataset: seed,
      requests: requests,
      source: user == nil ? .demo : .mine,
      userDataset: user, setup: setup, goals: goals, imports: imports, profile: profile)
  }
}

extension Dataset {
  func userRows(notIn seed: Dataset) -> Dataset? {
    let seedAccounts = Set(seed.accounts.map(\.id))
    let seedTransactions = Set(seed.transactions.map(\.id))
    let seedSips = Set((seed.sips ?? []).map(\.id))
    let accounts = accounts.filter { !seedAccounts.contains($0.id) }
    let transactions = transactions.filter { !seedTransactions.contains($0.id) }
    let sips = (sips ?? []).filter { !seedSips.contains($0.id) }
    guard !accounts.isEmpty || !transactions.isEmpty || !sips.isEmpty else { return nil }
    return Dataset(
      schemaVersion: schemaVersion,
      generatedAt: generatedAt,
      synthetic: false,
      notice: notice,
      currency: currency,
      accounts: accounts,
      transactions: transactions,
      budgets: nil,
      debts: nil,
      sips: sips,
      rewards: nil)
  }

  func replacingBudgets(_ budgets: [Budget]?) -> Dataset {
    Dataset(
      schemaVersion: schemaVersion, generatedAt: generatedAt, synthetic: synthetic, notice: notice,
      currency: currency, accounts: accounts, transactions: transactions, budgets: budgets, debts: debts,
      sips: sips, rewards: rewards)
  }

  func replacingCurrency(_ currency: String) -> Dataset {
    Dataset(
      schemaVersion: schemaVersion, generatedAt: generatedAt, synthetic: synthetic, notice: notice,
      currency: currency, accounts: accounts, transactions: transactions, budgets: budgets, debts: debts,
      sips: sips, rewards: rewards)
  }
}
