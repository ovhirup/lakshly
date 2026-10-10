import Foundation

enum Money {
  /// Integer arithmetic preserves every paisa, including Int64.min.
  static func format(_ paise: Int64, dropZero: Bool = true) -> String {
    let magnitude = paise.magnitude
    let currency = CurrencyCode.inr  // INR until the profile currency lands (WP3); the symbol and grouping are WP2.
    let factor = UInt64(currency.minorFactor)
    let digits = String(magnitude / factor)
    let tail = String(digits.suffix(3))
    var head = String(digits.dropLast(min(3, digits.count)))
    var groups: [String] = []
    while !head.isEmpty {
      groups.insert(String(head.suffix(2)), at: 0)
      head = String(head.dropLast(min(2, head.count)))
    }
    groups.append(tail)
    let fraction = magnitude % factor
    let places = currency.info.exponent
    let decimal = places == 0 || (dropZero && fraction == 0) ? "" : String(format: ".%0\(places)d", Int(fraction))
    return (paise < 0 ? "−" : "") + "₹" + groups.joined(separator: ",") + decimal
  }
  /// Glance surfaces (widgets, Live Activity, menu bar) round to whole rupees.
  static func glance(_ paise: Int64) -> String {
    let step = CurrencyCode.inr.info.magnitude.glanceRounding
    let half = step / 2
    let rounded = paise >= 0 ? (paise + half) / step * step : (paise - half) / step * step
    return format(rounded)
  }
  static func compact(_ paise: Int64) -> String {
    let rupees = Double(paise) / Double(CurrencyCode.inr.minorFactor)
    for unit in CurrencyCode.inr.info.compactUnits where abs(rupees) >= Double(unit.thresholdMajor) {
      return String(format: "₹%.1f", rupees / Double(unit.thresholdMajor)) + unit.suffix
    }
    return format(paise)
  }
}
