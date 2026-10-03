import XCTest

@testable import Lakshly

final class GlanceRenderTests: XCTestCase {
  @MainActor func testRenderGlanceShots() throws {
    let environment = ProcessInfo.processInfo.environment
    let directory = environment["LAKSHLY_RENDER_DIR"] ?? environment["TEST_RUNNER_LAKSHLY_RENDER_DIR"]
    guard let directory, !directory.isEmpty else {
      throw XCTSkip("Set LAKSHLY_RENDER_DIR to render glance shots.")
    }
    #if DEBUG
    let url = try XCTUnwrap(Bundle.main.url(forResource: "sample.synthetic", withExtension: "json"))
    let dataset = try JSONDecoder().decode(Dataset.self, from: Data(contentsOf: url))
    try GlanceShotRenderer.render(to: URL(fileURLWithPath: directory, isDirectory: true), dataset: dataset)
    let written = try FileManager.default.contentsOfDirectory(atPath: directory).filter { $0.hasSuffix(".png") }
    XCTAssertFalse(written.isEmpty)
    #else
    throw XCTSkip("Glance rendering is compiled into DEBUG builds.")
    #endif
  }
}
