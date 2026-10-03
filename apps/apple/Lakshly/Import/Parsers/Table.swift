import Foundation

enum ColKey: String, Hashable {
  case serial, date, valueDate, narration, ref, debit, credit, amount, balance
}

struct Column {
  var key: ColKey
  var x0: Double
  var x1: Double
}

typealias HeaderSpec = [(ColKey, RE)]

private let numericKeys: Set<ColKey> = [.debit, .credit, .amount, .balance]
private let stopLine = RE(#"^(statement summary|opening balance|closing balance|\*+\s*end of statement|total|grand total|page \d+|this is a (computer|system) generated)"#, .caseInsensitive)
private let leadingJunk = RE(#"^[\s:\-]+"#)
private let leadingColon = RE(#"^[:\-]\s*"#)

struct TableRow {
  var date: String
  var valueDate: String?
  var narration: String
  var ref: String?
  var debit: Int?
  var credit: Int?
  var amount: Int?
  var balance: Int?
  var page: Int
}

func matchHeader(_ line: TextLine, _ spec: HeaderSpec, minHits: Int = 3) -> [Column]? {
  var columns: [Column] = []
  var used: Set<Int> = []
  for (key, pattern) in spec {
    var hit: (x0: Double, x1: Double)?
    var index = 0
    while index < line.items.count && hit == nil {
      if used.contains(index) { index += 1; continue }
      let item = line.items[index]
      if pattern.test(item.str) {
        hit = (item.x, item.x + item.w)
        used.insert(index)
        break
      }
      if index + 1 < line.items.count, !used.contains(index + 1) {
        let next = line.items[index + 1]
        if pattern.test("\(item.str) \(next.str)") {
          hit = (item.x, next.x + next.w)
          used.insert(index)
          used.insert(index + 1)
        }
      }
      index += 1
    }
    if let hit { columns.append(Column(key: key, x0: hit.x0, x1: hit.x1)) }
  }
  return columns.count >= minHits ? columns.sorted { $0.x0 < $1.x0 } : nil
}

func assign(_ items: [TextItem], _ columns: [Column]) -> [ColKey: String] {
  var out: [ColKey: String] = [:]
  let numeric = columns.filter { numericKeys.contains($0.key) }
  let textColumns = columns.filter { !numericKeys.contains($0.key) }
  for item in items {
    var column: Column?
    let right = item.x + item.w
    if amountToken.test(item.str.trimmingCharacters(in: .whitespacesAndNewlines)), !numeric.isEmpty {
      var best = numeric[0]
      for candidate in numeric.dropFirst() where abs(candidate.x1 - right) < abs(best.x1 - right) {
        best = candidate
      }
      column = best
      if right < numeric[0].x0 - 40 { column = nil }
    }
    if column == nil {
      let candidates = textColumns.filter { $0.x0 <= item.x + 6 }
      column = candidates.last ?? textColumns.first ?? columns.first
    }
    guard let column else { continue }
    if let existing = out[column.key] {
      out[column.key] = "\(existing) \(item.str)"
    } else {
      out[column.key] = item.str
    }
  }
  return out
}

func readTable(_ doc: TextDoc, _ spec: HeaderSpec, minHits: Int = 3, dateKey: ColKey = .date) -> [TableRow] {
  var rows: [TableRow] = []
  var columns: [Column]?
  var open = false
  var page = 0
  for line in doc.lines {
    if line.page != page {
      page = line.page
      open = false
    }
    if let header = matchHeader(line, spec, minHits: minHits) {
      columns = header
      open = false
      continue
    }
    guard let columns else { continue }
    if stopLine.test(line.text.trimmingCharacters(in: .whitespacesAndNewlines)) {
      open = false
      continue
    }
    let cells = assign(line.items, columns)
    let date = cells[dateKey].flatMap { value -> String? in
      let words = value.split(separator: " ").map(String.init)
      return parseDate(words.prefix(3).joined(separator: " ")) ?? words.first.flatMap(parseDate)
    }
    if let date {
      func num(_ key: ColKey) -> Int? { cells[key].flatMap(parseAmount) }
      rows.append(TableRow(
        date: date,
        valueDate: cells[.valueDate].flatMap(parseDate),
        narration: cells[.narration] ?? "",
        ref: cells[.ref],
        debit: num(.debit).map { abs($0) },
        credit: num(.credit).map { abs($0) },
        amount: num(.amount),
        balance: num(.balance),
        page: line.page
      ))
      open = true
    } else if open, let narration = cells[.narration], !narration.isEmpty, !cells.keys.contains(where: { numericKeys.contains($0) }) {
      rows[rows.count - 1].narration = "\(rows[rows.count - 1].narration) \(narration)".trimmingCharacters(in: .whitespacesAndNewlines)
    }
  }
  return rows
}

private func jsTruthy(_ value: Int?) -> Bool {
  guard let value else { return false }
  return value != 0
}

func signedAmounts(_ rows: [TableRow], opening: Int? = nil) -> [(row: TableRow, amount: Int)] {
  var out: [(row: TableRow, amount: Int)] = []
  var previous = opening
  for row in rows {
    var amount: Int?
    if jsTruthy(row.credit), !jsTruthy(row.debit) { amount = row.credit }
    else if jsTruthy(row.debit), !jsTruthy(row.credit) { amount = row.debit.map { -$0 } }
    else if let signed = row.amount { amount = signed }
    if amount != nil, let balance = row.balance, let previous, row.amount != nil, !jsTruthy(row.credit), !jsTruthy(row.debit) {
      let delta = balance - previous
      if abs(abs(delta) - abs(amount!)) <= 1 { amount = delta }
    }
    if amount == nil {
      if row.balance != nil { previous = row.balance }
      continue
    }
    out.append((row, amount!))
    if row.balance != nil { previous = row.balance }
  }
  return out
}

private let inlineValue = #"\s*[:\-]?\s*(?:Rs\.?|₹|INR)?\s*([0-9][0-9,]*\.\d{2}(?:\s?(?:Cr|Dr|CR|DR))?|\d{1,2}[/.\- ](?:\d{1,2}|[A-Za-z]{3,4})[/.\- ]\d{2,4})"#

func valueNear(_ doc: TextDoc, _ label: RE, kind: String) -> Any? {
  func parse(_ raw: String) -> Any? {
    if kind == "amount" {
      guard let amount = parseAmount(raw) else { return nil }
      return amount
    }
    guard let date = parseDate(raw.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)) else { return nil }
    return date
  }
  func stripped(_ raw: String) -> Any? {
    parse(currencyPrefix.replacingFirst(in: raw, with: ""))
  }
  for index in doc.lines.indices {
    let line = doc.lines[index]
    if let itemIndex = line.items.firstIndex(where: { label.test($0.str) }) {
      let labelItem = line.items[itemIndex]
      let after = line.items.dropFirst(itemIndex + 1).map { leadingColon.replacingFirst(in: $0.str, with: "") }.filter { !$0.isEmpty }
      let tail = leadingJunk.replacingFirst(in: label.replacingFirst(in: labelItem.str, with: ""), with: "")
      var candidates = [tail]
      if let first = after.first { candidates.append(first) }
      candidates.append(after.prefix(3).joined(separator: " "))
      candidates.append(after.prefix(2).joined(separator: " "))
      for candidate in candidates where !candidate.isEmpty {
        if let value = stripped(candidate) { return value }
      }
      let nextIndex = index + 1
      if nextIndex < doc.lines.count, doc.lines[nextIndex].page == line.page {
        let center = labelItem.x + labelItem.w / 2
        let sorted = doc.lines[nextIndex].items.sorted {
          abs(($0.x + $0.w / 2) - center) < abs(($1.x + $1.w / 2) - center)
        }
        for item in sorted.prefix(2) {
          if let value = stripped(item.str) { return value }
        }
      }
    } else if let combined = RE.compile(label.pattern + inlineValue, .caseInsensitive),
              let match = combined.match(line.text), let captured = group(match, 1), let value = parse(captured) {
      return value
    }
  }
  return nil
}

func amountNear(_ doc: TextDoc, _ label: RE) -> Int? {
  valueNear(doc, label, kind: "amount") as? Int
}

func dateNear(_ doc: TextDoc, _ label: RE) -> String? {
  valueNear(doc, label, kind: "date") as? String
}

func findText(_ doc: TextDoc, _ pattern: RE) -> [String?]? {
  for line in doc.lines {
    if let match = pattern.match(line.text) { return match }
  }
  return nil
}

func docText(_ doc: TextDoc, maxLines: Int = 400) -> String {
  doc.lines.prefix(maxLines).map(\.text).joined(separator: "\n")
}
