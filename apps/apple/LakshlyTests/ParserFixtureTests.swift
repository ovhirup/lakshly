import XCTest

@testable import Lakshly

final class ParserFixtureTests: XCTestCase {
  private struct Manifest: Decodable {
    var password: String
    var fixtures: [Fixture]
  }

  private struct Fixture: Decodable {
    var name: String
    var file: String
    var password: String?
    var withoutPassword: String?
    var wrongPassword: String?
  }

  private struct GoldenLine: Decodable, Equatable {
    var page: Int
    var text: String
  }

  private struct MergeFixture: Decodable {
    struct Report: Decodable {
      var added: Int
      var duplicates: Int
      var accountsAdded: Int
      var accountsUpdated: Int
      var sipsUpserted: Int
    }
    var first: Report
    var firstTransactionIds: [String]
    var againSbi: Report
    var sameHdfcLocked: Report
    var sameTransactionCount: Int
  }

  func testEveryFixtureMatchesLinesAndParseResult() throws {
    let manifest = try load(Manifest.self, name: "manifest", ext: "json", directory: "Parsers")
    for fixture in manifest.fixtures {
      let data = try Data(contentsOf: fixtureURL(fixture.file, directory: "Parsers"))
      if fixture.withoutPassword == "required" {
        assertPassword(data, password: nil, incorrect: false, name: fixture.name)
      }
      if fixture.wrongPassword == "incorrect" {
        assertPassword(data, password: "wrong", incorrect: true, name: fixture.name)
      }
      let document = try extractPdfText(data: data, password: fixture.password, fileName: fixture.file)
      let lines = document.lines.map { GoldenLine(page: $0.page, text: $0.text) }
      let expectedLines = try load([GoldenLine].self, name: fixture.name, ext: "lines.json", directory: "Parsers/expected")
      if lines != expectedLines {
        var message = "\(fixture.name) line count \(lines.count) vs \(expectedLines.count)"
        for index in 0..<min(lines.count, expectedLines.count) where lines[index] != expectedLines[index] {
          message = "\(fixture.name) line \(index)\n got: \(lines[index].text)\n expected: \(expectedLines[index].text)"
          break
        }
        XCTFail(message)
      }
      let actual = try JSONEncoder().encode(parseDocument(document))
      let expected = try Data(contentsOf: fixtureURL("\(fixture.name).result.json", directory: "Parsers/expected"))
      try assertJSONEqual(actual, expected, label: fixture.name)
    }
  }

