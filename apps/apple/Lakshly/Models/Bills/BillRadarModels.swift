/// Bill radar value types. Shared with the widget extension, so no app-only dependencies here.
import Foundation

enum BillKind: String, Codable, CaseIterable, Sendable {
  case card, emi, insurance, fee, subscription, sip

  var title: String {
    switch self {
    case .card: "Card bill"
    case .emi: "EMI"
    case .insurance: "Insurance"
    case .fee: "Fee"
    case .subscription: "Subscription"
    case .sip: "SIP"
    }
  }

  var symbol: String {
    switch self {
    case .card: "creditcard"
    case .emi: "building.columns"
    case .insurance: "shield.lefthalf.filled"
    case .fee: "calendar.badge.clock"
    case .subscription: "repeat"
    case .sip: "chart.line.uptrend.xyaxis"
    }
  }

  var rank: Int { Self.allCases.firstIndex(of: self) ?? 0 }
}

struct RadarBill: Equatable, Identifiable, Sendable {
  var id: String { "\(kind.rawValue):\(sourceId):\(due)" }
  var sourceId: String
  var kind: BillKind
  var name: String
  var due: String
  var daysLeft: Int
  var amount: Int64?
  var paid: Bool
  var muted: Bool
}

struct BillRadarState: Codable, Equatable, Sendable {
  var paid: [String]
  var muted: [String]
  var leadDays: Int
  var alertsOn: Bool
  var amountsInAlerts: Bool

  init(
    paid: [String] = [], muted: [String] = [], leadDays: Int = 3,
    alertsOn: Bool = false, amountsInAlerts: Bool = false
  ) {
    let recent = Set(paid).sorted {
      let lhs = $0.split(separator: ":").last.map(String.init) ?? ""
      let rhs = $1.split(separator: ":").last.map(String.init) ?? ""
      return lhs == rhs ? $0 < $1 : lhs < rhs
    }.suffix(200)
    self.paid = recent.sorted()
    self.muted = Array(Set(muted)).sorted()
    self.leadDays = [1, 3, 7].contains(leadDays) ? leadDays : 3
    self.alertsOn = alertsOn
    self.amountsInAlerts = amountsInAlerts
  }

  enum CodingKeys: String, CodingKey {
    case paid, muted, leadDays, alertsOn, amountsInAlerts
  }

  init(from decoder: Decoder) throws {
    guard let c = try? decoder.container(keyedBy: CodingKeys.self) else {
      self.init()
      return
    }
    self.init(
      paid: (try? c.decode([String].self, forKey: .paid)) ?? [],
      muted: (try? c.decode([String].self, forKey: .muted)) ?? [],
      leadDays: (try? c.decode(Int.self, forKey: .leadDays)) ?? 3,
      alertsOn: (try? c.decode(Bool.self, forKey: .alertsOn)) ?? false,
      amountsInAlerts: (try? c.decode(Bool.self, forKey: .amountsInAlerts)) ?? false)
  }
}
