import XCTest
@testable import Lakshly

/// Pins today's Swift money strings against the shared fixture that the web test also reads
/// (apps/web/tests/money-parity.test.ts). Differences between platforms are listed in the fixture's
/// knownDivergences and are removed in WP2; this test must not be "fixed" by editing Money.swift.
final class MoneyParityTests: XCTestCase {
  private struct Fixture: Decodable {
    struct Row: Decodable {
      struct Web: Decodable { let full: String; let compact: String }
      struct Swift: Decodable { let format: String; let formatKeepZero: String; let glance: String; let compact: String }
      let paise: Int64
      let web: Web
      let swift: Swift
    }
    let knownDivergences: [Int64]
    let rows: [Row]
  }

  func testSwiftStringsMatchPinnedFixture() throws {
    let fixture = try load()
    XCTAssertFalse(fixture.rows.isEmpty)
    for row in fixture.rows {
      XCTAssertEqual(Money.format(row.paise), row.swift.format, "format \(row.paise)")
      XCTAssertEqual(Money.format(row.paise, dropZero: false), row.swift.formatKeepZero, "formatKeepZero \(row.paise)")
      XCTAssertEqual(Money.glance(row.paise), row.swift.glance, "glance \(row.paise)")
      XCTAssertEqual(Money.compact(row.paise), row.swift.compact, "compact \(row.paise)")
    }
  }

  func testKnownDivergencesAreExactlyTheCurrentOnes() throws {
    let fixture = try load()
    let diverging = fixture.rows
      .filter { $0.web.full != $0.swift.glance || $0.web.compact != $0.swift.compact }
      .map(\.paise)
    XCTAssertEqual(diverging, fixture.knownDivergences)
  }

  private func load() throws -> Fixture {
    try JSONDecoder().decode(Fixture.self, from: Data(contentsOf: fixtureURL("format-parity")))
  }

  private func fixtureURL(_ name: String) throws -> URL {
    let bundle = Bundle(for: MoneyParityTests.self)
    if let url = bundle.url(forResource: name, withExtension: "json", subdirectory: "__fixtures__")
      ?? bundle.url(forResource: name, withExtension: "json") {
      return url
    }
    let enumerator = FileManager.default.enumerator(at: bundle.bundleURL, includingPropertiesForKeys: nil)
    while let item = enumerator?.nextObject() as? URL {
      if item.lastPathComponent == "\(name).json" { return item }
    }
    throw CocoaError(.fileNoSuchFile)
  }
}
