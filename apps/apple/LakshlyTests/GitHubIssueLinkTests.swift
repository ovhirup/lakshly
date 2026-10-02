import Foundation
import XCTest

@testable import Lakshly

final class GitHubIssueLinkTests: XCTestCase {
  private let environment = IssueEnvironment(appVersion: "0.1.0 (1)", platform: "iOS 26.2",
    themeName: "Lakshmi", appearance: "Dark", tier: .premium)
  private let goldenText = "Let me split a bill & track who paid.\nThanks! #1 + 50% = 🙏"
  private let goldenURL = "https://github.com/ovhirup/lakshly/issues/new?template=feature_request.yml&title=%5BRequest%5D%20Split%20bills%20with%20friends&body=%23%23%23%20Feature%20request%0A%0ALet%20me%20split%20a%20bill%20%26%20track%20who%20paid.%0AThanks%21%20%231%20%2B%2050%25%20%3D%20%F0%9F%99%8F%0A%0A%23%23%23%20Environment%0A%0A-%20App%3A%20Lakshly%200.1.0%20%281%29%0A-%20Platform%3A%20iOS%2026.2%0A-%20Theme%3A%20Lakshmi%20%C2%B7%20Dark%0A-%20Tier%3A%20Premium%0A%0A_Opened%20from%20the%20Lakshly%20app.%20Nothing%20was%20sent%20automatically.%20Please%20don%27t%20add%20account%20numbers%2C%20statements%20or%20other%20personal%20data._&labels=feature-request%2Cpriority&problem=Let%20me%20split%20a%20bill%20%26%20track%20who%20paid.%0AThanks%21%20%231%20%2B%2050%25%20%3D%20%F0%9F%99%8F&environment=-%20App%3A%20Lakshly%200.1.0%20%281%29%0A-%20Platform%3A%20iOS%2026.2%0A-%20Theme%3A%20Lakshmi%20%C2%B7%20Dark%0A-%20Tier%3A%20Premium"
  private let environmentBlock = "- App: Lakshly 0.1.0 (1)\n- Platform: iOS 26.2\n- Theme: Lakshmi · Dark\n- Tier: Premium"

