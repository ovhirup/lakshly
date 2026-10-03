import Foundation

enum GlanceTier: String, Codable, Equatable, Sendable {
  case free
  case premium

  init(_ tier: Tier) { self = tier >= .premium ? .premium : .free }
  var accessTier: Tier { self == .premium ? .premium : .free }
}

enum GlanceAppearance: String, Codable, Equatable, Sendable {
  case system, light, dark

  init(stored: String) { self = GlanceAppearance(rawValue: stored) ?? .system }
}

enum GlancePace: String, Codable, Equatable, Sendable {
  case ahead
  case onTrack = "on-track"
  case over

  var word: String {
    switch self {
    case .ahead: "Ahead"
    case .onTrack: "On track"
    case .over: "Over"
    }
  }
}

enum GlanceBillKind: String, Codable, Equatable, Sendable {
  case card, emi, sip

  var word: String {
    switch self {
    case .card: "Card"
    case .emi: "EMI"
    case .sip: "SIP"
    }
  }

  var symbol: String {
    switch self {
    case .card: "creditcard"
    case .emi: "calendar"
    case .sip: "arrow.triangle.2.circlepath"
    }
  }
}

enum GlanceTrend: String, Codable, Equatable, Sendable {
  case up, down, flat

  var word: String {
    switch self {
    case .up: "Up"
    case .down: "Down"
    case .flat: "Flat"
    }
  }

  var symbol: String {
    switch self {
    case .up: "arrow.up.right"
    case .down: "arrow.down.right"
    case .flat: "arrow.right"
    }
  }
}

struct GlanceBudgetPace: Codable, Equatable, Sendable {
  var monthSpendPercent: Double
  var monthElapsedPercent: Double
  var status: GlancePace
  /// Paise per remaining day. Nil when amounts are omitted or this month has no budget.
  var safeToSpendPerDay: Int64?
}

struct GlanceBill: Codable, Equatable, Sendable {
  var name: String
  var dueDate: Date
  var kind: GlanceBillKind
  /// Paise. Nil when amounts are omitted.
  var amount: Int64?
}

struct GlanceSnapshot: Codable, Equatable, Sendable {
  static let currentVersion = 1

  var version: Int
  var generatedAt: Date
  var tier: GlanceTier
  var themeID: String
  var appearance: GlanceAppearance
  var budget: GlanceBudgetPace
  var nextBill: GlanceBill?
  var debtRepaidPercent: Double
  var netWorthTrend: GlanceTrend
  var netWorth: Int64?
  var debtOutstanding: Int64?

  init(
    version: Int = GlanceSnapshot.currentVersion,
    generatedAt: Date,
    tier: GlanceTier,
    themeID: String,
    appearance: GlanceAppearance,
    budget: GlanceBudgetPace,
    nextBill: GlanceBill?,
    debtRepaidPercent: Double,
    netWorthTrend: GlanceTrend,
    netWorth: Int64?,
    debtOutstanding: Int64?
  ) {
    self.version = version
    self.generatedAt = generatedAt
    self.tier = tier
    self.themeID = themeID
    self.appearance = appearance
    self.budget = budget
    self.nextBill = nextBill
    self.debtRepaidPercent = debtRepaidPercent
    self.netWorthTrend = netWorthTrend
    self.netWorth = netWorth
    self.debtOutstanding = debtOutstanding
  }

  func omittingAmounts() -> GlanceSnapshot {
    var copy = self
    copy.budget.safeToSpendPerDay = nil
    if var bill = copy.nextBill {
      bill.amount = nil
      copy.nextBill = bill
    }
    copy.netWorth = nil
    copy.debtOutstanding = nil
    return copy
  }

  static var placeholder: GlanceSnapshot {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    let generated = calendar.date(from: DateComponents(year: 2026, month: 9, day: 10, hour: 12)) ?? Date()
    let due = calendar.date(from: DateComponents(year: 2026, month: 9, day: 25)) ?? generated
    return GlanceSnapshot(
      generatedAt: generated,
      tier: .premium,
      themeID: "lakshmi",
      appearance: .system,
      budget: GlanceBudgetPace(
        monthSpendPercent: 42, monthElapsedPercent: 50, status: .onTrack, safeToSpendPerDay: 85_000),
      nextBill: GlanceBill(name: "Rewards Card", dueDate: due, kind: .card, amount: 450_000),
      debtRepaidPercent: 40,
      netWorthTrend: .up,
      netWorth: 56_000_000,
      debtOutstanding: 18_100_000)
  }
}