  func testDepositoryCasMatchesFiguresAndLockedPdf() throws {
    let nsdl = try parsedResult("nsdl-cas")
    let cdsl = try parsedResult("cdsl-cas")
    let locked = try parsedResult("cdsl-cas-locked", password: "DEMO1234")
    XCTAssertEqual(nsdl.adapter, "cas.depository")
    XCTAssertEqual(nsdl.confidence, 0.95)
    XCTAssertEqual(nsdl.accounts.map(\.balance), [652000, 486006, 1003753, 255000])
    XCTAssertEqual(nsdl.accounts.map(\.mask), ["1357", "2468", "1234", "5678"])
    XCTAssertEqual(nsdl.accounts.map(\.type), ["stocks", "stocks", "mutual_fund", "mutual_fund"])
    XCTAssertEqual(nsdl.accounts.map(\.invested), [nil, nil, 900000, 240000])
    XCTAssertEqual(nsdl.accounts.map(\.asOf), ["2026-08-31", "2026-08-31", "2026-08-31", "2026-08-31"])
    XCTAssertEqual(nsdl.accounts.first?.institution, "NSDL / Demo Securities Ltd")
    XCTAssertEqual(nsdl.accounts.first { $0.mask == "2468" }?.institution, "CDSL / Demo Securities Ltd")
    XCTAssertEqual(nsdl.transactions.count, 0)
    XCTAssertEqual(nsdl.sips.count, 0)
    XCTAssertEqual(nsdl.warnings, [])
    XCTAssertEqual(nsdl.meta.first?.issuer, "nsdl")
    XCTAssertEqual(nsdl.meta.first?.periodFrom, "2026-08-01")
    XCTAssertEqual(nsdl.meta.first?.periodTo, "2026-08-31")
    XCTAssertEqual(nsdl.meta.first?.totalValue, 2396759)
    XCTAssertEqual(nsdl.meta.first?.quantityTransactionCount, 3)
    XCTAssertEqual(nsdl.accounts.reduce(0) { $0 + $1.balance }, 2396759)
    let nsdlIndex = nsdl.holdings.first { $0.isin == "INF000K01AB1" }
    XCTAssertEqual(nsdlIndex?.units, 125.125)
    XCTAssertEqual(nsdlIndex?.nav, 32.48)
    XCTAssertEqual(nsdlIndex?.marketValue, 406406)
    XCTAssertEqual(nsdlIndex?.costValue, 0)
    XCTAssertEqual(nsdl.holdings.first?.isin, "INE000A01011")
    XCTAssertEqual(nsdl.holdings.first?.units, 12.5)
    XCTAssertEqual(nsdl.holdings.first?.nav, 120.4)
    XCTAssertEqual(nsdl.holdings.first?.marketValue, 150500)
    XCTAssertEqual(nsdl.holdings[1].units, 20)
    XCTAssertEqual(nsdl.holdings[1].nav, 250.75)
    XCTAssertEqual(nsdl.holdings[1].marketValue, 501500)
    XCTAssertEqual(nsdl.holdings.last?.units, 100)
    XCTAssertEqual(nsdl.holdings.last?.nav, 25.5)
    XCTAssertEqual(nsdl.holdings.last?.marketValue, 255000)
    XCTAssertEqual(nsdl.accounts.last?.invested, 240000)

    XCTAssertEqual(cdsl.accounts.map(\.balance), [486006, 1003753])
    XCTAssertEqual(cdsl.accounts.map(\.mask), ["2468", "1234"])
    XCTAssertEqual(cdsl.accounts.filter { $0.type == "stocks" }.count, 1)
    XCTAssertEqual(cdsl.accounts.first { $0.mask == "1234" }?.invested, 900000)
    XCTAssertNil(cdsl.accounts.first { $0.type == "stocks" }?.invested)
    XCTAssertEqual(cdsl.meta.first?.issuer, "cdsl")
    XCTAssertEqual(cdsl.meta.first?.totalValue, 1489759)
    XCTAssertEqual(cdsl.meta.first?.quantityTransactionCount, 2)
    XCTAssertEqual(cdsl.holdings.first { $0.isin == "INE000A01012" }?.units, 8)
    XCTAssertEqual(cdsl.holdings.first { $0.isin == "INE000A01012" }?.nav, 99.5)
    XCTAssertEqual(cdsl.holdings.first { $0.isin == "INE000A01012" }?.marketValue, 79600)
    let folio = cdsl.holdings.first { $0.isin == "INF000K01AB2" }
    XCTAssertEqual(folio?.units, 200.25)
    XCTAssertEqual(folio?.nav, 50.125)
    XCTAssertEqual(folio?.costValue, 900000)
    XCTAssertEqual(folio?.marketValue, 1003753)
    try assertJSONEqual(JSONEncoder().encode(locked), JSONEncoder().encode(cdsl), label: "cdsl-cas-locked")
    let secrets = ["IN30000001", "00001357", "1200000000002468", "70001234", "70005678", "DEMO1234"]
    for result in [nsdl, cdsl, locked] {
      let json = String(data: try JSONEncoder().encode(result), encoding: .utf8) ?? ""
      for secret in secrets { XCTAssertFalse(json.contains(secret), "\(result.adapter) leaked \(secret)") }
    }
  }

