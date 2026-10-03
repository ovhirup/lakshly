import Foundation

private let amountSuffix = RE(#"\s*(CR|DR|Cr|Dr|C|D)\.?$"#)
let currencyPrefix = RE(#"^(₹|INR|Rs\.?)\s*"#, .caseInsensitive)
private let amountShape = RE(#"^\d{1,3}(,\d{2,3})*(\.\d{1,2})?$|^\d+(\.\d{1,2})?$"#)
let amountToken = RE(#"^-?(₹\s?)?(\d{1,3}(,\d{2,3})+|\d+)\.\d{2}(\s?(Cr|Dr|CR|DR|C|D))?$"#)
private let plainNumber = RE(#"^-?\d+(\.\d+)?$"#)

/// Parse an Indian-formatted amount into paise. Nil when the text is not an amount.
func parseAmount(_ raw: String) -> Int? {
  var s = raw.replacingOccurrences(of: "\u{00a0}", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
  if s.isEmpty { return nil }
  var negative = false
  if let found = amountSuffix.match(s), let token = group(found, 1), let span = amountSuffix.range(in: s) {
    if token.lowercased().hasPrefix("d") { negative = true }
    s = (s as NSString).substring(to: span.location).trimmingCharacters(in: .whitespacesAndNewlines)
  }
  s = currencyPrefix.replacingFirst(in: s, with: "")
  if s.hasPrefix("("), s.hasSuffix(")"), s.count >= 2 {
    negative = true
    s = String(s.dropFirst().dropLast())
  }
  if s.hasPrefix("-") {
    negative.toggle()
    s = String(s.dropFirst())
  }
  s = currencyPrefix.replacingFirst(in: s, with: "")
  guard amountShape.test(s) else { return nil }
  let stripped = s.replacingOccurrences(of: ",", with: "")
  let pieces = stripped.split(separator: ".", omittingEmptySubsequences: false)
  let whole = Int(pieces[0]) ?? 0
  let fraction = pieces.count > 1 ? String(pieces[1]) : ""
  let paise = whole * 100 + (Int(String((fraction + "00").prefix(2))) ?? 0)
  return negative ? -paise : paise
}

func parseNumber(_ raw: String) -> Double? {
  let s = raw.replacingOccurrences(of: ",", with: "").trimmingCharacters(in: .whitespacesAndNewlines)
  guard plainNumber.test(s) else { return nil }
  return Double(s)
}

/// JavaScript `Number#toString` for the short decimals these statements use.
func jsNumber(_ value: Double) -> String {
  guard value.isFinite else { return value > 0 ? "Infinity" : "-Infinity" }
  if value == value.rounded(), abs(value) < 1e15 {
    return String(Int64(value))
  }
  return String(value)
}

/// JavaScript `Math.round`: halves go towards +∞.
func jsRound(_ value: Double) -> Int {
  Int(floor(value + 0.5))
}