  func testGoldenURLAndDecodedFormFields() throws {
    let url = GitHubIssueLink.url(kind: .request, title: "Split bills with friends",
      text: goldenText, environment: environment, priority: true)
    XCTAssertEqual(url.absoluteString, goldenURL)
    let components = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false))
    XCTAssertEqual(components.scheme, "https")
    XCTAssertEqual(components.host, "github.com")
    XCTAssertEqual(components.path, "/ovhirup/lakshly/issues/new")
    let items = try XCTUnwrap(components.queryItems)
    XCTAssertEqual(items.map(\.name), ["template", "title", "body", "labels", "problem", "environment"])
    let values = Dictionary(uniqueKeysWithValues: items.map { ($0.name, $0.value ?? "") })
    XCTAssertEqual(values["template"], "feature_request.yml")
    XCTAssertEqual(values["title"], "[Request] Split bills with friends")
    XCTAssertEqual(values["labels"], "feature-request,priority")
    XCTAssertEqual(values["problem"], goldenText)
    XCTAssertEqual(values["environment"], environmentBlock)
    XCTAssertEqual(values["body"], "### Feature request\n\n\(goldenText)\n\n### Environment\n\n\(environmentBlock)\n\n_Opened from the Lakshly app. Nothing was sent automatically. Please don't add account numbers, statements or other personal data._")
  }

  func testEntitlementFeedsLabelsForEveryKind() throws {
    XCTAssertTrue(can(.priorityFeedback, tier: .premium))
    XCTAssertFalse(can(.priorityFeedback, tier: .free))
    let free = IssueEnvironment(appVersion: "0.1.0 (1)", platform: "macOS 26.2",
      themeName: "Graphite", appearance: "Light", tier: .free)
    for kind in FeedbackKind.allCases {
      XCTAssertEqual(GitHubIssueLink.labels(kind: kind, priority: can(.priorityFeedback, tier: .free)), kind.label)
      XCTAssertEqual(GitHubIssueLink.labels(kind: kind, priority: can(.priorityFeedback, tier: .premium)), "\(kind.label),priority")
      let url = GitHubIssueLink.url(kind: kind, title: "", text: "Free feedback",
        environment: free, priority: can(.priorityFeedback, tier: .free))
      let items = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems)
      XCTAssertEqual(items.first { $0.name == "labels" }?.value, kind.label)
      XCTAssertFalse(url.absoluteString.contains("priority"))
    }
  }

  func testSpecialCharactersRoundTripForEveryKind() throws {
    let special = "& # + = %\n🙏 café / ? : \" ' [ ]"
    for kind in FeedbackKind.allCases {
      let url = GitHubIssueLink.url(kind: kind, title: special, text: special,
        environment: environment, priority: false)
      let items = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems)
      XCTAssertEqual(items.first { $0.name == "title" }?.value, "\(kind.prefix) \(special)")
      XCTAssertEqual(items.first { $0.name == kind.fieldID }?.value, special)
      XCTAssertEqual(items.first { $0.name == "body" }?.value,
        GitHubIssueLink.body(kind: kind, text: special, environment: environment))
      XCTAssertNil(URLComponents(url: url, resolvingAgainstBaseURL: false)?.fragment)
      XCTAssertFalse(url.absoluteString.contains("+"))
    }
  }

  func testStrictUnreservedOnlyPercentEncoding() {
    let unreserved = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~"
    XCTAssertEqual(GitHubIssueLink.percentEncode(unreserved), unreserved)
    XCTAssertEqual(GitHubIssueLink.percentEncode(" &#+=%\n🙏"), "%20%26%23%2B%3D%25%0A%F0%9F%99%8F")
    XCTAssertEqual(GitHubIssueLink.percentEncode("!'()*,:/@[]"), "%21%27%28%29%2A%2C%3A%2F%40%5B%5D")
  }

  func testClippingAndTrimming() throws {
    let title = String(repeating: "t", count: 121)
    let text = String(repeating: "m", count: 2001)
    XCTAssertEqual(GitHubIssueLink.title(kind: .request, title: " \(title)\n", text: "ignored"),
      "[Request] " + String(repeating: "t", count: 120))
    XCTAssertEqual(GitHubIssueLink.message(" \(text)\n"), String(repeating: "m", count: 2000) + "…")
    XCTAssertEqual(GitHubIssueLink.message(String(repeating: "m", count: 2000)), String(repeating: "m", count: 2000))
    XCTAssertEqual(GitHubIssueLink.title(kind: .bug, title: "", text: text), "[Bug] " + String(repeating: "m", count: 60))
    XCTAssertEqual(GitHubIssueLink.title(kind: .feedback, title: "  My title  ", text: "ignored"), "[Feedback] My title")
    XCTAssertEqual(GitHubIssueLink.message("  🙏 hello \n"), "🙏 hello")
    let url = GitHubIssueLink.url(kind: .feedback, title: title, text: text,
      environment: environment, priority: false)
    let items = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems)
    XCTAssertEqual(items.first { $0.name == "details" }?.value, String(repeating: "m", count: 2000) + "…")
    XCTAssertTrue((items.first { $0.name == "body" }?.value ?? "").contains(String(repeating: "m", count: 2000) + "…"))
  }

  func testEmptyTitleFallbacks() {
    for kind in FeedbackKind.allCases {
      XCTAssertEqual(GitHubIssueLink.title(kind: kind, title: " \n", text: "\n \n First line \nSecond line"), "\(kind.prefix) First line")
      XCTAssertEqual(GitHubIssueLink.title(kind: kind, title: " \n", text: " \n"), "\(kind.prefix) \(kind.defaultTitle)")
      XCTAssertTrue(GitHubIssueLink.body(kind: kind, text: " \n", environment: environment).contains("\n\n_Write your message here._\n\n"))
    }
  }

  func testEnvironmentHasExactlyFourLinesAndNoOtherKeys() {
    XCTAssertEqual(environment.block, environmentBlock)
    XCTAssertEqual(environment.block.components(separatedBy: "\n").count, 4)
    let body = GitHubIssueLink.body(kind: .feedback, text: "Synthetic message", environment: environment)
    XCTAssertEqual(body.components(separatedBy: "\n").filter { $0.hasPrefix("- ") },
      environmentBlock.components(separatedBy: "\n"))
    XCTAssertEqual(body, "### Feedback\n\nSynthetic message\n\n### Environment\n\n\(environmentBlock)\n\n_Opened from the Lakshly app. Nothing was sent automatically. Please don't add account numbers, statements or other personal data._")
    let free = IssueEnvironment(appVersion: "1.2.3 (4)", platform: "iPadOS 26.2.1",
      themeName: "Monochrome Gold", appearance: "Light", tier: .free)
    XCTAssertEqual(free.block, "- App: Lakshly 1.2.3 (4)\n- Platform: iPadOS 26.2.1\n- Theme: Monochrome Gold · Light\n- Tier: Free")
  }

  private var repositoryRoot: URL {
    URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
      .deletingLastPathComponent().deletingLastPathComponent()
  }

  func testEveryKindMapsToAnExistingIssueTemplate() throws {
    let templates = repositoryRoot.appendingPathComponent(".github/ISSUE_TEMPLATE")
    guard FileManager.default.fileExists(atPath: templates.path) else {
      throw XCTSkip("Repository templates are not readable from this test process.")
    }
    for kind in FeedbackKind.allCases {
      let template = try String(contentsOf: templates.appendingPathComponent(kind.template), encoding: .utf8)
      XCTAssertTrue(template.contains("id: \(kind.fieldID)"), kind.rawValue)
      XCTAssertTrue(template.contains("id: environment"), kind.rawValue)
    }
  }

  func testAllCasesMatchContract() throws {
    XCTAssertEqual(FeedbackKind.allCases.map(\.template), ["feedback.yml", "feature_request.yml", "bug_report.yml"])
    XCTAssertEqual(FeedbackKind.allCases.map(\.displayName), ["Feedback", "Request", "Bug"])
    let contractURL = repositoryRoot.appendingPathComponent("AGENT_CONTRACT.md")
    guard FileManager.default.fileExists(atPath: contractURL.path) else {
      throw XCTSkip("AGENT_CONTRACT.md is not readable from this test process.")
    }
    let contract = try String(contentsOf: contractURL, encoding: .utf8)
    let lines = contract.components(separatedBy: "\n").filter { $0.hasPrefix("- ") && $0.contains(".yml") }
    XCTAssertEqual(lines.count, FeedbackKind.allCases.count)
    for kind in FeedbackKind.allCases {
      let line = try XCTUnwrap(lines.first { $0.hasPrefix("- \(kind.rawValue) ") })
      XCTAssertEqual(line.components(separatedBy: "/").map { $0.trimmingCharacters(in: .whitespaces) },
        ["- \(kind.rawValue)", kind.template, kind.label, kind.heading, kind.prefix, kind.fieldID, kind.defaultTitle])
    }
  }

  #if DEBUG
  func testFeedbackDemoLaunchOption() {
    XCTAssertEqual(LaunchOptions.parse(arguments: ["Lakshly", "-feedbackDemo", "YES"]).feedbackDemo, true)
    XCTAssertEqual(LaunchOptions.parse(arguments: ["Lakshly", "-feedbackDemo", "NO"]).feedbackDemo, false)
    XCTAssertNil(LaunchOptions.parse(arguments: ["Lakshly", "-feedbackDemo", "invalid"]).feedbackDemo)
    XCTAssertNil(LaunchOptions.parse(arguments: ["Lakshly"]).feedbackDemo)
  }
  #endif
}
