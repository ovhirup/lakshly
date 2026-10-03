import Foundation

/// cyrb53 with wrapping 32-bit multiply, matching JavaScript `Math.imul` and `>>>`.
func cyrb53(_ string: String, seed: UInt32 = 0) -> UInt64 {
  var h1 = UInt32(0xdeadbeef) ^ seed
  var h2 = UInt32(0x41c6ce57) ^ seed
  for unit in string.utf16 {
    let character = UInt32(unit)
    h1 = (h1 ^ character) &* 2_654_435_761
    h2 = (h2 ^ character) &* 1_597_334_677
  }
  let mixed1 = ((h1 ^ (h1 >> 16)) &* 2_246_822_507) ^ ((h2 ^ (h2 >> 13)) &* 3_266_489_909)
  let mixed2 = ((h2 ^ (h2 >> 16)) &* 2_246_822_507) ^ ((mixed1 ^ (mixed1 >> 13)) &* 3_266_489_909)
  return 4_294_967_296 * UInt64(mixed2 & 2_097_151) + UInt64(mixed1)
}

private func base36(_ value: UInt64) -> String {
  let digits = Array("0123456789abcdefghijklmnopqrstuvwxyz")
  if value == 0 { return "0" }
  var rest = value
  var out = ""
  while rest > 0 {
    out.insert(digits[Int(rest % 36)], at: out.startIndex)
    rest /= 36
  }
  return out
}

func stableId(_ prefix: String, _ parts: [String]) -> String {
  let encoded = base36(cyrb53(parts.joined(separator: "|")))
  let padded = encoded.count >= 11 ? encoded : String(repeating: "0", count: 11 - encoded.count) + encoded
  return "\(prefix)_\(padded)"
}

func stableId(_ prefix: String, _ parts: CustomStringConvertible?...) -> String {
  stableId(prefix, parts.map { $0.map { String(describing: $0) } ?? "" })
}