  func testDepositoryDetectionAndTextRows() throws {
    func score(_ lines: [String]) -> Double {
      rankAdapters(textDocFromLines(lines)).first { $0.adapter.id == "cas.depository" }?.score ?? -1
    }
    XCTAssertEqual(score(["Consolidated Account Statement", "NSDL", "DP ID: IN30000001"]), 0.95)
    XCTAssertEqual(score(["Consolidated Account Statement", "Central Depository Services (India) Limited", "BO ID: 1200000000002468"]), 0.95)
    XCTAssertEqual(score(["Consolidated Account Statement", "CDSL", "Demat Account"]), 0.95)
    XCTAssertEqual(score(["CAS - SYNTHETIC", "CDSL", "BO ID: 1200000000002468"]), 0.85)
    XCTAssertEqual(score(["Account Statement", "NSDL", "DP ID"]), 0)
    XCTAssertEqual(score(["Consolidated Account Statement", "NSDL"]), 0)
    XCTAssertEqual(score(["Consolidated Account Statement", "DP ID"]), 0)

    let parsed = parseDocument(textDocFromLines([
      "Consolidated Account Statement - SYNTHETIC", "NSDL", "Statement for the period from 01-Aug-2026 to 31-Aug-2026",
      "NSDL Demat Account", "DP Name: Demo Securities Ltd", "DP ID: IN300001", "Client ID: 00001357",
      "Equities (E)", "INE000A01011 Demo Industries Ltd 12.5 10.5 2 120.40 1,505.00",
      "CDSL Demat Account", "DP Name: Demo Securities Ltd", "DP ID: 12000000", "Client ID: 00002468",
      "INE000A01012 Demo Tools Ltd 8 6 2 99.50 796.00",
      "Mutual Fund Units held with RTAs (MF Folios)",
      "Demo Balanced Fund INF000K01AB2 70001234 / 12 200.25 50.125 - 10,037.53 -",
      "Demo Short Term Fund INF000K01AB3 70001234 / 12 100 25.5 2,400.00 2,550.00 150.00",
    ]))
    XCTAssertEqual(parsed.accounts.map { [$0.type, $0.mask ?? "", String($0.balance)] }, [
      ["stocks", "1357", "150500"], ["stocks", "2468", "79600"], ["mutual_fund", "1234", "1003753"], ["mutual_fund", "1234", "255000"],
    ])
    XCTAssertEqual(Set(parsed.accounts.map(\.id)).count, 4)
    XCTAssertNil(parsed.accounts[2].invested)
    XCTAssertEqual(parsed.holdings[2].costValue, 0)
    XCTAssertEqual(parsed.accounts[3].invested, 240000)
    XCTAssertEqual(parsed.meta.first?.totalValue, 1488853)
    XCTAssertEqual(parsed.meta.first?.quantityTransactionCount, 0)
    XCTAssertEqual(parsed.warnings, [])
    let textJSON = String(data: try JSONEncoder().encode(parsed), encoding: .utf8) ?? ""
    for secret in ["IN300001", "00001357", "12000000", "00002468", "70001234"] {
      XCTAssertFalse(textJSON.contains(secret), textJSON)
    }

    let skipped = parseDocument(textDocFromLines([
      "Consolidated Account Statement", "NSDL", "NSDL Demat Account", "DP Name: Demo Securities Ltd",
    ]))
    XCTAssertEqual(skipped.warnings, [
      "Statement period end not found; please review the valuation date.",
      "Demat account identifier not found; account skipped.",
      "No holdings found in the depository CAS.",
    ])
    XCTAssertTrue(skipped.accounts.isEmpty)
    XCTAssertEqual(skipped.meta.first?.accountId, "acc_none000")
    XCTAssertEqual(skipped.meta.first?.issuer, "nsdl")
    XCTAssertEqual(skipped.meta.first?.totalValue, 0)
    XCTAssertEqual(skipped.meta.first?.quantityTransactionCount, 0)

    let casData = try Data(contentsOf: fixtureURL("cas.synthetic.pdf", directory: "Parsers"))
    let casDoc = try extractPdfText(data: casData, password: nil, fileName: "cas.synthetic.pdf")
    XCTAssertEqual(parseDocument(casDoc).adapter, "cas.cams-kfintech")
    XCTAssertEqual(rankAdapters(casDoc).first { $0.adapter.id == "cas.depository" }?.score, 0)
    let augmented = textDocFromLines(casDoc.lines.map(\.text) + ["NSDL Demat Account"])
    XCTAssertEqual(parseDocument(augmented).adapter, "cas.cams-kfintech")
    XCTAssertEqual(rankAdapters(augmented).first { $0.adapter.id == "cas.depository" }?.score, 0)
  }

