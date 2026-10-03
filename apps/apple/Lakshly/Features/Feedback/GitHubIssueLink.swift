import Foundation
#if os(iOS)
import UIKit
#endif

enum FeedbackKind: String, CaseIterable, Identifiable {
  case feedback, request, bug

  var id: String { rawValue }
  var displayName: String {
    switch self {
    case .feedback: "Feedback"
    case .request: "Request"
    case .bug: "Bug"
    }
  }
  var template: String {
    switch self {
    case .feedback: "feedback.yml"
    case .request: "feature_request.yml"
    case .bug: "bug_report.yml"
    }
  }
  var label: String {
    switch self {
    case .feedback: "feedback"
    case .request: "feature-request"
    case .bug: "bug"
    }
  }
  var heading: String {
    switch self {
    case .feedback: "### Feedback"
    case .request: "### Feature request"
    case .bug: "### Bug report"
    }
  }
  var prefix: String { "[\(displayName)]" }
  var fieldID: String {
    switch self {
    case .feedback: "details"
    case .request: "problem"
    case .bug: "what"
    }
  }
  var defaultTitle: String {
    switch self {
    case .feedback: "Feedback from the app"
    case .request: "Feature request from the app"
    case .bug: "Bug report from the app"
    }
  }
}

struct IssueEnvironment {
  let appVersion: String
  let platform: String
  let themeName: String
  let appearance: String
  let tier: Tier

  /// Collect only the four public environment values in docs/feedback-issue-link.md.
  @MainActor
  static func current(themeName: String, isDark: Bool, tier: Tier) -> IssueEnvironment {
    let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0.1.0"
    let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "1"
    let os = ProcessInfo.processInfo.operatingSystemVersion
    let osVersion = "\(os.majorVersion).\(os.minorVersion)" + (os.patchVersion == 0 ? "" : ".\(os.patchVersion)")
    #if os(iOS)
    let platform = "\(UIDevice.current.userInterfaceIdiom == .pad ? "iPadOS" : "iOS") \(osVersion)"
    #else
    let platform = "macOS \(osVersion)"
    #endif
    return IssueEnvironment(appVersion: "\(version) (\(build))", platform: platform,
      themeName: themeName, appearance: isDark ? "Dark" : "Light", tier: tier)
  }

  var block: String {
    [
      "- App: Lakshly \(appVersion)",
      "- Platform: \(platform)",
      "- Theme: \(themeName) · \(appearance)",
      "- Tier: \(tier == .premium ? "Premium" : "Free")",
    ].joined(separator: "\n")
  }
}

enum GitHubIssueLink {
  static func title(kind: FeedbackKind, title: String, text: String) -> String {
    let trimmedTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
    let content: String
    if !trimmedTitle.isEmpty {
      content = String(trimmedTitle.prefix(120))
    } else if let line = text.trimmingCharacters(in: .whitespacesAndNewlines)
      .components(separatedBy: .newlines)
      .map({ $0.trimmingCharacters(in: .whitespacesAndNewlines) })
      .first(where: { !$0.isEmpty }) {
      content = String(line.prefix(60))
    } else {
      content = kind.defaultTitle
    }
    return "\(kind.prefix) \(content)"
  }

  static func message(_ text: String) -> String {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { return "_Write your message here._" }
    return String(trimmed.prefix(2000)) + (trimmed.count > 2000 ? "…" : "")
  }

  static func body(kind: FeedbackKind, text: String, environment: IssueEnvironment) -> String {
    [kind.heading, "", message(text), "", "### Environment", "", environment.block, "",
      "_Opened from the Lakshly app. Nothing was sent automatically. Please don't add account numbers, statements or other personal data._"
    ].joined(separator: "\n")
  }

  static func labels(kind: FeedbackKind, priority: Bool) -> String {
    kind.label + (priority ? ",priority" : "")
  }

  static func url(kind: FeedbackKind, title: String, text: String, environment: IssueEnvironment, priority: Bool) -> URL {
    let parameters = [
      ("template", kind.template),
      ("title", self.title(kind: kind, title: title, text: text)),
      ("body", body(kind: kind, text: text, environment: environment)),
      ("labels", labels(kind: kind, priority: priority)),
      (kind.fieldID, message(text)),
      ("environment", environment.block),
    ]
    let query = parameters.map { "\($0.0)=\(percentEncode($0.1))" }.joined(separator: "&")
    // The base and keys are fixed; values contain only unreserved bytes or %HH.
    return URL(string: "https://github.com/ovhirup/lakshly/issues/new?\(query)")!
  }

  /// RFC 3986 unreserved bytes only, uppercase UTF-8 escapes, never form-style '+'.
  static func percentEncode(_ value: String) -> String {
    let hex = Array("0123456789ABCDEF".utf8)
    var encoded: [UInt8] = []
    for byte in value.utf8 {
      switch byte {
      case 65...90, 97...122, 48...57, 45, 46, 95, 126:
        encoded.append(byte)
      default:
        encoded.append(contentsOf: [37, hex[Int(byte >> 4)], hex[Int(byte & 15)]])
      }
    }
    return String(decoding: encoded, as: UTF8.self)
  }
}
