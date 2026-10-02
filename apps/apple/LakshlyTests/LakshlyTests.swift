import CryptoKit
import XCTest

@testable import Lakshly

final class LakshlyTests: XCTestCase {
  func testIndianGrouping() {
    XCTAssertEqual(Money.format(1_234_567_850), "₹1,23,45,678.50")
    XCTAssertEqual(Money.format(-10000), "−₹100")
    XCTAssertEqual(Money.format(10000, dropZero: false), "₹100.00")
    XCTAssertEqual(Money.format(1), "₹0.01")
    XCTAssertEqual(Money.compact(12_000_000), "₹1.2L")
    XCTAssertEqual(Money.compact(3_400_000_000), "₹3.4Cr")
  }
  func testAuthenticatedEncryption() throws {
    let key = SymmetricKey(size: .bits256)
    let plaintext = Data("synthetic finances".utf8)
    let sealed = try SecureStore.seal(plaintext, key: key)
    XCTAssertEqual(try SecureStore.open(sealed, key: key), plaintext)
    var corrupted = sealed
    corrupted[corrupted.count - 1] ^= 1
    XCTAssertThrowsError(try SecureStore.open(corrupted, key: key))
    XCTAssertThrowsError(try SecureStore.open(sealed, key: SymmetricKey(size: .bits256)))
  }
}
