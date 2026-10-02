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
struct StoredData: Codable {
  let dataset: Dataset
  var requests: [CommunityRequest]
}
