import Foundation

// NSDL / CDSL depository CAS. Demat debit/credit columns are quantities, not money.

private let depositoryNumber = #"(?:INR\s*|Rs\.?\s*|₹\s*)?\(?-?[\d,]+(?:\.\d+)?\)?"#
private let depositoryCell = #"(?:\#(depositoryNumber)|-)"#
private let depositoryWhitespace = RE(#"\s+"#)
private let depositoryFullTitle = RE(#"Consolidated Account Statement"#, .caseInsensitive)
private let depositoryShortTitle = RE(#"^CAS\b"#, [.caseInsensitive, .anchorsMatchLines])
private let depositoryRegistrar = RE(#"Registrar\s*:\s*(CAMS|KFINTECH|KARVY)"#, .caseInsensitive)
private let depositoryClosing = RE(#"Closing Unit Balance"#, .caseInsensitive)
private let depositoryIssuerMark = RE(#"\b(?:NSDL|CDSL)\b|Central Depository"#, .caseInsensitive)
private let depositoryDematMark = RE(#"\bdemat\b|\bBO\s*ID\b|\bDP\s*ID\b"#, .caseInsensitive)
private let depositoryIssuerLine = RE(#"\bNSDL\b|\bCDSL\b|Central Depository"#, .caseInsensitive)
private let depositoryDematAccountWord = RE(#"Demat Account"#, .caseInsensitive)
private let depositoryCdslIssuer = RE(#"CDSL|Central Depository"#, .caseInsensitive)
private let depositoryTotal = RE(#"^Total Portfolio Value\s*:?\s*(\#(depositoryNumber))$"#, .caseInsensitive)
private let depositorySection = RE(#"^(NSDL|CDSL) Demat Account(?:\s.*)?$"#, .caseInsensitive)
private let depositoryFolioHeader = RE(#"^Mutual Fund Units held with.*\(MF Folios\)"#, .caseInsensitive)
private let depositoryDpName = RE(#"^DP Name\s*:\s*(.+)$"#, .caseInsensitive)
private let depositoryDpId = RE(#"\bDP ID\s*:\s*(IN30\d{4,6}|\d{8})\b"#, .caseInsensitive)
private let depositoryClientId = RE(#"\bClient ID\s*:\s*(\d{8})\b"#, .caseInsensitive)
private let depositoryBoId = RE(#"\bBO ID\s*:\s*(\d{16})\b"#, .caseInsensitive)
private let depositoryTransactions = RE(#"^Transactions\b"#, .caseInsensitive)
private let depositoryHoldingsHeader = RE(#"^(?:Equities\b|Mutual Fund Units(?! held with)|ISIN\s+(?:Security|Company))"#, .caseInsensitive)
private let depositoryHoldingRow = RE(#"^([A-Z0-9]{12})\s+(.+?)\s+(\#(depositoryNumber))\s+(\#(depositoryCell))\s+(\#(depositoryCell))\s+(\#(depositoryNumber))\s+(\#(depositoryNumber))$"#)
private let depositoryFolioRow = RE(#"^(.+?)\s+([A-Z0-9]{12})\s+(\d+(?:\s*/\s*\d+)?)\s+(\#(depositoryNumber))\s+(\#(depositoryNumber))\s+(\#(depositoryCell))\s+(\#(depositoryNumber))\s+(\#(depositoryCell))$"#)
private let depositoryMovementRow = RE(#"^(\d{2}-(?:[A-Za-z]{3}|\d{2})-\d{4})\s+([A-Z0-9]{12})\s+(.+?)\s+(\#(depositoryCell))\s+(\#(depositoryCell))\s+(\#(depositoryNumber))$"#)
private let depositoryQuantityPrefix = RE(#"^(?:INR|Rs\.?|₹)\s*"#, .caseInsensitive)
private let depositoryDpToken = RE(#"\bIN30\d{4,6}\b"#, .caseInsensitive)
private let depositoryLongDigits = RE(#"\d{5,}"#)
private let depositoryNsdlDp = RE(#"^IN30\d{4,6}$"#, .caseInsensitive)
private let depositoryCdslDp = RE(#"^\d{8}$"#)

private struct DepositoryHolding {
  var isin: String
  var name: String
  var units: Double
  var price: Double
  var value: Int
}

private struct DepositoryFolio {
  var scheme: String
  var isin: String
  var folio: String
  var units: Double
  var nav: Double
  var cost: Int?
  var value: Int
}

private struct DepositoryDemat {
  var issuer: String
  var dp = ""
  var dpId = ""
  var clientId = ""
  var boId = ""
  var holdings: [DepositoryHolding] = []
}

private enum DepositoryTable {
  case holdings
  case movements
  case folios
}

private func depositoryQuantity(_ raw: String) -> Double? {
  parseNumber(depositoryQuantityPrefix.replacingFirst(in: raw, with: ""))
}

private func depositorySafeName(_ raw: String) -> String {
  let masked = depositoryDpToken.replacingAll(in: raw) { _ in "XXXX" }
  return depositoryLongDigits.replacingAll(in: masked) { digits in
    "XXXX\(last4(digits) ?? "")"
  }.trimmingCharacters(in: .whitespacesAndNewlines)
}

private func collapsedDepositoryLine(_ text: String) -> String {
  depositoryWhitespace.replacingAll(in: text) { _ in " " }.trimmingCharacters(in: .whitespacesAndNewlines)
}

let depositoryCas = Adapter(
  id: "cas.depository",
  label: "Depository CAS (NSDL / CDSL)",
  kind: "cas",
  institution: "NSDL / CDSL",
  detect: { doc in
    let text = docText(doc)
    let fullTitle = depositoryFullTitle.test(text)
    if !fullTitle && !depositoryShortTitle.test(text) { return 0 }
    if depositoryRegistrar.test(text) && depositoryClosing.test(text) { return 0 }
    return depositoryIssuerMark.test(text) && depositoryDematMark.test(text) ? (fullTitle ? 0.95 : 0.85) : 0
  },
  parse: { doc in
    let period = findPeriod(doc)
    let lines = doc.lines.map { collapsedDepositoryLine($0.text) }
    let issuerLine = lines.first { depositoryIssuerLine.test($0) && !depositoryDematAccountWord.test($0) } ?? ""
    let issuer = depositoryCdslIssuer.test(issuerLine) ? "cdsl" : "nsdl"
    var demats: [DepositoryDemat] = []
    var folios: [DepositoryFolio] = []
    var current: Int?
    var mode: DepositoryTable?
    var totalValue: Int?
    var quantityTransactionCount = 0
    for text in lines {
      if let total = depositoryTotal.match(text) {
        totalValue = group(total, 1).flatMap(parseAmount)
        continue
      }
      if let section = depositorySection.match(text), let name = group(section, 1) {
        demats.append(DepositoryDemat(issuer: name.uppercased()))
        current = demats.count - 1
        mode = .holdings
        continue
      }
      if depositoryFolioHeader.test(text) {
        current = nil
        mode = .folios
        continue
      }
      if let index = current {
        if let dp = depositoryDpName.match(text), let name = group(dp, 1) {
          demats[index].dp = depositorySafeName(name)
          continue
        }
        let dpId = depositoryDpId.match(text)
        let clientId = depositoryClientId.match(text)
        let boId = depositoryBoId.match(text)
        if let found = group(dpId, 1) { demats[index].dpId = found }
        if let found = group(clientId, 1) { demats[index].clientId = found }
        if let found = group(boId, 1) { demats[index].boId = found }
        if dpId != nil || clientId != nil || boId != nil { continue }
        if depositoryTransactions.test(text) {
          mode = .movements
          continue
        }
        if depositoryHoldingsHeader.test(text) {
          mode = .holdings
          continue
        }
        if mode == .movements {
          if let row = depositoryMovementRow.match(text),
             group(row, 1).flatMap(parseDate) != nil,
             group(row, 6).flatMap(depositoryQuantity) != nil {
            quantityTransactionCount += 1
          }
          continue
        }
        if mode == .holdings,
           let row = depositoryHoldingRow.match(text),
           let isin = group(row, 1),
           let name = group(row, 2),
           let units = group(row, 3).flatMap(depositoryQuantity),
           let price = group(row, 6).flatMap(depositoryQuantity),
           let value = group(row, 7).flatMap(parseAmount) {
          demats[index].holdings.append(DepositoryHolding(
            isin: isin,
            name: depositorySafeName(name),
            units: units,
            price: price,
            value: value))
        }
      } else if mode == .folios,
                let row = depositoryFolioRow.match(text),
                let scheme = group(row, 1),
                let isin = group(row, 2),
                let folio = group(row, 3),
                let units = group(row, 4).flatMap(depositoryQuantity),
                let nav = group(row, 5).flatMap(depositoryQuantity),
                let value = group(row, 7).flatMap(parseAmount) {
        folios.append(DepositoryFolio(
          scheme: depositorySafeName(scheme),
          isin: isin,
          folio: folio.replacingOccurrences(of: #"\s"#, with: "", options: .regularExpression),
          units: units,
          nav: nav,
          cost: group(row, 6).flatMap(parseAmount),
          value: value))
      }
    }
    var accounts: [ParseAccount] = []
    var accountAliases: [String: String] = [:]
    var holdings: [Holding] = []
    var warnings: [String] = []
    let asOf = period.to ?? "1970-01-01"
    if period.to == nil {
      warnings.append("Statement period end not found; please review the valuation date.")
    }
    for demat in demats {
      let identifier = demat.boId.isEmpty ? demat.dpId + demat.clientId : demat.boId
      let valid = demat.issuer == "NSDL"
        ? depositoryNsdlDp.test(demat.dpId) && !demat.clientId.isEmpty
        : !demat.boId.isEmpty || (depositoryCdslDp.test(demat.dpId) && !demat.clientId.isEmpty)
      if !valid {
        warnings.append("Demat account identifier not found; account skipped.")
        continue
      }
      let mask = last4(demat.boId.isEmpty ? demat.clientId : demat.boId) ?? "XXXX"
      let institution = String("\(demat.issuer)\(demat.dp.isEmpty ? "" : " / \(demat.dp)")".prefix(80))
      let accountId = stableId("acc", "cas.depository", demat.issuer, identifier)
      accounts.append(ParseAccount(
        id: accountId,
        name: "\(demat.issuer) Demat \u{2022}\u{2022}\(mask)",
        type: "stocks",
        institution: institution,
        mask: mask,
        currency: "INR",
        balance: demat.holdings.reduce(0) { $0 + $1.value },
        invested: nil,
        creditLimit: nil,
        statementDay: nil,
        dueDay: nil,
        asOf: asOf,
        source: "cas"))
      for holding in demat.holdings {
        holdings.append(Holding(
          accountId: accountId,
          scheme: holding.name,
          amc: institution,
          registrar: "Unknown",
          folioMask: mask,
          isin: holding.isin,
          units: holding.units,
          nav: holding.price,
          navDate: asOf,
          costValue: 0,
          marketValue: holding.value))
      }
    }
    for folio in folios {
      let head = folio.folio.components(separatedBy: "/").first ?? ""
      let mask = last4(head) ?? "XXXX"
      guard let identity = casFolioIdentity(folio.folio, folio.isin) else { continue }
      let accountId = identity.canonical
      accountAliases[identity.legacy] = identity.canonical
      let institution = "\(issuer.uppercased()) / Mutual Fund Folios"
      accounts.append(ParseAccount(
        id: accountId,
        name: String(folio.scheme.prefix(80)),
        type: "mutual_fund",
        institution: institution,
        mask: mask,
        currency: "INR",
        balance: folio.value,
        invested: folio.cost,
        creditLimit: nil,
        statementDay: nil,
        dueDay: nil,
        asOf: asOf,
        source: "cas"))
      holdings.append(Holding(
        accountId: accountId,
        scheme: folio.scheme,
        amc: "Mutual Fund",
        registrar: "Unknown",
        folioMask: mask,
        isin: folio.isin,
        units: folio.units,
        nav: folio.nav,
        navDate: asOf,
        costValue: folio.cost ?? 0,
        marketValue: folio.value))
    }
    if holdings.isEmpty {
      warnings.append("No holdings found in the depository CAS.")
    }
    let meta = StatementMeta(
      adapter: "cas.depository",
      kind: "cas",
      institution: issuer.uppercased(),
      accountId: accounts.first?.id ?? "acc_none000",
      periodFrom: period.from,
      periodTo: period.to,
      statementDate: nil,
      dueDate: nil,
      totalDue: nil,
      minDue: nil,
      openingBalance: nil,
      closingBalance: nil,
      issuer: issuer,
      totalValue: totalValue ?? accounts.reduce(0) { $0 + $1.balance },
      quantityTransactionCount: quantityTransactionCount)
    return ParseBody(accounts: accounts, transactions: [], sips: [], holdings: holdings, meta: [meta], warnings: warnings, accountAliases: accountAliases)
  })
