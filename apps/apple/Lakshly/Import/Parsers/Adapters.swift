import Foundation

func adapterScore(_ doc: TextDoc, _ brand: RE, _ signals: [RE]) -> Double {
  let text = docText(doc)
  guard brand.test(text), !signals.isEmpty else { return 0 }
  let hits = signals.filter { $0.test(text) }.count
  return 0.4 + 0.6 * (Double(hits) / Double(signals.count))
}

let hdfcBank = Adapter(
  id: "bank.hdfc",
  label: "HDFC Bank account statement",
  kind: "bank",
  institution: "HDFC Bank",
  detect: { doc in
    adapterScore(doc, RE(#"HDFC BANK"#, .caseInsensitive), [
      RE(#"Withdrawal Amt"#, .caseInsensitive),
      RE(#"Deposit Amt"#, .caseInsensitive),
      RE(#"Closing Balance"#, .caseInsensitive),
      RE(#"Chq\.?\s*\/\s*Ref"#, .caseInsensitive),
      RE(#"Value Dt"#, .caseInsensitive),
      RE(#"Narration"#, .caseInsensitive),
    ])
  },
  parse: { doc in
    parseBank(doc, BankOptions(
      adapter: "bank.hdfc",
      institution: "HDFC Bank",
      spec: [
        (.date, RE(#"^Date$"#, .caseInsensitive)),
        (.narration, RE(#"^Narration$"#, .caseInsensitive)),
        (.ref, RE(#"^Chq\.?\s*\/?\s*Ref\.?\s*No\.?$"#, .caseInsensitive)),
        (.valueDate, RE(#"^Value Dt$"#, .caseInsensitive)),
        (.debit, RE(#"^Withdrawal Amt\.?$"#, .caseInsensitive)),
        (.credit, RE(#"^Deposit Amt\.?$"#, .caseInsensitive)),
        (.balance, RE(#"^Closing Balance$"#, .caseInsensitive)),
      ],
      minHits: 5))
  })

let sbiBank = Adapter(
  id: "bank.sbi",
  label: "SBI account statement",
  kind: "bank",
  institution: "State Bank of India",
  detect: { doc in
    adapterScore(doc, RE(#"State Bank of India|\bSBI\b"#, .caseInsensitive), [
      RE(#"Txn Date"#, .caseInsensitive),
      RE(#"Ref No\.?\s*\/?\s*Cheque"#, .caseInsensitive),
      RE(#"\bDebit\b"#, .caseInsensitive),
      RE(#"\bCredit\b"#, .caseInsensitive),
      RE(#"\bBalance\b"#, .caseInsensitive),
      RE(#"IFS(C)? Code"#, .caseInsensitive),
    ]) * (RE(#"SBI Card"#, .caseInsensitive).test(docText(doc)) ? 0 : 1)
  },
  parse: { doc in
    parseBank(doc, BankOptions(
      adapter: "bank.sbi",
      institution: "State Bank of India",
      spec: [
        (.date, RE(#"^Txn Date$"#, .caseInsensitive)),
        (.valueDate, RE(#"^Value Date$"#, .caseInsensitive)),
        (.narration, RE(#"^Description$"#, .caseInsensitive)),
        (.ref, RE(#"^Ref No\.?\s*\/?\s*Cheque No\.?$"#, .caseInsensitive)),
        (.debit, RE(#"^Debit$"#, .caseInsensitive)),
        (.credit, RE(#"^Credit$"#, .caseInsensitive)),
        (.balance, RE(#"^Balance$"#, .caseInsensitive)),
      ],
      minHits: 5))
  })

let iciciBank = Adapter(
  id: "bank.icici",
  label: "ICICI Bank account statement",
  kind: "bank",
  institution: "ICICI Bank",
  detect: { doc in
    adapterScore(doc, RE(#"ICICI Bank"#, .caseInsensitive), [
      RE(#"Transaction Remarks"#, .caseInsensitive),
      RE(#"Withdrawal Amount"#, .caseInsensitive),
      RE(#"Deposit Amount"#, .caseInsensitive),
      RE(#"Balance \(INR"#, .caseInsensitive),
      RE(#"Cheque Number"#, .caseInsensitive),
      RE(#"S\s?No\.?"#, .caseInsensitive),
    ]) * (RE(#"Minimum Amount Due"#, .caseInsensitive).test(docText(doc)) ? 0.3 : 1)
  },
  parse: { doc in
    parseBank(doc, BankOptions(
      adapter: "bank.icici",
      institution: "ICICI Bank",
      spec: [
        (.serial, RE(#"^S\s?No\.?$"#, .caseInsensitive)),
        (.valueDate, RE(#"^Value Date$"#, .caseInsensitive)),
        (.date, RE(#"^Transaction Date$"#, .caseInsensitive)),
        (.ref, RE(#"^Cheque Number$"#, .caseInsensitive)),
        (.narration, RE(#"^Transaction Remarks$"#, .caseInsensitive)),
        (.debit, RE(#"^Withdrawal Amount"#, .caseInsensitive)),
        (.credit, RE(#"^Deposit Amount"#, .caseInsensitive)),
        (.balance, RE(#"^Balance"#, .caseInsensitive)),
      ],
      minHits: 5))
  })

let hdfcCard = Adapter(
  id: "card.hdfc",
  label: "HDFC Bank credit card statement",
  kind: "card",
  institution: "HDFC Bank",
  detect: { doc in
    adapterScore(doc, RE(#"HDFC BANK"#, .caseInsensitive), [
      RE(#"Credit Card"#, .caseInsensitive),
      RE(#"Total Dues"#, .caseInsensitive),
      RE(#"Minimum Amount Due"#, .caseInsensitive),
      RE(#"Payment Due Date"#, .caseInsensitive),
      RE(#"Domestic Transactions"#, .caseInsensitive),
    ])
  },
  parse: { doc in
    parseCard(doc, CardOptions(
      adapter: "card.hdfc",
      institution: "HDFC Bank",
      labels: CardLabels(
        totalDue: RE(#"^Total Dues$"#, .caseInsensitive),
        minDue: RE(#"^Minimum Amount Due$"#, .caseInsensitive),
        dueDate: RE(#"^Payment Due Date$"#, .caseInsensitive),
        statementDate: RE(#"^Statement Date$"#, .caseInsensitive),
        limit: RE(#"^Credit Limit$"#, .caseInsensitive)),
      startRe: RE(#"Domestic Transactions|International Transactions"#, .caseInsensitive),
      endRe: RE(#"Reward Points Summary|Important Information"#, .caseInsensitive)))
  })

let sbiCard = Adapter(
  id: "card.sbi",
  label: "SBI Card statement",
  kind: "card",
  institution: "SBI Card",
  detect: { doc in
    adapterScore(doc, RE(#"SBI Card"#, .caseInsensitive), [
      RE(#"Total Amount Due"#, .caseInsensitive),
      RE(#"Minimum Amount Due"#, .caseInsensitive),
      RE(#"Payment Due Date"#, .caseInsensitive),
      RE(#"Transactions for"#, .caseInsensitive),
      RE(#"Statement Date"#, .caseInsensitive),
    ])
  },
  parse: { doc in
    parseCard(doc, CardOptions(
      adapter: "card.sbi",
      institution: "SBI Card",
      labels: CardLabels(
        totalDue: RE(#"Total Amount Due"#, .caseInsensitive),
        minDue: RE(#"Minimum Amount Due"#, .caseInsensitive),
        dueDate: RE(#"Payment Due Date"#, .caseInsensitive),
        statementDate: RE(#"Statement Date"#, .caseInsensitive),
        limit: RE(#"Credit Limit"#, .caseInsensitive)),
      startRe: RE(#"Transactions for"#, .caseInsensitive),
      endRe: RE(#"Reward Summary|Important Messages"#, .caseInsensitive)))
  })

private let cardSignals = [
  RE(#"Min(imum)?\.? (Amount )?Due"#, .caseInsensitive),
  RE(#"Total (Amount )?Due|Total Dues|Total Outstanding"#, .caseInsensitive),
  RE(#"(Payment )?Due Date"#, .caseInsensitive),
  RE(#"Credit Limit|Card (No|Number)"#, .caseInsensitive),
]

private func institutionGuess(_ doc: TextDoc, fallback: String) -> String {
  guard let match = findText(doc, RE(#"\b([A-Z][A-Za-z&]+(?: [A-Z][A-Za-z&]+){0,3} (?:Bank|Card|Cards))\b"#)),
        let name = group(match, 1) else { return fallback }
  return String(name.prefix(60))
}

let genericBank = Adapter(
  id: "bank.generic",
  label: "Bank statement (generic layout)",
  kind: "bank",
  institution: "Bank",
  detect: { doc in
    let text = docText(doc)
    let cardish = cardSignals.filter { $0.test(text) }.count
    let hits = [
      RE(#"\b(Date|Txn Date|Tran Date)\b"#, .caseInsensitive),
      RE(#"(Narration|Description|Particulars|Remarks|Details)"#, .caseInsensitive),
      RE(#"(Withdrawal|Debit|Dr\b)"#, .caseInsensitive),
      RE(#"(Deposit|Credit|Cr\b)"#, .caseInsensitive),
      RE(#"Balance"#, .caseInsensitive),
    ].filter { $0.test(text) }.count
    return cardish >= 2 ? 0.1 : 0.15 + 0.06 * Double(hits)
  },
  parse: { doc in
    parseBank(doc, BankOptions(
      adapter: "bank.generic",
      institution: institutionGuess(doc, fallback: "Bank"),
      spec: [
        (.date, RE(#"^(Date|Txn\.? Date|Tran(saction)? Date|Posting Date)$"#, .caseInsensitive)),
        (.valueDate, RE(#"^Value (Date|Dt)$"#, .caseInsensitive)),
        (.narration, RE(#"^(Narration|Description|Particulars|Remarks|Transaction (Details|Remarks|Description)|Details)$"#, .caseInsensitive)),
        (.ref, RE(#"^(Chq|Cheque|Ref)"#, .caseInsensitive)),
        (.debit, RE(#"^(Withdrawals?( Amt\.?| Amount.*)?|Debits?( Amount.*)?|Dr\.?)$"#, .caseInsensitive)),
        (.credit, RE(#"^(Deposits?( Amt\.?| Amount.*)?|Credits?( Amount.*)?|Cr\.?)$"#, .caseInsensitive)),
        (.amount, RE(#"^Amount( \(.*\))?$"#, .caseInsensitive)),
        (.balance, RE(#"^(Closing )?Balance( \(.*\))?$"#, .caseInsensitive)),
      ],
      minHits: 3))
  })

let genericCard = Adapter(
  id: "card.generic",
  label: "Credit card statement (generic layout)",
  kind: "card",
  institution: "Card",
  detect: { doc in
    let hits = cardSignals.filter { $0.test(docText(doc)) }.count
    return hits >= 2 ? 0.2 + 0.07 * Double(hits) : 0
  },
  parse: { doc in
    parseCard(doc, CardOptions(
      adapter: "card.generic",
      institution: institutionGuess(doc, fallback: "Credit Card"),
      labels: CardLabels(
        totalDue: RE(#"Total (Amount )?Due|Total Dues|Total Outstanding"#, .caseInsensitive),
        minDue: RE(#"Min(imum)?\.? (Amount )?Due"#, .caseInsensitive),
        dueDate: RE(#"(Payment )?Due Date"#, .caseInsensitive),
        statementDate: RE(#"Statement Date|Bill Date"#, .caseInsensitive),
        limit: RE(#"Credit Limit"#, .caseInsensitive))))
  })

private let casNumber = #"\(?-?[\d,]+\.\d+\)?"#
private let casTxn = RE(#"^(?:(\d{2}-[A-Za-z]{3}-\d{4}))\s+(.+?)\s+(\#(casNumber))\s+(\#(casNumber))\s+(\#(casNumber))\s+(\#(casNumber))$"#)
private let casTax = RE(#"^(\d{2}-[A-Za-z]{3}-\d{4})\s+\*{2,}.*\*{2,}"#)
private let casFolio = RE(#"Folio\s*No\s*:\s*([0-9A-Za-z/ ]+?)(?:\s{2,}|\s+PAN|\s+KYC|$)"#, .caseInsensitive)
private let casScheme = RE(#"^(?:[A-Z0-9]{2,8}-)?(.+?)(?:\s*\(\s*(?:Advisor|formerly)[^)]*\))?\s*(?:-?\s*ISIN\s*:\s*([A-Z0-9]{12}))?\s*(?:\(?\s*Registrar\s*:\s*(CAMS|KFINTECH|KARVY)\s*\)?)?$"#, .caseInsensitive)
private let casClose = RE(#"Closing Unit Balance\s*:?\s*([\d,]+\.\d+)"#, .caseInsensitive)
private let casNav = RE(#"NAV on\s*(\d{2}-[A-Za-z]{3}-\d{4})\s*:?\s*INR\s*([\d,]+\.\d+)"#, .caseInsensitive)
private let casCost = RE(#"(?:Total )?Cost Value\s*:?\s*(?:INR\s*)?([\d,]+\.\d{2})"#, .caseInsensitive)
private let casMarket = RE(#"Market Value on\s*\d{2}-[A-Za-z]{3}-\d{4}\s*:?\s*INR\s*([\d,]+\.\d{2})"#, .caseInsensitive)
private let casPeriod = RE(#"(\d{2}-[A-Za-z]{3}-\d{4})\s+To\s+(\d{2}-[A-Za-z]{3}-\d{4})"#, .caseInsensitive)
private let casAmc = RE(#"^[A-Za-z0-9&.' ]+ Mutual Fund$"#, .caseInsensitive)
private let casRegistrarLine = RE(#"Registrar\s*:"#, .caseInsensitive)
private let casSip = RE(#"systematic|\bSIP\b"#, .caseInsensitive)
private let wrapped = RE(#"^\(.*\)$"#)

private struct CasTxn {
  var date: String
  var desc: String
  var amount: Int
  var units: Double
  var nav: Double
}

private struct CasScheme {
  var amc: String
  var folio: String
  var scheme: String
  var isin: String?
  var registrar: String
  var txns: [CasTxn] = []
  var units: Double?
  var nav: Double?
  var navDate: String?
  var cost: Int?
  var market: Int?
}

private func signedNumber(_ raw: String) -> Double {
  let negative = wrapped.test(raw) || raw.hasPrefix("-")
  let number = parseNumber(raw.replacingOccurrences(of: "[()]", with: "", options: .regularExpression).replacingOccurrences(of: #"^-"#, with: "", options: .regularExpression)) ?? 0
  return negative ? -number : number
}

private func parseCasText(_ doc: TextDoc) -> (schemes: [CasScheme], periodFrom: String?, periodTo: String?) {
  let lines = doc.lines.map {
    $0.text.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }
  var schemes: [CasScheme] = []
  var amc = ""
  var folio = ""
  var current: Int?
  var periodFrom: String?
  var periodTo: String?
  for index in lines.indices {
    let text = lines[index]
    if periodTo == nil, let match = casPeriod.match(text) {
      periodFrom = group(match, 1).flatMap(parseDate)
      periodTo = group(match, 2).flatMap(parseDate)
      continue
    }
    if casAmc.test(text) {
      amc = text
      continue
    }
    if let match = casFolio.match(text), let found = group(match, 1) {
      folio = found.trimmingCharacters(in: .whitespacesAndNewlines)
      current = nil
      continue
    }
    if !folio.isEmpty, current == nil, casRegistrarLine.test(text) {
      let match = casScheme.match(text)
      let registrar = (group(match, 3) ?? "").uppercased()
      let scheme = (group(match, 1) ?? text).replacingOccurrences(of: #"\s*-\s*$"#, with: "", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
      let named = amc.replacingOccurrences(of: #" Mutual Fund$"#, with: "", options: [.regularExpression, .caseInsensitive])
        .trimmingCharacters(in: .whitespacesAndNewlines)
      schemes.append(CasScheme(
        amc: named.isEmpty ? "Mutual Fund" : named,
        folio: folio,
        scheme: String(scheme.prefix(120)),
        isin: group(match, 2),
        registrar: registrar == "CAMS" ? "CAMS" : (registrar.isEmpty ? "Unknown" : "KFintech")))
      current = schemes.count - 1
      continue
    }
    guard let cursor = current else { continue }
    if casTax.test(text) { continue }
    if let match = casTxn.match(text), let date = group(match, 1).flatMap(parseDate) {
      let rawAmount = group(match, 3) ?? ""
      let amount = parseAmount(rawAmount.replacingOccurrences(of: "[()]", with: "", options: .regularExpression)) ?? 0
      let units = signedNumber(group(match, 4) ?? "")
      let negative = units < 0 || rawAmount.hasPrefix("(")
      schemes[cursor].txns.append(CasTxn(
        date: date,
        desc: group(match, 2) ?? "",
        amount: negative ? -abs(amount) : abs(amount),
        units: units,
        nav: signedNumber(group(match, 5) ?? "")))
      continue
    }
    if let match = casClose.match(text), let units = group(match, 1).flatMap(parseNumber) {
      let block = "\(text) \(index + 1 < lines.count ? lines[index + 1] : "")"
      schemes[cursor].units = units
      if let nav = casNav.match(block) {
        schemes[cursor].navDate = group(nav, 1).flatMap(parseDate)
        schemes[cursor].nav = group(nav, 2).flatMap(parseNumber)
      }
      if let cost = casCost.match(block) { schemes[cursor].cost = group(cost, 1).flatMap(parseAmount) }
      if let market = casMarket.match(block) { schemes[cursor].market = group(market, 1).flatMap(parseAmount) }
      current = nil
    }
  }
  return (schemes, periodFrom, periodTo)
}

let cas = Adapter(
  id: "cas.cams-kfintech",
  label: "Mutual fund CAS (CAMS / KFintech)",
  kind: "cas",
  institution: "CAMS / KFintech",
  detect: { doc in
    let text = docText(doc)
    guard RE(#"Consolidated Account Statement"#, .caseInsensitive).test(text) else { return 0 }
    let hits = [
      RE(#"Folio No"#, .caseInsensitive),
      RE(#"Registrar\s*:\s*(CAMS|KFINTECH|KARVY)"#, .caseInsensitive),
      RE(#"Closing Unit Balance"#, .caseInsensitive),
      RE(#"NAV on"#, .caseInsensitive),
      RE(#"Market Value"#, .caseInsensitive),
    ].filter { $0.test(text) }.count
    return 0.5 + 0.1 * Double(hits)
  },
  parse: { doc in
    let parsed = parseCasText(doc)
    var accounts: [ParseAccount] = []
    var transactions: [ParseTransaction] = []
    var sips: [ParseSip] = []
    var holdings: [Holding] = []
    var warnings: [String] = []
    if parsed.schemes.isEmpty { warnings.append("No schemes found. Please use the *detailed* CAS (not the summary).") }
    for scheme in parsed.schemes {
      let folioMask = last4(scheme.folio.split(separator: "/").first.map(String.init)) ?? last4(scheme.folio) ?? "XXXX"
      let digits = scheme.folio.replacingOccurrences(of: "\\D", with: "", options: .regularExpression)
      let accountId = stableId("acc", "cas", digits, scheme.isin ?? scheme.scheme)
      let asOf = scheme.navDate ?? parsed.periodTo ?? scheme.txns.last?.date ?? isoDay()
      let market = scheme.market ?? jsRound((scheme.units ?? 0) * (scheme.nav ?? 0) * 100)
      let cost = scheme.cost ?? scheme.txns.reduce(0) { $0 + $1.amount }
      accounts.append(ParseAccount(
        id: accountId,
        name: String(scheme.scheme.prefix(80)),
        type: "mutual_fund",
        institution: String("\(scheme.amc) Mutual Fund".prefix(80)),
        mask: folioMask,
        currency: "INR",
        balance: market,
        invested: cost,
        creditLimit: nil,
        statementDay: nil,
        dueDay: nil,
        asOf: asOf,
        source: "cas"))
      holdings.append(Holding(
        accountId: accountId,
        scheme: scheme.scheme,
        amc: scheme.amc,
        registrar: scheme.registrar,
        folioMask: folioMask,
        isin: scheme.isin,
        units: scheme.units ?? 0,
        nav: scheme.nav ?? 0,
        navDate: asOf,
        costValue: cost,
        marketValue: market))
      var seen: [String: Int] = [:]
      for txn in scheme.txns {
        let description = String(txn.desc.prefix(140))
        let key = "\(txn.date)|\(txn.amount)|\(normDesc(description))"
        let occurrence = (seen[key] ?? 0) + 1
        seen[key] = occurrence
        let isSip = casSip.test(txn.desc)
        transactions.append(ParseTransaction(
          id: stableId("txn", accountId, key, occurrence),
          accountId: accountId,
          date: txn.date,
          amount: txn.amount,
          description: description,
          merchant: String(scheme.amc.prefix(80)),
          category: "investments",
          method: isSip ? "autodebit" : "other",
          recurring: isSip,
          tags: [String("units:\(jsNumber(txn.units))".prefix(32)), String("nav:\(jsNumber(txn.nav))".prefix(32))],
          categorisedBy: "rule"))
      }
      let sipTx = scheme.txns.filter { casSip.test($0.desc) && $0.amount > 0 }
      if let last = sipTx.last, let first = sipTx.first {
        let days = sipTx.map { Int($0.date.dropFirst(8).prefix(2)) ?? 1 }
        var unique: [Int] = []
        for day in days where !unique.contains(day) { unique.append(day) }
        let mode = unique.sorted { lhs, rhs in
          days.filter { $0 == lhs }.count > days.filter { $0 == rhs }.count
        }.first ?? 1
        let end = parsed.periodTo ?? last.date
        let gap = gapDays(end, last.date)
        sips.append(ParseSip(
          id: stableId("sip", accountId),
          scheme: String(scheme.scheme.prefix(120)),
          platform: scheme.registrar == "Unknown" ? nil : scheme.registrar,
          amount: last.amount,
          dayOfMonth: min(28, max(1, mode)),
          startDate: first.date,
          stepUpPctYearly: nil,
          status: gap <= 40 ? "active" : "paused",
          accountId: accountId))
      }
    }
    let meta = StatementMeta(
      adapter: "cas.cams-kfintech",
      kind: "cas",
      institution: "CAMS / KFintech",
      accountId: accounts.first?.id ?? "acc_none000",
      periodFrom: parsed.periodFrom,
      periodTo: parsed.periodTo,
      statementDate: nil,
      dueDate: nil,
      totalDue: nil,
      minDue: nil,
      openingBalance: nil,
      closingBalance: nil)
    return ParseBody(accounts: accounts, transactions: transactions, sips: sips, holdings: holdings, meta: [meta], warnings: warnings)
  })

private func gapDays(_ end: String, _ last: String) -> Double {
  guard let endDate = utcDate(end), let lastDate = utcDate(last) else { return 0 }
  return endDate.timeIntervalSince(lastDate) / 86400
}
