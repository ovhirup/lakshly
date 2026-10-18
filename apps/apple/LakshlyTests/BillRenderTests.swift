import XCTest
@testable import Lakshly

final class BillRenderTests: XCTestCase {
  @MainActor func testRenderBillShots() throws {
    let env = ProcessInfo.processInfo.environment
    guard let path = env["LAKSHLY_SHOTS_DIR"] ?? env["TEST_RUNNER_LAKSHLY_SHOTS_DIR"], !path.isEmpty, !path.contains("$") else {
      throw XCTSkip("Set LAKSHLY_SHOTS_DIR to render bill radar PNGs.")
    }
    #if DEBUG
    let urls = try BillShotRenderer.render(to: URL(fileURLWithPath: path, isDirectory: true))
    XCTAssertEqual(urls.count, BillShotRenderer.screens.count * 4)
    for url in urls { XCTAssertGreaterThan(try Data(contentsOf: url).count, 5000, url.lastPathComponent) }
    #else
    throw XCTSkip("Bill screenshots are DEBUG-only.")
    #endif
  }
}
