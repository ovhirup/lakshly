import XCTest
@testable import Lakshly

final class TierRenderTests: XCTestCase {
  @MainActor func testRenderTierShots() throws {
    let env = ProcessInfo.processInfo.environment
    guard let path = env["LAKSHLY_SHOTS_DIR"] ?? env["TEST_RUNNER_LAKSHLY_SHOTS_DIR"], !path.isEmpty, !path.contains("$") else {
      throw XCTSkip("Set LAKSHLY_SHOTS_DIR to render tier PNGs.")
    }
    #if DEBUG
    let directory = URL(fileURLWithPath: path, isDirectory: true)
    try TierShotRenderer.render(to: directory)
    #if os(iOS)
    let platform = "ios"
    #else
    let platform = "macos"
    #endif
    for plan in ["free", "premium"] {
      for screen in TierShotRenderer.screens {
        for theme in ["lakshmi-dark", "monochromeGold-light"] {
          let url = directory.appendingPathComponent("tier-\(plan)-\(screen)-\(platform)-\(theme).png")
          let bytes = try Data(contentsOf: url)
          XCTAssertGreaterThan(bytes.count, 1000, url.lastPathComponent)
          XCTAssertEqual(Array(bytes.prefix(8)), [137, 80, 78, 71, 13, 10, 26, 10])
        }
      }
    }
    #else
    throw XCTSkip("Tier screenshots are DEBUG-only.")
    #endif
  }
}
