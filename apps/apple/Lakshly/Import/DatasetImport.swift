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
    debts: existing?.debts,
    sips: merged.dataset.sips.map(appSip),
    rewards: existing?.rewards)
  return (dataset, merged.report)
}

extension DataStore {
  @discardableResult
  func importParsed(_ result: ParseResult, now: Date = Date()) -> MergeReport {
    let merged = datasetByMerging(dataset, result, now: now)
    dataset = merged.dataset
    save()
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
