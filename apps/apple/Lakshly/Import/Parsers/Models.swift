import Foundation

/// Thrown when a PDF is encrypted. `incorrect` is false when no password was supplied.
struct PasswordRequired: Error, Equatable {
  var incorrect: Bool
}

struct TextItem {
  var str: String
  var x: Double
  var w: Double
}

struct TextLine {
  var page: Int
  var y: Double
  var items: [TextItem]
  var text: String
}

/// Text extracted from a document. Never contains the password or raw bytes.
struct TextDoc {
  var pages: Int
  var lines: [TextLine]
  var fileName: String?
}

struct ParseAccount: Encodable {
  var id: String
  var name: String
  var type: String
  var institution: String
  var mask: String?
  var currency: String
  var balance: Int
  var invested: Int?
  var creditLimit: Int?
  var statementDay: Int?
  var dueDay: Int?
  var asOf: String
  var source: String?

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(id, forKey: .id)
    try c.encode(name, forKey: .name)
    try c.encode(type, forKey: .type)
    try c.encode(institution, forKey: .institution)
    try c.encodeIfPresent(mask, forKey: .mask)
    try c.encode(currency, forKey: .currency)
    try c.encode(balance, forKey: .balance)
    try c.encodeIfPresent(invested, forKey: .invested)
    try c.encodeIfPresent(creditLimit, forKey: .creditLimit)
    try c.encodeIfPresent(statementDay, forKey: .statementDay)
    try c.encodeIfPresent(dueDay, forKey: .dueDay)
    try c.encode(asOf, forKey: .asOf)
    try c.encodeIfPresent(source, forKey: .source)
  }

  private enum CodingKeys: String, CodingKey {
    case id, name, type, institution, mask, currency, balance, invested, creditLimit, statementDay, dueDay, asOf, source
  }
}

struct ParseTransaction: Encodable {
  var id: String
  var accountId: String
  var date: String
  var amount: Int
  var description: String
  var merchant: String?
  var category: String
  var method: String?
  var recurring: Bool?
  var tags: [String]?
  var categorisedBy: String?

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(id, forKey: .id)
    try c.encode(accountId, forKey: .accountId)
    try c.encode(date, forKey: .date)
    try c.encode(amount, forKey: .amount)
    try c.encode(description, forKey: .description)
    try c.encodeIfPresent(merchant, forKey: .merchant)
    try c.encode(category, forKey: .category)
    try c.encodeIfPresent(method, forKey: .method)
    try c.encodeIfPresent(recurring, forKey: .recurring)
    try c.encodeIfPresent(tags, forKey: .tags)
    try c.encodeIfPresent(categorisedBy, forKey: .categorisedBy)
  }

  private enum CodingKeys: String, CodingKey {
    case id, accountId, date, amount, description, merchant, category, method, recurring, tags, categorisedBy
  }
}

struct ParseSip: Encodable {
  var id: String
  var scheme: String
  var platform: String?
  var amount: Int
  var dayOfMonth: Int
  var startDate: String
  var stepUpPctYearly: Double?
  var status: String
  var accountId: String?

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(id, forKey: .id)
    try c.encode(scheme, forKey: .scheme)
    try c.encodeIfPresent(platform, forKey: .platform)
    try c.encode(amount, forKey: .amount)
    try c.encode(dayOfMonth, forKey: .dayOfMonth)
    try c.encode(startDate, forKey: .startDate)
    try c.encodeIfPresent(stepUpPctYearly, forKey: .stepUpPctYearly)
    try c.encode(status, forKey: .status)
    try c.encodeIfPresent(accountId, forKey: .accountId)
  }

  private enum CodingKeys: String, CodingKey {
    case id, scheme, platform, amount, dayOfMonth, startDate, stepUpPctYearly, status, accountId
  }
}

struct Holding: Encodable {
  var accountId: String
  var scheme: String
  var amc: String
  var registrar: String
  var folioMask: String
  var isin: String?
  var units: Double
  var nav: Double
  var navDate: String
  var costValue: Int
  var marketValue: Int

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(accountId, forKey: .accountId)
    try c.encode(scheme, forKey: .scheme)
    try c.encode(amc, forKey: .amc)
    try c.encode(registrar, forKey: .registrar)
    try c.encode(folioMask, forKey: .folioMask)
    try c.encodeIfPresent(isin, forKey: .isin)
    try c.encode(units, forKey: .units)
    try c.encode(nav, forKey: .nav)
    try c.encode(navDate, forKey: .navDate)
    try c.encode(costValue, forKey: .costValue)
    try c.encode(marketValue, forKey: .marketValue)
  }

  private enum CodingKeys: String, CodingKey {
    case accountId, scheme, amc, registrar, folioMask, isin, units, nav, navDate, costValue, marketValue
  }
}