  func testCsvAndMergeMatchGoldens() throws {
    let csv = try String(contentsOf: fixtureURL("generic.synthetic.csv", directory: "Parsers"), encoding: .utf8)
    let parsed = parseCsv(csv, fileName: "generic.synthetic.csv")
    let actual = try JSONEncoder().encode(parsed)
    let expected = try Data(contentsOf: fixtureURL("generic-csv.result.json", directory: "Parsers/expected"))
    try assertJSONEqual(actual, expected, label: "generic-csv")
    XCTAssertEqual(parsed.transactions.map { [$0.date, String($0.amount), $0.category] }, [
      ["2026-09-01", "12500000", "income"],
      ["2026-09-03", "-45000", "dining"],
      ["2026-09-05", "-234550", "groceries"],
    ])

    let golden = try load(MergeFixture.self, name: "merge", ext: "json", directory: "Parsers/expected")
    let hdfc = try parsedResult("hdfc-bank")
    let sbi = try parsedResult("sbi-bank")
    let locked = try parsedResult("hdfc-bank-locked", password: "DEMO1234")
    let first = mergeResult(emptyDataset(now: Date(timeIntervalSince1970: 0)), hdfc)
    assertReport(first.report, golden.first, label: "first")
    XCTAssertEqual(first.dataset.transactions.map(\.id), golden.firstTransactionIds)
    let again = mergeResult(first.dataset, sbi)
    assertReport(again.report, golden.againSbi, label: "againSbi")
    let same = mergeResult(first.dataset, locked)
    assertReport(same.report, golden.sameHdfcLocked, label: "sameHdfcLocked")
    XCTAssertEqual(same.dataset.transactions.count, golden.sameTransactionCount)
  }

