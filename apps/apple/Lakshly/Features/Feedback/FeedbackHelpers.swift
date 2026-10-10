import Foundation

enum FeedbackMessageKind: String, Codable, CaseIterable, Identifiable {
  case idea, bug, praise
  var id: String { rawValue }
  var label: String { rawValue.capitalized }
  var githubKind: FeedbackKind { switch self { case .idea: .request; case .bug: .bug; case .praise: .feedback } }
}
enum FeedbackStatus: String, Codable, CaseIterable {
  case received, planned, inProgress = "in_progress", shipped, notNow = "not_now"
  var label: String { switch self { case .received: "Received"; case .planned: "Planned"; case .inProgress: "In progress"; case .shipped: "Shipped"; case .notNow: "Not now" } }
}
struct FeedbackDraft {
  var kind: FeedbackMessageKind = .idea
  var title = ""
  var detail = ""
  var area = "Other"
  var credit = ""
  var replyEmail = ""
  var includeDiagnostics = false
}
struct FeedbackDiagnostics: Codable, Equatable {
  var appVersion: String
  var platform: String
  static var current: Self {
    let os = ProcessInfo.processInfo.operatingSystemVersion
    #if os(iOS)
    let name = "iOS"
    #else
    let name = "macOS"
    #endif
    return .init(appVersion: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.1.0",
      platform: "\(name) \(os.majorVersion).\(os.minorVersion)")
  }
}
struct FeedbackPayload: Codable, Equatable {
  let kind: FeedbackMessageKind
  let title: String
  let detail: String
  let area: String
  let plan: String
  let credit: String?
  let replyEmail: String?
  let diagnostics: FeedbackDiagnostics?
  let website: String
  func encoded() throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
    return try encoder.encode(self)
  }
}
struct FeedbackReply: Codable, Equatable {
  var from: String
  var name: String?
  var at: String
  var text: String
}
enum FeedbackHelpers {
  static let areas = ["Overview", "Spend", "Budget", "Debt", "Credit", "Investments", "SIPs", "Rewards", "History", "Import", "Design", "Other"]
  // JavaScript slice counts UTF-16 units. Avoid splitting a surrogate pair at the boundary.
  static func clip(_ text: String, _ length: Int) -> String {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    var units = Array(trimmed.utf16.prefix(length))
    if let last = units.last, (0xD800...0xDBFF).contains(last) { units.removeLast() }
    return String(decoding: units, as: UTF16.self)
  }
  static func buildPayload(_ draft: FeedbackDraft, premium: Bool, diagnostics: FeedbackDiagnostics) -> FeedbackPayload {
    let credit = clip(draft.credit, 40), email = clip(draft.replyEmail, 120)
    return .init(kind: draft.kind, title: clip(draft.title, 90), detail: clip(draft.detail, 1000),
      area: areas.contains(draft.area) ? draft.area : "Other", plan: premium ? "premium" : "free",
      credit: credit.isEmpty ? nil : credit, replyEmail: email.isEmpty ? nil : email,
      diagnostics: draft.includeDiagnostics ? .init(appVersion: clip(diagnostics.appVersion, 40), platform: clip(diagnostics.platform, 20)) : nil, website: "")
  }
  static func clientHeader(platform: String, appVersion: String, includeDiagnostics: Bool) -> String {
    platform + (includeDiagnostics ? "/" + clip(appVersion, 40) : "")
  }
  static var clientPlatform: String {
    #if os(iOS)
    "ios"
    #else
    "macos"
    #endif
  }
  static func looksSensitive(_ text: String) -> Bool {
    let joined = text.replacingOccurrences(of: #"(\d)[ -](?=\d)"#, with: "$1", options: .regularExpression)
    return joined.range(of: #"\d{9,19}"#, options: .regularExpression) != nil ||
      text.range(of: #"\b[A-Z]{5}\d{4}[A-Z]\b"#, options: [.regularExpression, .caseInsensitive]) != nil ||
      text.range(of: #"\b[A-Z]{4}0[A-Z0-9]{6}\b"#, options: [.regularExpression, .caseInsensitive]) != nil
  }
  static func replyBy(from: Date, businessDays: Int) -> Date {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(secondsFromGMT: 330 * 60)!
    let parts = calendar.dateComponents([.year, .month, .day], from: from)
    var utc = Calendar(identifier: .gregorian)
    utc.timeZone = TimeZone(secondsFromGMT: 0)!
    var date = utc.date(from: parts)!
    var left = max(0, businessDays)
    while left > 0 {
      date = utc.date(byAdding: .day, value: 1, to: date)!
      if ![1, 7].contains(utc.component(.weekday, from: date)) { left -= 1 }
    }
    return date
  }
  static func autoAck(at: String, premium: Bool) -> FeedbackReply {
    .init(from: "auto", at: at, text: premium
      ? "Thank you, this genuinely helps 🙏 You're in the Premium priority queue. A human will reply within 1 business day."
      : "Thank you, this genuinely helps 🙏 We've logged it and you'll hear from us soon.")
  }
  static func dateLabel(_ date: Date) -> String {
    let formatter = DateFormatter(); formatter.dateFormat = "d MMM yyyy"; formatter.timeZone = TimeZone(secondsFromGMT: 0)
    return formatter.string(from: date)
  }
}
