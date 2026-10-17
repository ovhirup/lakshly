import XCTest
@testable import Lakshly

final class WowStateTests: XCTestCase {
  func testDefensiveDecodeFallsBackAndRoundTrips() throws {
    let decoder = JSONDecoder()
    let bad = Data(#"{"extraPaise":"x","fees":7}"#.utf8)
    let empty = Data("{}".utf8)
    XCTAssertEqual(try decoder.decode(WowState.self, from: bad), WowState())
    XCTAssertEqual(try decoder.decode(WowState.self, from: empty), WowState())

    let fee = WowFee(id: "fee-demo", name: "Demo annual fee", amount: 120_000, due: "2026-04-01", yearly: true)
    let original = WowState(
      extraPaise: 25_000,
      rollOver: true,
      plannedCancels: ["sample.a", "sample.b"],
      fees: [fee],
      setAside: ["fee-demo": 40_000])
    let data = try JSONEncoder().encode(original)
    let decoded = try decoder.decode(WowState.self, from: data)
    XCTAssertEqual(decoded.extraPaise, original.extraPaise)
    XCTAssertEqual(decoded.rollOver, original.rollOver)
    XCTAssertEqual(decoded.plannedCancels, original.plannedCancels)
    XCTAssertEqual(decoded.fees, original.fees)
    XCTAssertEqual(decoded.setAside, original.setAside)
    XCTAssertEqual(decoded, original)
  }

  func testStoredDataRoundTripsWowAndSeparatingKeepsIt() throws {
    let seed = Dataset(
      schemaVersion: "0.1.0", generatedAt: "2026-01-01T00:00:00Z", synthetic: true, notice: nil,
      currency: "INR", accounts: [], transactions: [], budgets: nil, debts: nil, sips: nil, rewards: nil)
    let wow = WowState(extraPaise: 50_000, rollOver: true, plannedCancels: ["demo.keep"])
    let wowDemo = WowState(extraPaise: 10, rollOver: false, fees: [
      WowFee(id: "fee-sample", name: "Sample fee", amount: 500, due: "2026-12-01", yearly: false)
    ], setAside: ["fee-sample": 100])
    let stored = StoredData(
      dataset: seed, requests: [], source: .mine, wow: wow, wowDemo: wowDemo)
    let data = try JSONEncoder().encode(stored)
    let decoded = try JSONDecoder().decode(StoredData.self, from: data)
    XCTAssertEqual(decoded.wow, wow)
    XCTAssertEqual(decoded.wowDemo, wowDemo)

    let kept = decoded.separatingUserRows(seed: seed)
    XCTAssertEqual(kept.wow, wow)
    XCTAssertEqual(kept.wowDemo, wowDemo)

    var legacy = stored
    legacy.source = nil
    let split = legacy.separatingUserRows(seed: seed)
    XCTAssertEqual(split.wow, wow)
    XCTAssertEqual(split.wowDemo, wowDemo)
  }

  func testWowFeatureGates() {
    XCTAssertTrue(can(.freedomDate, tier: .free))
    XCTAssertTrue(can(.story, tier: .free))
    XCTAssertTrue(can(.subscriptionAudit, tier: .free))
    XCTAssertFalse(can(.freedomWhatIf, tier: .free))
    XCTAssertFalse(can(.storyShare, tier: .free))
    XCTAssertFalse(can(.feeRunway, tier: .free))
    for feature: Feature in [.freedomDate, .freedomWhatIf, .story, .storyShare, .subscriptionAudit, .feeRunway] {
      XCTAssertTrue(can(feature, tier: .premium), feature.rawValue)
    }
  }
}
