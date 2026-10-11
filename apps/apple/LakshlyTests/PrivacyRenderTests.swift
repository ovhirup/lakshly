import XCTest
@testable import Lakshly

final class PrivacyRenderTests: XCTestCase {
  @MainActor func testRenderPrivacyShots() throws {
    let env = ProcessInfo.processInfo.environment
    guard let path = env["LAKSHLY_SHOTS_DIR"] ?? env["TEST_RUNNER_LAKSHLY_SHOTS_DIR"], !path.isEmpty, !path.contains("$") else {
      throw XCTSkip("Set LAKSHLY_SHOTS_DIR to render privacy PNGs.")
    }
    #if DEBUG
    let urls = try PrivacyShotRenderer.render(to: URL(fileURLWithPath: path, isDirectory: true))
    XCTAssertEqual(urls.count, 16)
    for url in urls {
      let bytes = try Data(contentsOf: url)
      XCTAssertGreaterThan(bytes.count, 5000, url.lastPathComponent)
    }
    #else
    throw XCTSkip("Privacy screenshots are DEBUG-only.")
    #endif
  }
}
