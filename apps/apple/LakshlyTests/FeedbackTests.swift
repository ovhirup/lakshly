import Foundation
import XCTest
@testable import Lakshly

final class FeedbackStubProtocol: URLProtocol {
  static var handler: ((URLRequest) throws -> (Int, [String: String], Data))?
  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    do {
      guard let handler = Self.handler else { throw URLError(.notConnectedToInternet) }
      let (status, headers, data) = try handler(request)
      client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: headers)!, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data); client?.urlProtocolDidFinishLoading(self)
    } catch { client?.urlProtocol(self, didFailWithError: error) }
  }
  override func stopLoading() {}
}
final class FeedbackFakeSecrets: FeedbackSecretStoring {
  var values: [String: String] = [:]
  func save(_ secret: String, for id: String) throws { values[id] = secret }
  func secret(for id: String) throws -> String? { values[id] }
}
final class FeedbackTests: XCTestCase {
  let diagnostics = FeedbackDiagnostics(appVersion: "1.0", platform: "iOS 26.2")
  var base: FeedbackDraft { .init(kind: .idea, title: "  Remind me before SIP dates ", detail: "", area: "SIPs") }
  override func tearDown() { FeedbackStubProtocol.handler = nil; super.tearDown() }
  func testDefaultPayloadParityAndSortedEncoding() throws {
    let payload = FeedbackHelpers.buildPayload(base, premium: false, diagnostics: diagnostics)
    let data = try payload.encoded()
    let object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: String])
    XCTAssertEqual(object, ["kind": "idea", "title": "Remind me before SIP dates", "detail": "", "area": "SIPs", "plan": "free", "website": ""])
    XCTAssertEqual(String(decoding: data, as: UTF8.self), #"{"area":"SIPs","detail":"","kind":"idea","plan":"free","title":"Remind me before SIP dates","website":""}"#)
    XCTAssertNil(payload.diagnostics)
  }
  func testOptionalFieldsClippingAndDiagnostics() throws {
    var draft = base; draft.title = String(repeating: "x", count: 200)
    draft.detail = String(repeating: "x", count: 1200); draft.credit = String(repeating: "c", count: 50)
    draft.replyEmail = String(repeating: "e", count: 140); draft.includeDiagnostics = true
    let payload = FeedbackHelpers.buildPayload(draft, premium: true, diagnostics: diagnostics)
    XCTAssertEqual(payload.title.count, 90); XCTAssertEqual(payload.detail.count, 1000)
    XCTAssertEqual(payload.credit?.count, 40); XCTAssertEqual(payload.replyEmail?.count, 120)
    XCTAssertEqual(payload.diagnostics, diagnostics); XCTAssertEqual(payload.plan, "premium")
    XCTAssertEqual(FeedbackHelpers.buildPayload(base, premium: can(.priorityFeedback, tier: .free), diagnostics: diagnostics).plan, "free")
    XCTAssertEqual(FeedbackHelpers.buildPayload(base, premium: can(.priorityFeedback, tier: .premium), diagnostics: diagnostics).plan, "premium")
  }
  func testUnicodeClippingFitsWorkerBodyLimit() throws {
    var draft = base; draft.title = String(repeating: "🙏", count: 90); draft.detail = String(repeating: "🙏", count: 1000)
    let payload = FeedbackHelpers.buildPayload(draft, premium: true, diagnostics: diagnostics)
    XCTAssertEqual(payload.title.utf16.count, 90); XCTAssertEqual(payload.detail.utf16.count, 1000)
    XCTAssertLessThanOrEqual(try payload.encoded().count, 8192)
    XCTAssertEqual(FeedbackHelpers.clip("xx🙏", 3), "xx")
  }
  func testHeaderOptInRule() {
    for platform in ["ios", "macos"] {
      XCTAssertEqual(FeedbackHelpers.clientHeader(platform: platform, appVersion: "1.0", includeDiagnostics: false), platform)
      XCTAssertEqual(FeedbackHelpers.clientHeader(platform: platform, appVersion: "1.0", includeDiagnostics: true), platform + "/1.0")
    }
  }
  func testSensitiveParity() {
    for text in ["card 4111 1111 1111 1111", "acct 50100123456789", "PAN ABCDE1234F", "IFSC HDFC0001234", "abcde1234f", "123-456-7890"] { XCTAssertTrue(FeedbackHelpers.looksSensitive(text), text) }
    XCTAssertFalse(FeedbackHelpers.looksSensitive("Remind me 3 days before, around ₹2,000 limit, in 2026"))
  }
  func testReplyByISTBusinessDays() throws {
    let formatter = ISO8601DateFormatter()
    XCTAssertEqual(formatter.string(from: FeedbackHelpers.replyBy(from: try XCTUnwrap(formatter.date(from: "2026-10-03T12:30:00Z")), businessDays: 1)), "2026-10-05T00:00:00Z")
    XCTAssertEqual(formatter.string(from: FeedbackHelpers.replyBy(from: try XCTUnwrap(formatter.date(from: "2026-10-05T04:00:00Z")), businessDays: 5)), "2026-10-12T00:00:00Z")
    XCTAssertEqual(formatter.string(from: FeedbackHelpers.replyBy(from: try XCTUnwrap(formatter.date(from: "2026-10-02T20:00:00Z")), businessDays: 1)), "2026-10-05T00:00:00Z")
  }
  func testStatusAndAutoAckCopy() {
    XCTAssertEqual(FeedbackStatus.allCases.map(\.label), ["Received", "Planned", "In progress", "Shipped", "Not now"])
    XCTAssertEqual(FeedbackHelpers.autoAck(at: "2026-10-03", premium: true).text, "Thank you, this genuinely helps 🙏 You're in the Premium priority queue. A human will reply within 1 business day.")
    XCTAssertEqual(FeedbackHelpers.autoAck(at: "2026-10-03", premium: false).text, "Thank you, this genuinely helps 🙏 We've logged it and you'll hear from us soon.")
  }
  private func transport() -> FeedbackTransport {
    let config = FeedbackTransport.configuration(); config.protocolClasses = [FeedbackStubProtocol.self]
    return FeedbackTransport(session: URLSession(configuration: config))
  }
  func testPrivacyConfiguration() {
    let config = FeedbackTransport.configuration()
    XCTAssertFalse(config.httpShouldSetCookies); XCTAssertEqual(config.httpCookieAcceptPolicy, .never)
    XCTAssertNil(config.urlCache); XCTAssertEqual(config.requestCachePolicy, .reloadIgnoringLocalCacheData)
    XCTAssertEqual(config.timeoutIntervalForRequest, 15)
  }
  func test201AndExactRequest() async throws {
    let payload = FeedbackHelpers.buildPayload(base, premium: true, diagnostics: diagnostics)
    FeedbackStubProtocol.handler = { request in
      XCTAssertEqual(request.url?.absoluteString, "https://feedback.lakshly.com/v1/feedback")
      XCTAssertEqual(request.httpMethod, "POST"); XCTAssertEqual(request.value(forHTTPHeaderField: "X-Lakshly-Client"), "ios")
      XCTAssertEqual(request.value(forHTTPHeaderField: "Content-Type"), "application/json")
      XCTAssertNil(request.value(forHTTPHeaderField: "Origin"))
      var body = request.httpBody ?? Data()
      if let stream = request.httpBodyStream {
        stream.open(); defer { stream.close() }
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
          let count = stream.read(&buffer, maxLength: buffer.count)
          if count <= 0 { break }; body.append(contentsOf: buffer.prefix(count))
        }
      }
      XCTAssertEqual(body, try payload.encoded())
      return (201, [:], Data(#"{"id":"LK-ABC123","secret":"synthetic-secret"}"#.utf8))
    }
    let receipt = try await transport().send(payload, clientHeader: "ios")
    XCTAssertEqual(receipt.id, "LK-ABC123"); XCTAssertEqual(receipt.secret, "synthetic-secret")
  }
  func test201MissingSecret() async {
    await assertSendError(status: 201, body: #"{"id":"LK-ABC123"}"#, expected: .badResponse)
  }
  func test429RetryAfter() async { await assertSendError(status: 429, headers: ["Retry-After": "60"], expected: .rateLimited(retryAfter: 60)) }
  func test500() async { await assertSendError(status: 500, expected: .http(code: 500)) }
  func testNetworkFailure() async {
    FeedbackStubProtocol.handler = { _ in throw URLError(.notConnectedToInternet) }
    do { _ = try await transport().send(FeedbackHelpers.buildPayload(base, premium: false, diagnostics: diagnostics), clientHeader: "ios"); XCTFail("Expected error") }
    catch { XCTAssertEqual(error as? FeedbackTransportError, .network) }
  }
  private func assertSendError(status: Int, headers: [String: String] = [:], body: String = "{}", expected: FeedbackTransportError) async {
    FeedbackStubProtocol.handler = { _ in (status, headers, Data(body.utf8)) }
    do { _ = try await transport().send(FeedbackHelpers.buildPayload(base, premium: false, diagnostics: diagnostics), clientHeader: "ios"); XCTFail("Expected error") }
    catch { XCTAssertEqual(error as? FeedbackTransportError, expected) }
  }
  func testStatus404AndPercentEncoding() async throws {
    FeedbackStubProtocol.handler = { request in
      XCTAssertEqual(request.url?.absoluteString, "https://feedback.lakshly.com/v1/feedback/LK%2FA%20%26?s=secret%2B%3F%26")
      XCTAssertEqual(request.value(forHTTPHeaderField: "X-Lakshly-Client"), "ios")
      return (404, [:], Data("{}".utf8))
    }
    let status = try await transport().fetchStatus(id: "LK/A &", secret: "secret+?&", clientHeader: "ios")
    XCTAssertNil(status)
  }
  func testStatusReplies() async throws {
    FeedbackStubProtocol.handler = { _ in (200, [:], Data(#"{"id":"LK-ABC123","status":"in_progress","replies":[{"at":"2026-10-03","text":"A fix is in progress."}]}"#.utf8)) }
    let status = try await transport().fetchStatus(id: "LK-ABC123", secret: "synthetic-secret", clientHeader: "ios")
    XCTAssertEqual(status?.status, .inProgress); XCTAssertEqual(status?.replies.first?.text, "A fix is in progress.")
  }
  @MainActor func testSecretFakeAndRequestRoundTrip() throws {
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: directory) }
    let file = directory.appendingPathComponent("requests.json"), secrets = FeedbackFakeSecrets()
    let request = FeedbackRequest(id: "LK-ABC123", kind: .idea, title: "Synthetic idea", area: "Design", createdAt: Date(timeIntervalSince1970: 100), premium: true, status: .received, replies: [FeedbackHelpers.autoAck(at: "2026-10-03", premium: true)])
    let store = FeedbackRequestStore(file: file, secrets: secrets)
    try store.add(request, secret: "synthetic-secret")
    XCTAssertEqual(try secrets.secret(for: request.id), "synthetic-secret")
    XCTAssertEqual(FeedbackRequestStore(file: file, secrets: secrets).requests, [request])
    XCTAssertFalse(try String(contentsOf: file).contains("synthetic-secret"))
    let remote = try JSONDecoder().decode(FeedbackRemoteStatus.self, from: Data(#"{"status":"planned","replies":[{"at":"2026-10-03","text":"Planned for the next beta."}]}"#.utf8))
    try store.update(id: request.id, remote: remote)
    XCTAssertEqual(FeedbackRequestStore(file: file, secrets: secrets).requests.first?.status, .planned)
    XCTAssertEqual(store.requests.first?.replies.count, 2)
  }
  func testFallbackPrivacyMatchesOptIn() throws {
    for include in [false, true] {
      var draft = base; draft.includeDiagnostics = include
      let payload = FeedbackHelpers.buildPayload(draft, premium: false, diagnostics: diagnostics)
      let url = GitHubIssueLink.url(payload: payload)
      let items = try XCTUnwrap(URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems)
      let body = try XCTUnwrap(items.first { $0.name == "body" }?.value)
      XCTAssertFalse(body.contains("Theme")); XCTAssertFalse(body.contains("Lakshmi"))
      XCTAssertEqual(body.contains("iOS 26.2"), include)
      XCTAssertEqual(body.contains("1.0"), include)
      XCTAssertNil(items.first { $0.name == "environment" })
    }
  }
  func testBundledRoadmapRawCounts() {
    let roadmap = FeedbackRoadmap.load()
    XCTAssertEqual(roadmap.items.count, 9); XCTAssertEqual(roadmap.items.first?.votes, 52)
    XCTAssertEqual(Set(roadmap.items.map(\.id)).count, roadmap.items.count)
  }
}
