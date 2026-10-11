import XCTest
@testable import Lakshly

final class ReviewRenderTests: XCTestCase {
  @MainActor func testRenderReviewShots() throws {
    let env = ProcessInfo.processInfo.environment
    guard let path = env["LAKSHLY_SHOTS_DIR"] ?? env["TEST_RUNNER_LAKSHLY_SHOTS_DIR"], !path.isEmpty, !path.contains("$") else {
      throw XCTSkip("Set LAKSHLY_SHOTS_DIR to render weekly-review PNGs.")
    }
    #if DEBUG
    let urls = try ReviewShotRenderer.render(to: URL(fileURLWithPath: path, isDirectory: true))
    XCTAssertEqual(urls.count, 12)
    for url in urls { XCTAssertGreaterThan(try Data(contentsOf: url).count, 5000, url.lastPathComponent) }
    #else
    throw XCTSkip("Review screenshots are DEBUG-only.")
    #endif
  }
}
