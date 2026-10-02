import Foundation

private let longDigits = RE(#"\d[\d\s-]{8,}\d"#)

func last4(_ raw: String?) -> String? {
  guard let raw, !raw.isEmpty else { return nil }
  let digits = raw.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
  return digits.count >= 4 ? String(digits.suffix(4)) : nil
}

func redactNumbers(_ text: String) -> String {
  longDigits.replacingAll(in: text) { match in
    let digits = match.replacingOccurrences(of: "[^0-9]", with: "", options: .regularExpression)
    return digits.count >= 9 ? "XXXX\(digits.suffix(4))" : match
  }
}
