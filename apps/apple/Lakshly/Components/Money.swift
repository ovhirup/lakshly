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
  static func compact(_ paise: Int64) -> String {
    let rupees = Double(paise) / 100
    if abs(rupees) >= 10_000_000 { return String(format: "₹%.1fCr", rupees / 10_000_000) }
    if abs(rupees) >= 100_000 { return String(format: "₹%.1fL", rupees / 100_000) }
    if abs(rupees) >= 1_000 { return String(format: "₹%.1fK", rupees / 1_000) }
    return format(paise)
  }
}
