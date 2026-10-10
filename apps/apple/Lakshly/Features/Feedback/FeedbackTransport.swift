import Foundation

enum FeedbackTransportError: Error, Equatable {
  case network, rateLimited(retryAfter: TimeInterval), http(code: Int), badResponse
}
struct FeedbackReceipt: Codable, Equatable { let id: String; let secret: String }
struct FeedbackRemoteStatus: Decodable {
  let status: FeedbackStatus
  let replies: [Reply]
  struct Reply: Decodable { let at: String; let text: String }
}
protocol FeedbackTransporting {
  func send(_ payload: FeedbackPayload, clientHeader: String) async throws -> FeedbackReceipt
  func fetchStatus(id: String, secret: String, clientHeader: String) async throws -> FeedbackRemoteStatus?
}
// Refuse redirects: feedback and its secret must never leave the fixed relay host.
private final class FeedbackRedirectGuard: NSObject, URLSessionTaskDelegate {
  func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
final class FeedbackTransport: FeedbackTransporting {
  static let endpoint = "https://feedback.lakshly.com"
  private let session: URLSession
  private let redirectGuard = FeedbackRedirectGuard()
  static func configuration() -> URLSessionConfiguration {
    let config = URLSessionConfiguration.ephemeral
    config.httpShouldSetCookies = false
    config.httpCookieAcceptPolicy = .never
    config.urlCache = nil
    config.requestCachePolicy = .reloadIgnoringLocalCacheData
    config.timeoutIntervalForRequest = 15
    config.timeoutIntervalForResource = 15
    return config
  }
  init(session: URLSession? = nil) {
    self.session = session ?? URLSession(configuration: Self.configuration(), delegate: redirectGuard, delegateQueue: nil)
  }
  private func request(path: String, clientHeader: String) -> URLRequest {
    var request = URLRequest(url: URL(string: Self.endpoint + path)!, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)
    request.httpShouldHandleCookies = false
    request.setValue(clientHeader, forHTTPHeaderField: "X-Lakshly-Client")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    return request
  }
  private func execute(_ request: URLRequest) async throws -> (Data, HTTPURLResponse) {
    let data: Data; let response: URLResponse
    do { (data, response) = try await session.data(for: request, delegate: redirectGuard) }
    catch { throw FeedbackTransportError.network }
    guard let http = response as? HTTPURLResponse else { throw FeedbackTransportError.badResponse }
    if http.statusCode == 429 {
      let raw = http.value(forHTTPHeaderField: "Retry-After") ?? "60"
      let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.timeZone = TimeZone(secondsFromGMT: 0)
      formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss z"
      let delay = TimeInterval(raw) ?? formatter.date(from: raw)?.timeIntervalSinceNow ?? 60
      throw FeedbackTransportError.rateLimited(retryAfter: max(0, delay))
    }
    return (data, http)
  }
  func send(_ payload: FeedbackPayload, clientHeader: String) async throws -> FeedbackReceipt {
    var request = request(path: "/v1/feedback", clientHeader: clientHeader)
    request.httpMethod = "POST"; request.httpBody = try payload.encoded()
    guard (request.httpBody?.count ?? 0) <= 8192 else { throw FeedbackTransportError.badResponse }
    let (data, response) = try await execute(request)
    guard response.statusCode == 201 else { throw FeedbackTransportError.http(code: response.statusCode) }
    guard let receipt = try? JSONDecoder().decode(FeedbackReceipt.self, from: data), !receipt.id.isEmpty, !receipt.secret.isEmpty else { throw FeedbackTransportError.badResponse }
    return receipt
  }
  func fetchStatus(id: String, secret: String, clientHeader: String) async throws -> FeedbackRemoteStatus? {
    let path = "/v1/feedback/" + GitHubIssueLink.percentEncode(id) + "?s=" + GitHubIssueLink.percentEncode(secret)
    let (data, response) = try await execute(request(path: path, clientHeader: clientHeader))
    if response.statusCode == 404 { return nil }
    guard response.statusCode == 200 else { throw FeedbackTransportError.http(code: response.statusCode) }
    guard let status = try? JSONDecoder().decode(FeedbackRemoteStatus.self, from: data) else { throw FeedbackTransportError.badResponse }
    return status
  }
}
