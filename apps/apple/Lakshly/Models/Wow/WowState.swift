import Foundation

/// One fee in the fee runway. `due` is a calendar day, `yyyy-MM-dd`.
struct WowFee: Codable, Equatable, Identifiable, Sendable {
  var id: String
  var name: String
  var amount: Int64
  var due: String
  var yearly: Bool
}

/// Encrypted wow preferences for My data or the synthetic demo. Bad fields fall back; decoding never throws.
struct WowState: Codable, Equatable, Sendable {
  /// What-if monthly extra, in paise. Clamped to 0...10_000_000_00.
  var extraPaise: Int64
  /// Cleared EMIs roll into the next debt.
  var rollOver: Bool
  /// Subscription-audit keys, sorted and unique.
  var plannedCancels: [String]
  var fees: [WowFee]
  var setAside: [String: Int64]

  static let extraPaiseMax: Int64 = 10_000_000_00

  init(
    extraPaise: Int64 = 0,
    rollOver: Bool = false,
    plannedCancels: [String] = [],
    fees: [WowFee] = [],
    setAside: [String: Int64] = [:]
  ) {
    self.extraPaise = Self.clampExtra(extraPaise)
    self.rollOver = rollOver
    self.plannedCancels = Self.uniqueSorted(plannedCancels)
    self.fees = fees
    self.setAside = setAside
  }

  enum CodingKeys: String, CodingKey {
    case extraPaise, rollOver, plannedCancels, fees, setAside
  }

  init(from decoder: Decoder) throws {
    guard let c = try? decoder.container(keyedBy: CodingKeys.self) else {
      self.init()
      return
    }
    func value<T: Decodable>(_ key: CodingKeys, _ fallback: T) -> T {
      ((try? c.decodeIfPresent(T.self, forKey: key)) ?? nil) ?? fallback
    }
    self.init(
      extraPaise: value(.extraPaise, Int64(0)),
      rollOver: value(.rollOver, false),
      plannedCancels: value(.plannedCancels, [String]()),
      fees: value(.fees, [WowFee]()),
      setAside: value(.setAside, [String: Int64]()))
  }

  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: CodingKeys.self)
    try c.encode(extraPaise, forKey: .extraPaise)
    try c.encode(rollOver, forKey: .rollOver)
    try c.encode(plannedCancels, forKey: .plannedCancels)
    try c.encode(fees, forKey: .fees)
    try c.encode(setAside, forKey: .setAside)
  }

  private static func clampExtra(_ value: Int64) -> Int64 {
    min(max(value, 0), extraPaiseMax)
  }

  private static func uniqueSorted(_ keys: [String]) -> [String] {
    Array(Set(keys)).sorted()
  }
}
