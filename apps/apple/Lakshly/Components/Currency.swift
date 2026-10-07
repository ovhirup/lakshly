import Foundation

/// Failures converting between decimal amounts and minor units. A wrong currency or amount never falls back silently.
enum CurrencyError: Error, Equatable {
  case notAnAmount(String)
  case tooManyDecimals(String)
  case outOfRange(String)
}

/// Helpers over the generated currency table (Currencies.gen.swift). All stored money is Int64 minor units.
extension CurrencyCode {
  /// Minor units per major unit (100 for INR and USD).
  var minorFactor: Int64 { (0..<info.exponent).reduce(Int64(1)) { acc, _ in acc * 10 } }

  /// Decimal text ("1234.56") to minor units, exactly (no floating point). More fraction digits than the
  /// currency allows is an error unless the extra digits are all zero. Mirrors apps/web/lib/currency.ts `toMinor`.
  func toMinor(_ text: String) throws -> Int64 {
    let trimmed = text.trimmingCharacters(in: .whitespaces)
    var rest = Substring(trimmed)
    var negative = false
    if let first = rest.first, first == "+" || first == "-" {
      negative = first == "-"
      rest = rest.dropFirst()
    }
    let parts = rest.split(separator: ".", maxSplits: 1, omittingEmptySubsequences: false)
    guard let whole = parts.first, !whole.isEmpty, whole.allSatisfy(\.isASCIIDigit) else { throw CurrencyError.notAnAmount(text) }
    let fraction = parts.count == 2 ? parts[1] : Substring("")
    if parts.count == 2 && (fraction.isEmpty || !fraction.allSatisfy(\.isASCIIDigit)) { throw CurrencyError.notAnAmount(text) }
    let exponent = info.exponent
    let extra = fraction.dropFirst(exponent)
    if extra.contains(where: { $0 != "0" }) { throw CurrencyError.tooManyDecimals(text) }
    let kept = String(fraction.prefix(exponent)).padding(toLength: exponent, withPad: "0", startingAt: 0)
    guard let magnitude = Int64(String(whole) + kept) else { throw CurrencyError.outOfRange(text) }
    return negative ? -magnitude : magnitude
  }

  /// A Decimal major amount to minor units. Goes through its plain decimal text so it follows the same exactness rules.
  func toMinor(_ major: Decimal) throws -> Int64 {
    try toMinor(NSDecimalNumber(decimal: major).stringValue)
  }

  /// Minor units to a Decimal major amount.
  func fromMinor(_ minor: Int64) -> Decimal {
    Decimal(minor) / Decimal(minorFactor)
  }
}

private extension Character {
  var isASCIIDigit: Bool { ("0"..."9").contains(self) }
}
