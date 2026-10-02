import Foundation

private let months = [
  "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6, "jul": 7, "aug": 8,
  "sep": 9, "sept": 9, "oct": 10, "nov": 11, "dec": 12,
]

private let isoDate = RE(#"^(\d{4})-(\d{2})-(\d{2})$"#)
private let numericDate = RE(#"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$"#)
private let namedDate = RE(#"^(\d{1,2})[\s-]([A-Za-z]{3,4})[\s-](\d{2}|\d{4})$"#)

private func pad(_ value: Int) -> String { value < 10 ? "0\(value)" : String(value) }
private func expandYear(_ year: Int) -> Int { year < 100 ? 2000 + year : year }

private func valid(year: Int, month: Int, day: Int) -> String? {
  if month < 1 || month > 12 || day < 1 || day > 31 || year < 1990 || year > 2100 { return nil }
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(secondsFromGMT: 0)!
  var parts = DateComponents()
  parts.year = year
  parts.month = month
  parts.day = day
  parts.timeZone = TimeZone(secondsFromGMT: 0)
  guard let date = calendar.date(from: parts) else { return nil }
  let back = calendar.dateComponents([.year, .month, .day], from: date)
  guard back.year == year, back.month == month, back.day == day else { return nil }
  return "\(year)-\(pad(month))-\(pad(day))"
}

/// Day-first Indian statement dates, as `yyyy-mm-dd`.
func parseDate(_ raw: String) -> String? {
  let s = raw.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: "")
  if let match = isoDate.match(s), let year = Int(group(match, 1) ?? ""), let month = Int(group(match, 2) ?? ""), let day = Int(group(match, 3) ?? "") {
    return valid(year: year, month: month, day: day)
  }
  if let match = numericDate.match(s), let day = Int(group(match, 1) ?? ""), let month = Int(group(match, 2) ?? ""), let year = Int(group(match, 3) ?? "") {
    return valid(year: expandYear(year), month: month, day: day)
  }
  if let match = namedDate.match(s), let day = Int(group(match, 1) ?? ""), let month = months[(group(match, 2) ?? "").lowercased()], let year = Int(group(match, 3) ?? "") {
    return valid(year: expandYear(year), month: month, day: day)
  }
  return nil
}

func isoDay(_ date: Date = Date()) -> String {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withFullDate]
  formatter.timeZone = TimeZone(secondsFromGMT: 0)
  return formatter.string(from: date)
}

func isoTimestamp(_ date: Date = Date()) -> String {
  let formatter = ISO8601DateFormatter()
  formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
  formatter.timeZone = TimeZone(secondsFromGMT: 0)
  return formatter.string(from: date)
}

func utcDate(_ iso: String) -> Date? {
  let pieces = iso.split(separator: "-")
  guard pieces.count == 3, let year = Int(pieces[0]), let month = Int(pieces[1]), let day = Int(pieces[2]) else { return nil }
  var calendar = Calendar(identifier: .gregorian)
  calendar.timeZone = TimeZone(secondsFromGMT: 0)!
  var parts = DateComponents()
  parts.year = year
  parts.month = month
  parts.day = day
  parts.timeZone = TimeZone(secondsFromGMT: 0)
  return calendar.date(from: parts)
}
