import Foundation

enum InboxProvider: String, Codable, Equatable {
  case gmail, outlook, other
}

enum MailProvider: String, Codable, Equatable {
  case google, microsoft, icloud, yahoo, zoho, other
}

private let setupPOSIX = Locale(identifier: "en_US_POSIX")

func setupLower(_ text: String) -> String {
  text.lowercased(with: setupPOSIX)
}

/// `encodeURIComponent`, then percent-encode `!'()*` the way `quote(s, safe='')` does.
/// `~` stays literal. Hex digits are uppercase.
func percentEncodeSetup(_ value: String) -> String {
  let plain = Set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~".utf8)
  var out = ""
  out.reserveCapacity(value.utf8.count * 2)
  for byte in value.utf8 {
    if plain.contains(byte) {
      out.append(Character(UnicodeScalar(byte)))
    } else {
      out.append(String(format: "%%%02X", byte))
    }
  }
  return out
}

private func grouped(_ values: [String]) -> String {
  values.count == 1 ? values[0] : "(\(values.joined(separator: " OR ")))"
}

func froms(_ source: CatalogSource) -> [String] {
  source.senders.addresses + source.senders.domains
}

func gmailQuery(_ source: CatalogSource, _ search: CatalogSearch) -> String {
  var parts = ["from:\(grouped(froms(source)))"]
  for domain in source.senders.excludeDomains { parts.append("-from:\(domain)") }
  parts.append("subject:\(grouped(search.subjectAny))")
  if search.attachment {
    parts.append("has:attachment")
    if source.importer.formats.contains("pdf") { parts.append("filename:pdf") }
  }
  parts.append("newer_than:\(search.window)")
  return parts.joined(separator: " ")
}

func outlookQuery(_ source: CatalogSource, _ search: CatalogSearch) -> String {
  var parts = [grouped(froms(source).map { "from:\($0)" })]
  for domain in source.senders.excludeDomains { parts.append("NOT from:\(domain)") }
  parts.append(grouped(search.subjectAny.map { "subject:\($0)" }))
  if search.attachment { parts.append("hasattachments:yes") }
  return parts.joined(separator: " AND ")
}

func gmailUrl(_ email: String, _ query: String) -> String {
  let base = email.isEmpty
    ? "https://mail.google.com/mail/u/0/"
    : "https://mail.google.com/mail/u/?authuser=\(percentEncodeSetup(email))"
  return base + "#search/" + percentEncodeSetup(query)
}

private let microsoftExact: Set<String> = [
  "outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.in", "hotmail.co.in", "live.in",
]

func isMicrosoftDomain(_ domain: String) -> Bool {
  microsoftExact.contains(domain)
    || domain.hasPrefix("hotmail.")
    || domain.hasPrefix("live.")
    || domain.hasPrefix("outlook.")
}

func detectProvider(_ email: String) -> InboxProvider {
  let domain = email.split(separator: "@", omittingEmptySubsequences: false).last.map { setupLower(String($0)) } ?? ""
  if domain == "gmail.com" || domain == "googlemail.com" { return .gmail }
  return isMicrosoftDomain(domain) ? .outlook : .other
}

func detectMailProvider(_ email: String) -> MailProvider {
  let trimmed = email.trimmingCharacters(in: .whitespacesAndNewlines)
  let domain = trimmed.split(separator: "@", omittingEmptySubsequences: false).last.map { setupLower(String($0)) } ?? ""
  switch detectProvider(trimmed) {
  case .gmail: return .google
  case .outlook: return .microsoft
  case .other:
    if domain == "icloud.com" || domain == "me.com" || domain == "mac.com" { return .icloud }
    if domain.hasPrefix("yahoo.") { return .yahoo }
    if domain.hasPrefix("zoho.") { return .zoho }
    return .other
  }
}

func detectPickerProvider(_ email: String) -> MailProvider {
  detectMailProvider(email)
}

func outlookOpenUrl(_ email: String) -> String {
  let domain = email.split(separator: "@", omittingEmptySubsequences: false).last.map { setupLower(String($0)) } ?? ""
  return isMicrosoftDomain(domain) ? "https://outlook.live.com/mail/0/" : "https://outlook.office.com/mail/"
}

func plainSearch(_ source: CatalogSource, _ search: CatalogSearch) -> String {
  let subjects = search.subjectAny.map { "'\(stripSubjectQuotes($0))'" }.joined(separator: " or ")
  let attachment = search.attachment ? ", with an attachment" : ""
  return "from \(froms(source).joined(separator: " or ")) with \(subjects) in the subject\(attachment)"
}

func stripSubjectQuotes(_ token: String) -> String {
  var text = token
  if text.hasPrefix("\"") { text.removeFirst() }
  if text.hasSuffix("\"") { text.removeLast() }
  return text
}

func isSetupEmail(_ email: String) -> Bool {
  email.range(of: #"^[^\s@]+@[^\s@]+\.[^\s@]+$"#, options: .regularExpression) != nil
}