  func testCategoriesMasksAndNoFullAccountNumbers() throws {
    let banks = [("hdfc-bank", "bank.hdfc", "4321"), ("sbi-bank", "bank.sbi", "6543"), ("icici-bank", "bank.icici", "5678"), ("generic-bank", "bank.generic", "3333")]
    let forbidden = ["50100000004321", "00000039876543", "0000111122223333", "123456789012", "91234567"]
    for (name, adapter, mask) in banks {
      let result = try parsedResult(name)
      XCTAssertEqual(result.adapter, adapter, name)
      XCTAssertEqual(result.kind, "bank", name)
      XCTAssertEqual(result.accounts.first?.type, "savings", name)
      XCTAssertEqual(result.accounts.first?.mask, mask, name)
      XCTAssertEqual(result.accounts.first?.balance, 12_788_750, name)
      XCTAssertEqual(result.warnings, [], name)
      let category = { (needle: String) in result.transactions.first { $0.description.uppercased().contains(needle) }?.category }
      XCTAssertEqual(category("SALARY"), "income", name)
      XCTAssertEqual(category("RENT"), "rent", name)
      XCTAssertEqual(category("SWIGGY"), "dining", name)
      XCTAssertEqual(category("BIGBASKET"), "groceries", name)
      XCTAssertEqual(category("ATM"), "cash", name)
      XCTAssertEqual(category("CREDIT CARD"), "transfers", name)
      XCTAssertEqual(category("SIP"), "investments", name)
      XCTAssertEqual(category("UBER"), "transport", name)
      XCTAssertEqual(category("NETFLIX"), "subscriptions", name)
      XCTAssertEqual(result.transactions.first { $0.description.contains("SWIGGY") }?.method, "upi", name)
      let json = String(data: try JSONEncoder().encode(result), encoding: .utf8) ?? ""
      for secret in forbidden { XCTAssertFalse(json.contains(secret), "\(name) leaked \(secret)") }
    }
    let hdfc = try parsedResult("hdfc-bank")
    XCTAssertTrue(hdfc.transactions.first { $0.description.contains("ZEPTO") }?.description.contains("DEMO GROCERIES ORDER") == true)
    XCTAssertTrue(hdfc.transactions.last?.description.contains("NETFLIX") == true)
    XCTAssertEqual(hdfc.meta.first?.periodFrom, "2026-09-01")
    XCTAssertEqual(hdfc.meta.first?.periodTo, "2026-09-30")
    XCTAssertEqual(hdfc.meta.first?.openingBalance, 6_000_000)
    XCTAssertEqual(hdfc.meta.first?.closingBalance, 12_788_750)

    let hdfcCard = try parsedResult("hdfc-card")
    XCTAssertEqual(hdfcCard.adapter, "card.hdfc")
    XCTAssertEqual(hdfcCard.accounts.first?.mask, "4417")
    XCTAssertEqual(hdfcCard.transactions.first { $0.description.contains("PAYMENT RECEIVED") }?.category, "transfers")
    let sbiCard = try parsedResult("sbi-card")
    XCTAssertEqual(sbiCard.adapter, "card.sbi")
    XCTAssertEqual(sbiCard.accounts.first?.mask, "9012")
    let genericCard = try parsedResult("generic-card")
    XCTAssertEqual(genericCard.adapter, "card.generic")
    XCTAssertEqual(genericCard.transactions.map(\.amount), [-25000, 49900, -568110])
    XCTAssertEqual(genericCard.meta.first?.totalDue, 543210)
    XCTAssertEqual(genericCard.meta.first?.minDue, 30000)
    XCTAssertEqual(genericCard.meta.first?.dueDate, "2026-09-25")
    XCTAssertEqual(genericCard.meta.first?.statementDate, "2026-09-05")
    XCTAssertEqual(genericCard.accounts.first?.mask, "3456")

    let cas = try parsedResult("cas")
    XCTAssertEqual(cas.adapter, "cas.cams-kfintech")
    XCTAssertEqual(cas.accounts.count, 3)
    XCTAssertEqual(cas.accounts.map(\.mask), ["4567", "4567", "0011"])
    XCTAssertEqual(cas.transactions.count, 14)
    XCTAssertEqual(cas.transactions.first { $0.description == "Redemption" }?.amount, -1_000_000)
    XCTAssertEqual(cas.sips.map(\.dayOfMonth), [5, 10])
    XCTAssertEqual(cas.sips.map(\.status), ["active", "active"])
    let casJSON = String(data: try JSONEncoder().encode(cas), encoding: .utf8) ?? ""
    XCTAssertFalse(casJSON.contains("91234567"))
  }

  func testMergePreservesBudgetsAndDropsDuplicates() throws {
    let budget = Budget(id: "bud_1", month: "2026-09", category: "dining", limit: 100, rollover: nil)
    let existing = Dataset(
      schemaVersion: "0.1.0", generatedAt: "2026-01-01T00:00:00.000Z", synthetic: true, notice: "keep",
      currency: "INR", accounts: [], transactions: [], budgets: [budget], debts: [], sips: [], rewards: [])
    let parsed = try parsedResult("hdfc-bank")
    let first = datasetByMerging(existing, parsed, now: Date(timeIntervalSince1970: 0))
    XCTAssertEqual(first.dataset.budgets?.map(\.id), ["bud_1"])
    XCTAssertEqual(first.dataset.notice, "keep")
    XCTAssertEqual(first.dataset.synthetic, false)
    XCTAssertEqual(first.report.added, parsed.transactions.count)
    let second = datasetByMerging(first.dataset, parsed, now: Date(timeIntervalSince1970: 0))
    XCTAssertEqual(second.report.added, 0)
    XCTAssertEqual(second.report.duplicates, parsed.transactions.count)
    XCTAssertEqual(second.dataset.budgets?.first?.limit, 100)
    XCTAssertEqual(second.dataset.transactions.count, parsed.transactions.count)
  }

