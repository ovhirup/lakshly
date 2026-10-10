import XCTest
@testable import Lakshly

final class ParityRenderTests: XCTestCase {
  @MainActor func testRenderParityShots() throws {
    let env = ProcessInfo.processInfo.environment
    guard let path = env["LAKSHLY_SHOTS_DIR"] ?? env["TEST_RUNNER_LAKSHLY_SHOTS_DIR"], !path.isEmpty, !path.contains("$") else {
      throw XCTSkip("Set LAKSHLY_SHOTS_DIR to render parity PNGs.")
    }
    #if DEBUG
    let catalogURL = try XCTUnwrap(Bundle.main.url(forResource: "sources.catalog", withExtension: "json"))
    let dataURL = try XCTUnwrap(Bundle.main.url(forResource: "dataset.after-import", withExtension: "json"))
    let catalog = try SourcesCatalog.load(data: Data(contentsOf: catalogURL))
    let dataset = try JSONDecoder().decode(Dataset.self, from: Data(contentsOf: dataURL))
    let directory = URL(fileURLWithPath: path, isDirectory: true)
    try ParityShotRenderer.render(to: directory, catalog: catalog, dataset: dataset)
    #if os(iOS)
    let platform = "ios"
    #else
    let platform = "macos"
    #endif
    for theme in ["lakshmi-dark", "monochromeGold-light"] {
      for (category, screens) in [("name", ParityShotRenderer.nameScreens), ("gmail-tidy", ParityShotRenderer.batchScreens)] {
        for screen in screens {
          let url = directory.appendingPathComponent(category).appendingPathComponent("\(category)-\(screen)-\(platform)-\(theme).png")
          let bytes = try Data(contentsOf: url)
          XCTAssertGreaterThan(bytes.count, 1000, url.lastPathComponent)
          XCTAssertEqual(Array(bytes.prefix(8)), [137, 80, 78, 71, 13, 10, 26, 10])
        }
      }
    }
    #else
    throw XCTSkip("Parity snapshots are DEBUG-only.")
    #endif
  }
}
