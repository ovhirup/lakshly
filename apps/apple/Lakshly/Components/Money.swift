import Foundation

enum Money {
  /// Integer arithmetic preserves every paisa, including Int64.min.
  static func format(_ paise: Int64, dropZero: Bool = true) -> String {
    let magnitude = paise.magnitude
    let digits = String(magnitude / 100)
    let tail = String(digits.suffix(3))
    var head = String(digits.dropLast(min(3, digits.count)))
    var groups: [String] = []
    while !head.isEmpty {
      groups.insert(String(head.suffix(2)), at: 0)
      head = String(head.dropLast(min(2, head.count)))
    }
    groups.append(tail)
    let fraction = magnitude % 100
    let decimal = dropZero && fraction == 0 ? "" : String(format: ".%02d", Int(fraction))
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
    let rupees = Double(paise) / 100
    for unit in CurrencyCode.inr.info.compactUnits where abs(rupees) >= Double(unit.thresholdMajor) {
      return String(format: "₹%.1f", rupees / Double(unit.thresholdMajor)) + unit.suffix
    }
    return format(paise)
  }
}
