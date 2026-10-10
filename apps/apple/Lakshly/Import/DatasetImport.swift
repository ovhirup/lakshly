import Foundation

func datasetByMerging(_ existing: Dataset?, _ result: ParseResult, now: Date = Date()) -> (dataset: Dataset, report: MergeReport) {
  let base = existing.map(parseDataset(from:)) ?? emptyDataset(now: now)
  let merged = mergeResult(base, result, now: now)
  let dataset = Dataset(
    schemaVersion: existing?.schemaVersion ?? merged.dataset.schemaVersion,
    generatedAt: merged.dataset.generatedAt,
    synthetic: false,
    notice: existing?.notice,
    currency: existing?.currency ?? merged.dataset.currency,
    accounts: merged.dataset.accounts.map(appAccount),
    transactions: merged.dataset.transactions.map(appTransaction),
    budgets: existing?.budgets,
    debts: existing?.debts?.map { debt in
      Debt(id: debt.id, name: debt.name, kind: debt.kind, lender: debt.lender, principal: debt.principal,
           outstanding: debt.outstanding, annualRatePct: debt.annualRatePct, emi: debt.emi, startDate: debt.startDate,
           tenureMonths: debt.tenureMonths, accountId: debt.accountId.map { merged.accountAliases[$0] ?? $0 })
    },
    sips: merged.dataset.sips.map(appSip),
    rewards: existing?.rewards?.map { reward in
      Reward(id: reward.id, program: reward.program, kind: reward.kind, balance: reward.balance,
             valuePerUnitPaise: reward.valuePerUnitPaise, expiresOn: reward.expiresOn,
             accountId: reward.accountId.map { merged.accountAliases[$0] ?? $0 }, asOf: reward.asOf)
    })
  return (dataset, merged.report)
}

extension DataStore {
  @discardableResult
  func importParsed(_ result: ParseResult, fileName: String = "statement", contentHash: String? = nil, fileSize: Int? = nil, now: Date = Date()) -> MergeReport {
    let oldDataset = userDataset
    let oldImports = imports
    let oldSource = source
    let oldMonth = selectedMonth
    let merged = datasetByMerging(userDataset, result, now: now)
    let trimmed = fileName.trimmingCharacters(in: .whitespacesAndNewlines)
    let file = String((trimmed.isEmpty ? "statement" : trimmed).prefix(120))
    imports.append(
      ImportLogEntry(
        id: nextImportID(now: now),
        at: isoTimestamp(now),
        file: file,
        adapter: result.adapter,
        accountIds: result.accounts.map(\.id),
        added: merged.report.added,
        duplicates: merged.report.duplicates,
        confidence: result.confidence, contentHash: contentHash, fileSize: fileSize))
    adoptUserDataset(merged.dataset)
    if error != nil { restoreImportState(dataset: oldDataset, imports: oldImports, source: oldSource, month: oldMonth) }
    return merged.report
  }
}

private func parseDataset(from dataset: Dataset) -> ParseDataset {
  ParseDataset(
    schemaVersion: dataset.schemaVersion,
    generatedAt: dataset.generatedAt,
    synthetic: dataset.synthetic ?? false,
    notice: dataset.notice,
    currency: dataset.currency,
    accounts: dataset.accounts.map(parseAccount),
    transactions: dataset.transactions.map(parseTransaction),
    sips: (dataset.sips ?? []).map(parseSip))
}

private func parseAccount(_ account: Account) -> ParseAccount {
  ParseAccount(
    id: account.id, name: account.name, type: account.type, institution: account.institution, mask: account.mask,
    currency: account.currency, balance: Int(account.balance), invested: account.invested.map(Int.init),
    creditLimit: account.creditLimit.map(Int.init), statementDay: account.statementDay, dueDay: account.dueDay,
    asOf: account.asOf, source: account.source)
}

private func parseTransaction(_ transaction: Transaction) -> ParseTransaction {
  ParseTransaction(
    id: transaction.id, accountId: transaction.accountId, date: transaction.date, amount: Int(transaction.amount),
    description: transaction.description, merchant: transaction.merchant, category: transaction.category,
    method: transaction.method, recurring: transaction.recurring, tags: transaction.tags,
    categorisedBy: transaction.categorisedBy)
}

private func parseSip(_ sip: SIP) -> ParseSip {
  ParseSip(
    id: sip.id, scheme: sip.scheme, platform: sip.platform, amount: Int(sip.amount), dayOfMonth: sip.dayOfMonth,
    startDate: sip.startDate, stepUpPctYearly: sip.stepUpPctYearly, status: sip.status, accountId: sip.accountId)
}

private func appAccount(_ account: ParseAccount) -> Account {
  Account(
    id: account.id, name: account.name, type: account.type, institution: account.institution, mask: account.mask,
    currency: account.currency, balance: Int64(account.balance), invested: account.invested.map(Int64.init),
    creditLimit: account.creditLimit.map(Int64.init), statementDay: account.statementDay, dueDay: account.dueDay,
    asOf: account.asOf, source: account.source)
}

private func appTransaction(_ transaction: ParseTransaction) -> Transaction {
  Transaction(
    id: transaction.id, accountId: transaction.accountId, date: transaction.date, amount: Int64(transaction.amount),
    description: transaction.description, merchant: transaction.merchant, category: transaction.category,
    method: transaction.method, recurring: transaction.recurring, tags: transaction.tags,
    categorisedBy: transaction.categorisedBy)
}

private func appSip(_ sip: ParseSip) -> SIP {
  SIP(
    id: sip.id, scheme: sip.scheme, platform: sip.platform, amount: Int64(sip.amount), dayOfMonth: sip.dayOfMonth,
    startDate: sip.startDate, stepUpPctYearly: sip.stepUpPctYearly, status: sip.status, accountId: sip.accountId)
}
