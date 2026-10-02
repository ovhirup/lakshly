import Foundation

private let dateToken = #"(\d{1,2}[/.\- ](?:\d{1,2}|[A-Za-z]{3,4})[/.\- ]\d{2,4})"#
private let defaultAccount = RE(#"(?:A\/C|Account|Acct)\s*(?:No|Number|#)?\.?\s*[:\-]?\s*([0-9Xx*][0-9Xx*\s-]{5,24}\d)"#, .caseInsensitive)
private let periodPattern = RE(
  #"(?:from|period|statement period)\s*:?\s*"# + dateToken + #"\s*(?:to|-|–)\s*:?\s*"# + dateToken,
  .caseInsensitive)
private let cardRow = RE(
  #"^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[\s-][A-Za-z]{3,4}[\s-]\d{2,4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?\s+(.+?)\s+((?:₹\s?)?\d{1,3}(?:,\d{2,3})*\.\d{2}|\d+\.\d{2})\s*(Cr|CR|C|Dr|DR|D)?$"#)
private let defaultCard = RE(#"(?:Card\s*(?:No|Number)\.?\s*[:\-]?\s*)([0-9Xx*][0-9Xx*\s-]{10,22}\d)"#, .caseInsensitive)
private let groupedCard = RE(#"\b((?:[0-9Xx*]{4}[\s-]?){3}\d{4})\b"#)
private let paymentThanks = RE(#"PAYMENT|THANK"#, .caseInsensitive)
private let creditSuffix = RE(#"^c"#, .caseInsensitive)
private let whitespaceRun = RE(#"\s+"#)
private let doubleSpace = RE(#"\s{2,}"#)

func findAccountMask(_ doc: TextDoc, _ pattern: RE? = nil) -> String? {
  guard let match = findText(doc, pattern ?? defaultAccount) else { return nil }
  return last4(group(match, 1))
}

func findPeriod(_ doc: TextDoc) -> (from: String?, to: String?) {
  guard let match = findText(doc, periodPattern) else { return (nil, nil) }
  let from = group(match, 1).map { parseDate($0.replacingOccurrences(of: " ", with: "-")) } ?? nil
  let to = group(match, 2).map { parseDate($0.replacingOccurrences(of: " ", with: "-")) } ?? nil
  return (from ?? nil, to ?? nil)
}

func normDesc(_ text: String) -> String {
  text.uppercased().replacingOccurrences(of: "[^A-Z0-9]+", with: " ", options: .regularExpression)
    .trimmingCharacters(in: .whitespacesAndNewlines)
}

func toTransactions(accountId: String, items: [(date: String, amount: Int, narration: String)], method: String?) -> [ParseTransaction] {
  var seen: [String: Int] = [:]
  return items.map { item in
    let collapsed = whitespaceRun.replacingAll(in: item.narration) { _ in " " }
      .trimmingCharacters(in: .whitespacesAndNewlines)
    let redacted = redactNumbers(collapsed)
    let description = redacted.isEmpty ? "Transaction" : String(redacted.prefix(140))
    let key = "\(item.date)|\(item.amount)|\(normDesc(description))"
    let occurrence = (seen[key] ?? 0) + 1
    seen[key] = occurrence
    let merchant = guessMerchant(description)
    return ParseTransaction(
      id: stableId("txn", accountId, key, occurrence),
      accountId: accountId,
      date: item.date,
      amount: item.amount,
      description: description,
      merchant: merchant,
      category: categorise(description, item.amount),
      method: method ?? detectMethod(description),
      recurring: nil,
      tags: nil,
      categorisedBy: "rule")
  }
}

struct BankOptions {
  var adapter: String
  var institution: String
  var spec: HeaderSpec
  var minHits: Int = 3
  var accountRe: RE?
}

func parseBank(_ doc: TextDoc, _ options: BankOptions) -> ParseBody {
  var warnings: [String] = []
  let rows = readTable(doc, options.spec, minHits: options.minHits)
  let opening = amountNear(doc, RE(#"Opening Balance"#, .caseInsensitive))
  let signed = signedAmounts(rows, opening: opening)
  if signed.isEmpty { warnings.append("No transactions found. Is this a savings/current account statement?") }
  let mask = findAccountMask(doc, options.accountRe)
  if mask == nil { warnings.append("Account number not found; account will be matched by bank name only.") }
  let period = findPeriod(doc)
  let accountId = stableId("acc", options.institution, "savings", mask ?? "")
  let lastBalance = rows.reversed().first { $0.balance != nil }?.balance
  let closing = lastBalance ?? amountNear(doc, RE(#"Closing Bal(ance)?"#, .caseInsensitive)) ?? 0
  let asOf = period.to ?? signed.last?.row.date ?? isoDay()
  var account = ParseAccount(
    id: accountId,
    name: clipped("\(options.institution) Savings\(mask.map { " \u{2022}\u{2022}\($0)" } ?? "")"),
    type: "savings",
    institution: options.institution,
    mask: mask,
    currency: "INR",
    balance: closing,
    invested: nil,
    creditLimit: nil,
    statementDay: nil,
    dueDay: nil,
    asOf: asOf,
    source: "statement")
  if mask == nil { account.mask = nil }
  if let opening, closing != 0 {
    let sum = signed.reduce(0) { $0 + $1.amount }
    if abs(opening + sum - closing) > 100 {
      warnings.append("Totals don't reconcile with the closing balance; please review amounts.")
    }
  }
  let transactions = toTransactions(
    accountId: accountId,
    items: signed.map { (date: $0.row.date, amount: $0.amount, narration: $0.row.narration) },
    method: nil)
  let meta = StatementMeta(
    adapter: options.adapter,
    kind: "bank",
    institution: options.institution,
    accountId: accountId,
    periodFrom: period.from,
    periodTo: period.to,
    statementDate: nil,
    dueDate: nil,
    totalDue: nil,
    minDue: nil,
    openingBalance: opening,
    closingBalance: closing)
  return ParseBody(accounts: [account], transactions: transactions, sips: [], holdings: [], meta: [meta], warnings: warnings)
}

struct CardLabels {
  var totalDue: RE
  var minDue: RE
  var dueDate: RE
  var statementDate: RE
  var limit: RE?
}

struct CardOptions {
  var adapter: String
  var institution: String
  var labels: CardLabels
  var startRe: RE?
  var endRe: RE?
  var cardRe: RE?
}

func parseCard(_ doc: TextDoc, _ options: CardOptions) -> ParseBody {
  var warnings: [String] = []
  let totalDue = amountNear(doc, options.labels.totalDue)
  let minDue = amountNear(doc, options.labels.minDue)
  let dueDate = dateNear(doc, options.labels.dueDate)
  let statementDate = dateNear(doc, options.labels.statementDate)
  let limit = options.labels.limit.flatMap { amountNear(doc, $0) }
  let cardMatch = findText(doc, options.cardRe ?? defaultCard) ?? findText(doc, groupedCard)
  let mask = cardMatch.flatMap { last4(group($0, 1)) }
  var items: [(date: String, amount: Int, narration: String)] = []
  var inTable = options.startRe == nil
  for line in doc.lines {
    let spaced = doubleSpace.replacingAll(in: line.text) { _ in "  " }
      .trimmingCharacters(in: .whitespacesAndNewlines)
    if let start = options.startRe, start.test(spaced) {
      inTable = true
      continue
    }
    if let end = options.endRe, end.test(spaced) {
      inTable = false
      continue
    }
    if !inTable { continue }
    let collapsed = whitespaceRun.replacingAll(in: spaced) { _ in " " }
    guard let match = cardRow.match(collapsed), let date = group(match, 1).flatMap(parseDate), let amount = group(match, 3).flatMap(parseAmount) else { continue }
    let credit = group(match, 4).map { creditSuffix.test($0) } ?? false
    items.append((date, credit ? abs(amount) : -abs(amount), group(match, 2) ?? ""))
  }
  if items.isEmpty { warnings.append("No card transactions found.") }
  if totalDue == nil { warnings.append("Total amount due not found.") }
  let accountId = stableId("acc", options.institution, "credit_card", mask ?? "")
  let transactions = toTransactions(accountId: accountId, items: items, method: "card").map { transaction -> ParseTransaction in
    guard transaction.amount > 0, transaction.category == "income" else { return transaction }
    var copy = transaction
    copy.category = paymentThanks.test(transaction.description) ? "transfers" : "other"
    return copy
  }
  let balance = -(totalDue ?? -transactions.reduce(0) { $0 + $1.amount })
  var account = ParseAccount(
    id: accountId,
    name: clipped("\(options.institution) Credit Card\(mask.map { " \u{2022}\u{2022}\($0)" } ?? "")"),
    type: "credit_card",
    institution: options.institution,
    mask: mask,
    currency: "INR",
    balance: balance,
    invested: nil,
    creditLimit: (limit ?? 0) == 0 ? nil : limit,
    statementDay: statementDate.flatMap(dayNumber),
    dueDay: dueDate.flatMap(dayNumber),
    asOf: statementDate ?? items.last?.date ?? isoDay(),
    source: "statement")
  if mask == nil { account.mask = nil }
  if limit == nil || limit == 0 { account.creditLimit = nil }
  let meta = StatementMeta(
    adapter: options.adapter,
    kind: "card",
    institution: options.institution,
    accountId: accountId,
    periodFrom: nil,
    periodTo: nil,
    statementDate: statementDate,
    dueDate: dueDate,
    totalDue: totalDue,
    minDue: minDue,
    openingBalance: nil,
    closingBalance: nil)
  return ParseBody(accounts: [account], transactions: transactions, sips: [], holdings: [], meta: [meta], warnings: warnings)
}

private func dayNumber(_ iso: String) -> Int? {
  guard iso.count >= 10 else { return nil }
  return Int(iso.dropFirst(8).prefix(2))
}

private func clipped(_ text: String) -> String { String(text.prefix(80)) }
