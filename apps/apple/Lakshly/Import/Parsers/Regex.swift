import Foundation

/// Small wrapper so ported JavaScript regular expressions keep their flags and groups.
struct RE {
  let regex: NSRegularExpression

  init(_ pattern: String, _ options: NSRegularExpression.Options = []) {
    do {
      regex = try NSRegularExpression(pattern: pattern, options: options)
    } catch {
      preconditionFailure("Invalid regular expression \(pattern): \(error)")
    }
  }

  init(_ regex: NSRegularExpression) {
    self.regex = regex
  }

  var pattern: String { regex.pattern }
  var options: NSRegularExpression.Options { regex.options }

  func test(_ string: String) -> Bool {
    let range = NSRange(string.startIndex..., in: string)
    return regex.firstMatch(in: string, options: [], range: range) != nil
  }

  /// Full match at index 0, then capturing groups. Missing groups are nil.
  func match(_ string: String) -> [String?]? {
    let range = NSRange(string.startIndex..., in: string)
    guard let found = regex.firstMatch(in: string, options: [], range: range) else { return nil }
    let ns = string as NSString
    return (0..<found.numberOfRanges).map { index in
      let piece = found.range(at: index)
      return piece.location == NSNotFound ? nil : ns.substring(with: piece)
    }
  }

  func range(in string: String) -> NSRange? {
    let range = NSRange(string.startIndex..., in: string)
    return regex.firstMatch(in: string, options: [], range: range)?.range
  }

  func replacingFirst(in string: String, with replacement: String) -> String {
    let range = NSRange(string.startIndex..., in: string)
    guard let found = regex.firstMatch(in: string, options: [], range: range) else { return string }
    let ns = string as NSString
    return ns.replacingCharacters(in: found.range, with: replacement)
  }

  func replacingAll(in string: String, _ transform: (String) -> String) -> String {
    let ns = string as NSString
    let range = NSRange(location: 0, length: ns.length)
    var result = ""
    var cursor = 0
    for found in regex.matches(in: string, options: [], range: range) {
      result += ns.substring(with: NSRange(location: cursor, length: found.range.location - cursor))
      result += transform(ns.substring(with: found.range))
      cursor = found.range.location + found.range.length
    }
    result += ns.substring(from: cursor)
    return result
  }

  static func compile(_ pattern: String, _ options: NSRegularExpression.Options = []) -> RE? {
    guard let regex = try? NSRegularExpression(pattern: pattern, options: options) else { return nil }
    return RE(regex)
  }
}

func group(_ match: [String?]?, _ index: Int) -> String? {
  guard let match, index < match.count else { return nil }
  return match[index]
}