extension GlanceSnapshot {
  private enum CodingKeys: String, CodingKey {
    case version, generatedAt, tier, themeID, appearance, budget, nextBill
    case debtRepaidPercent, netWorthTrend, netWorth, debtOutstanding
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    version = try container.decodeIfPresent(Int.self, forKey: .version) ?? Self.currentVersion
    generatedAt = try container.decode(Date.self, forKey: .generatedAt)
    tier = try container.decode(GlanceTier.self, forKey: .tier)
    themeID = try container.decode(String.self, forKey: .themeID)
    appearance = try container.decode(GlanceAppearance.self, forKey: .appearance)
    budget = try container.decode(GlanceBudgetPace.self, forKey: .budget)
    nextBill = try container.decodeIfPresent(GlanceBill.self, forKey: .nextBill)
    debtRepaidPercent = try container.decode(Double.self, forKey: .debtRepaidPercent)
    netWorthTrend = try container.decode(GlanceTrend.self, forKey: .netWorthTrend)
    netWorth = try container.decodeIfPresent(Int64.self, forKey: .netWorth)
    debtOutstanding = try container.decodeIfPresent(Int64.self, forKey: .debtOutstanding)
  }

  func encode(to encoder: Encoder) throws {
    var container = encoder.container(keyedBy: CodingKeys.self)
    try container.encode(version, forKey: .version)
    try container.encode(generatedAt, forKey: .generatedAt)
    try container.encode(tier, forKey: .tier)
    try container.encode(themeID, forKey: .themeID)
    try container.encode(appearance, forKey: .appearance)
    try container.encode(budget, forKey: .budget)
    try container.encodeIfPresent(nextBill, forKey: .nextBill)
    try container.encode(debtRepaidPercent, forKey: .debtRepaidPercent)
    try container.encode(netWorthTrend, forKey: .netWorthTrend)
    try container.encodeIfPresent(netWorth, forKey: .netWorth)
    try container.encodeIfPresent(debtOutstanding, forKey: .debtOutstanding)
  }
}

enum GlanceCoding {
  static func encoder() -> JSONEncoder {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    encoder.dateEncodingStrategy = .iso8601
    return encoder
  }

  static func decoder() -> JSONDecoder {
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    return decoder
  }
}

enum GlanceWidgetKind: Equatable, Sendable, CaseIterable {
  case budgetPace, upcomingBill, netWorth, debt

  var feature: Feature {
    switch self {
    case .budgetPace, .upcomingBill: .basicWidgets
    case .netWorth, .debt: .extraWidgets
    }
  }

  var deepLink: String {
    switch self {
    case .budgetPace: "lakshly://budget"
    case .upcomingBill, .netWorth: "lakshly://overview"
    case .debt: "lakshly://debt"
    }
  }

  var displayName: String {
    switch self {
    case .budgetPace: "Budget pace"
    case .upcomingBill: "Upcoming bill"
    case .netWorth: "Net worth"
    case .debt: "Debt"
    }
  }
}

enum GlanceWidgetAccess {
  static func allows(_ kind: GlanceWidgetKind, tier: Tier) -> Bool {
    can(kind.feature, tier: tier)
  }
}

enum GlanceSurface: Equatable, Sendable {
  case home, lockScreen
}

struct GlanceAmountText: Equatable, Sendable {
  var text: String
  var isPrivate: Bool
  static let masked = GlanceAmountText(text: "••••", isPrivate: false)
  static func shown(_ paise: Int64) -> GlanceAmountText {
    GlanceAmountText(text: Money.format(paise), isPrivate: true)
  }
}

enum GlanceAmounts {
  static func allows(surface: GlanceSurface, showAmounts: Bool, lockScreenAmounts: Bool) -> Bool {
    surface == .lockScreen ? lockScreenAmounts : showAmounts
  }

  static func display(
    _ paise: Int64?, surface: GlanceSurface, showAmounts: Bool, lockScreenAmounts: Bool
  ) -> GlanceAmountText {
    guard allows(surface: surface, showAmounts: showAmounts, lockScreenAmounts: lockScreenAmounts),
          let paise else { return .masked }
    return .shown(paise)
  }
}

enum GlanceFormat {
  static func percent(_ value: Double, digits: Int = 0) -> String {
    if digits <= 0 { return "\(Int(value.rounded()))%" }
    return String(format: "%.\(digits)f%%", value)
  }
}

enum GlancePrivacy {
  /// Masks runs of 6 or more digits so an account number cannot ride along in a widget name.
  static func displayName(_ value: String) -> String {
    var result = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !result.isEmpty, let regex = try? NSRegularExpression(pattern: "[0-9]{6,}") else { return result }
    let matches = regex.matches(in: result, range: NSRange(result.startIndex..., in: result))
    for match in matches.reversed() {
      guard let range = Range(match.range, in: result) else { continue }
      let suffix = result[range].filter(\.isNumber).suffix(4)
      result.replaceSubrange(range, with: "••••" + suffix)
    }
    return result
  }
}