  private func parsedResult(_ name: String, password: String? = nil) throws -> ParseResult {
    let file = name.hasSuffix(".synthetic.pdf") ? name : "\(name).synthetic.pdf"
    let data = try Data(contentsOf: fixtureURL(file, directory: "Parsers"))
    return parseDocument(try extractPdfText(data: data, password: password, fileName: file))
  }

  private func assertPassword(_ data: Data, password: String?, incorrect: Bool, name: String) {
    do {
      _ = try extractPdfText(data: data, password: password, fileName: name)
      XCTFail("\(name) opened without the expected password error")
    } catch let error as PasswordRequired {
      XCTAssertEqual(error.incorrect, incorrect, name)
    } catch {
      XCTFail("\(name) threw \(error)")
    }
  }

  private func assertReport(_ report: MergeReport, _ expected: MergeFixture.Report, label: String) {
    XCTAssertEqual(report.added, expected.added, label)
    XCTAssertEqual(report.duplicates, expected.duplicates, label)
    XCTAssertEqual(report.accountsAdded, expected.accountsAdded, label)
    XCTAssertEqual(report.accountsUpdated, expected.accountsUpdated, label)
    XCTAssertEqual(report.sipsUpserted, expected.sipsUpserted, label)
  }

  private func fixtureURL(_ name: String, directory: String) -> URL {
    let parts = name.split(separator: ".", omittingEmptySubsequences: false)
    let ext = parts.count > 1 ? parts.dropFirst().joined(separator: ".") : ""
    let stem = String(parts.first ?? "")
    let url = Bundle(for: ParserFixtureTests.self).url(forResource: stem, withExtension: ext, subdirectory: directory)
    XCTAssertNotNil(url, "\(directory)/\(name)")
    return url ?? URL(fileURLWithPath: "/missing/\(name)")
  }

  private func load<T: Decodable>(_ type: T.Type, name: String, ext: String, directory: String) throws -> T {
    let url = try XCTUnwrap(Bundle(for: ParserFixtureTests.self).url(forResource: name, withExtension: ext, subdirectory: directory))
    return try JSONDecoder().decode(T.self, from: Data(contentsOf: url))
  }

  private func assertJSONEqual(_ actual: Data, _ expected: Data, label: String) throws {
    let left = try JSONSerialization.jsonObject(with: expected)
    let right = try JSONSerialization.jsonObject(with: actual)
    if let diff = jsonDiff(left, right, path: "$") {
      XCTFail("\(label) \(diff)")
    }
  }
}

final class ParserUtilTests: XCTestCase {
  func testParseAmount() {
    let cases: [(String, Int)] = [
      ("1,23,456.78", 12345678), ("450.00", 45000), ("Rs. 99.50", 9950), ("INR 1,000", 100000),
      ("5,000.00 Cr", 500000), ("5,000.00 Dr", -500000), ("(10,000.00)", -1000000), ("-12.30", -1230),
      ("1,234.00 D", -123400), ("2,00,000", 20000000),
    ]
    for (text, paise) in cases { XCTAssertEqual(parseAmount(text), paise, text) }
    for text in ["", "abc", "12/09/2026", "1.2.3"] { XCTAssertNil(parseAmount(text), text) }
  }

  func testParseDate() {
    let cases = [
      ("05/09/2026", "2026-09-05"), ("05/09/26", "2026-09-05"), ("5-9-2026", "2026-09-05"),
      ("05.09.2026", "2026-09-05"), ("05-Sep-2026", "2026-09-05"), ("5 Sep 2026", "2026-09-05"),
      ("05 Sep 26", "2026-09-05"), ("5-Sept-26", "2026-09-05"), ("2026-09-05", "2026-09-05"),
    ]
    for (text, day) in cases { XCTAssertEqual(parseDate(text), day, text) }
    XCTAssertNil(parseDate("31/02/2026"))
    XCTAssertNil(parseDate("13/13/2026"))
  }