struct StatementMeta: Encodable {
  var adapter: String
  var kind: String
  var institution: String
  var accountId: String
  var periodFrom: String?
  var periodTo: String?
  var statementDate: String?
  var dueDate: String?
  var totalDue: Int?
  var minDue: Int?
  var openingBalance: Int?
  var closingBalance: Int?
  var issuer: String? = nil
  var totalValue: Int? = nil
  var quantityTransactionCount: Int? = nil

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(adapter, forKey: .adapter)
    try c.encode(kind, forKey: .kind)
    try c.encode(institution, forKey: .institution)
    try c.encode(accountId, forKey: .accountId)
    try c.encodeIfPresent(periodFrom, forKey: .periodFrom)
    try c.encodeIfPresent(periodTo, forKey: .periodTo)
    try c.encodeIfPresent(statementDate, forKey: .statementDate)
    try c.encodeIfPresent(dueDate, forKey: .dueDate)
    try c.encodeIfPresent(totalDue, forKey: .totalDue)
    try c.encodeIfPresent(minDue, forKey: .minDue)
    try c.encodeIfPresent(openingBalance, forKey: .openingBalance)
    try c.encodeIfPresent(closingBalance, forKey: .closingBalance)
    try c.encodeIfPresent(issuer, forKey: .issuer)
    try c.encodeIfPresent(totalValue, forKey: .totalValue)
    try c.encodeIfPresent(quantityTransactionCount, forKey: .quantityTransactionCount)
  }

  private enum CodingKeys: String, CodingKey {
    case adapter, kind, institution, accountId, periodFrom, periodTo, statementDate, dueDate
    case totalDue, minDue, openingBalance, closingBalance, issuer, totalValue, quantityTransactionCount
  }
}

struct ParseBody {
  var accounts: [ParseAccount]
  var transactions: [ParseTransaction]
  var sips: [ParseSip]
  var holdings: [Holding]
  var meta: [StatementMeta]
  var warnings: [String]
  var accountAliases: [String: String] = [:]
}

struct ParseResult: Encodable {
  var adapter: String
  var adapterLabel: String
  var kind: String
  var confidence: Double
  var accounts: [ParseAccount]
  var transactions: [ParseTransaction]
  var sips: [ParseSip]
  var holdings: [Holding]
  var meta: [StatementMeta]
  var warnings: [String]
  var accountAliases: [String: String] = [:]

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(adapter, forKey: .adapter)
    try c.encode(adapterLabel, forKey: .adapterLabel)
    try c.encode(kind, forKey: .kind)
    try c.encode(confidence, forKey: .confidence)
    try c.encode(accounts, forKey: .accounts)
    try c.encode(transactions, forKey: .transactions)
    try c.encode(sips, forKey: .sips)
    try c.encode(holdings, forKey: .holdings)
    try c.encode(meta, forKey: .meta)
    try c.encode(warnings, forKey: .warnings)
    if !accountAliases.isEmpty { try c.encode(accountAliases, forKey: .accountAliases) }
  }

  private enum CodingKeys: String, CodingKey {
    case adapter, adapterLabel, kind, confidence, accounts, transactions, sips, holdings, meta, warnings, accountAliases
  }
}

struct Adapter {
  var id: String
  var label: String
  var kind: String
  var institution: String
  var detect: (TextDoc) -> Double
  var parse: (TextDoc) -> ParseBody
}

struct ParseDataset {
  var schemaVersion: String
  var generatedAt: String
  var synthetic: Bool
  var notice: String?
  var currency: String
  var accounts: [ParseAccount]
  var transactions: [ParseTransaction]
  var sips: [ParseSip]
}

struct MergeReport: Equatable {
  var added: Int
  var duplicates: Int
  var accountsAdded: Int
  var accountsUpdated: Int
  var sipsUpserted: Int
}
