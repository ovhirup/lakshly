import Foundation

func splitCsv(_ text: String) -> [[String]] {
  var rows: [[String]] = []
  var row: [String] = []
  var cell = ""
  var quoted = false
  let units = Array(text)
  var index = 0
  while index < units.count {
    let character = units[index]
    if quoted {
      if character == "\"", index + 1 < units.count, units[index + 1] == "\"" {
        cell.append("\"")
        index += 1
      } else if character == "\"" {
        quoted = false
      } else {
        cell.append(character)
      }
    } else if character == "\"" {
      quoted = true
    } else if character == "," || character == "\t" || character == ";" {
      row.append(cell)
      cell = ""
    } else if character == "\n" || character == "\r" {
      if character == "\r", index + 1 < units.count, units[index + 1] == "\n" { index += 1 }
      row.append(cell)
      rows.append(row)
      row = []
      cell = ""
    } else {
      cell.append(character)
    }
    index += 1
  }
  if !cell.isEmpty || !row.isEmpty {
    row.append(cell)
    rows.append(row)
  }
  return rows.filter { $0.contains { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } }
}

private let csvNumber = RE(#"^-?[\d,]+\.\d{2}"#)

func csvToTextDoc(_ text: String, fileName: String? = nil) -> TextDoc {
  let rows = splitCsv(text)
  let width = max(1, rows.map(\.count).max() ?? 1)
  let columnWidth = 120.0
  let lines = rows.enumerated().compactMap { index, row -> TextLine? in
    var items = row.enumerated().compactMap { column, cell -> TextItem? in
      let trimmed = cell.trimmingCharacters(in: .whitespacesAndNewlines)
      guard !trimmed.isEmpty else { return nil }
      return TextItem(str: trimmed, x: Double(column) * columnWidth, w: columnWidth - 10)
    }
    for itemIndex in items.indices where csvNumber.test(items[itemIndex].str) {
      items[itemIndex].x = floor(items[itemIndex].x / columnWidth) * columnWidth
    }
    guard !items.isEmpty, width > 0 else { return nil }
    return TextLine(page: 1, y: Double(-index), items: items, text: items.map(\.str).joined(separator: "   "))
  }
  return TextDoc(pages: 1, lines: lines, fileName: fileName)
}

func parseCsv(_ text: String, fileName: String? = nil) -> ParseResult {
  let doc = csvToTextDoc(text, fileName: fileName)
  let body = genericBank.parse(doc)
  return ParseResult(
    adapter: "csv.generic",
    adapterLabel: "CSV export (generic columns)",
    kind: "bank",
    confidence: body.transactions.isEmpty ? 0 : 0.6,
    accounts: body.accounts,
    transactions: body.transactions,
    sips: body.sips,
    holdings: body.holdings,
    meta: body.meta,
    warnings: body.warnings)
}