  func testMasking() {
    XCTAssertEqual(last4("50100000004321"), "4321")
    XCTAssertEqual(last4("XXXX XXXX XXXX 4417"), "4417")
    XCTAssertNil(last4("12"))
    XCTAssertEqual(redactNumbers("UPI-ABC-123456789012-x"), "UPI-ABC-XXXX9012-x")
    XCTAssertEqual(redactNumbers("Instalment 13"), "Instalment 13")
  }

  func testRulesAndStableIds() {
    XCTAssertEqual(categorise("UPI-ZOMATO-x", -100), "dining")
    XCTAssertEqual(categorise("NEFT SALARY", 100), "income")
    XCTAssertEqual(categorise("REFUND XYZ", 100), "income")
    XCTAssertEqual(categorise("SOMETHING", -100), "other")
    XCTAssertEqual(guessMerchant("UPI-SWIGGY-swiggy@demo-XXXX9012-Food"), "Swiggy")
    XCTAssertEqual(guessMerchant("POS 416021XXXXXX1234 BIGBASKET DEMO"), "Bigbasket Demo")
    XCTAssertEqual(stableId("txn", "a", 1), "txn_1ri05dbjz76")
    XCTAssertEqual(stableId("txn", "a", 1), stableId("txn", "a", 1))
    XCTAssertNotEqual(stableId("txn", "a", 1), stableId("txn", "a", 2))
  }
}

private func jsonDiff(_ expected: Any, _ actual: Any, path: String) -> String? {
  if expected is NSNull, actual is NSNull { return nil }
  if expected is NSNull || actual is NSNull { return "\(path) null mismatch" }
  if let expectedBool = jsonBool(expected), let actualBool = jsonBool(actual) {
    return expectedBool == actualBool ? nil : "\(path) bool \(actualBool) != \(expectedBool)"
  }
  if jsonBool(expected) != nil || jsonBool(actual) != nil { return "\(path) bool/number mismatch" }
  if let expectedNumber = expected as? NSNumber, let actualNumber = actual as? NSNumber {
    let left = expectedNumber.doubleValue
    let right = actualNumber.doubleValue
    if left.rounded() == left, right.rounded() == right, abs(left) < 1e15, abs(right) < 1e15 {
      return expectedNumber.int64Value == actualNumber.int64Value ? nil : "\(path) int \(actualNumber) != \(expectedNumber)"
    }
    return abs(left - right) <= 1e-6 ? nil : "\(path) float \(right) != \(left)"
  }
  if let expectedText = expected as? String, let actualText = actual as? String {
    return expectedText == actualText ? nil : "\(path) \(actualText) != \(expectedText)"
  }
  if let expectedItems = expected as? [Any], let actualItems = actual as? [Any] {
    if expectedItems.count != actualItems.count { return "\(path) count \(actualItems.count) != \(expectedItems.count)" }
    for (index, pair) in zip(expectedItems, actualItems).enumerated() {
      if let diff = jsonDiff(pair.0, pair.1, path: "\(path)[\(index)]") { return diff }
    }
    return nil
  }
  if let expectedObject = expected as? [String: Any], let actualObject = actual as? [String: Any] {
    let missing = Set(expectedObject.keys).subtracting(actualObject.keys).sorted()
    let extra = Set(actualObject.keys).subtracting(expectedObject.keys).sorted()
    if !missing.isEmpty || !extra.isEmpty { return "\(path) keys missing \(missing) extra \(extra)" }
    for key in expectedObject.keys.sorted() {
      if let diff = jsonDiff(expectedObject[key]!, actualObject[key]!, path: "\(path).\(key)") { return diff }
    }
    return nil
  }
  return "\(path) type mismatch"
}

private func jsonBool(_ value: Any) -> Bool? {
  guard let number = value as? NSNumber, CFGetTypeID(number) == CFBooleanGetTypeID() else { return nil }
  return number.boolValue
}
