import Foundation

func emptyDataset(now: Date = Date()) -> ParseDataset {
  ParseDataset(
    schemaVersion: "0.1.0",
    generatedAt: isoTimestamp(now),
    synthetic: false,
    notice: nil,
    currency: "INR",
    accounts: [],
    transactions: [],
    sips: [])
}

func mergeResult(_ base: ParseDataset, _ result: ParseResult, now: Date = Date()) -> (dataset: ParseDataset, report: MergeReport) {
  mergeParsed(base, accounts: result.accounts, transactions: result.transactions, sips: result.sips, now: now)
}

func mergeParsed(_ base: ParseDataset, accounts incomingAccounts: [ParseAccount], transactions incomingTransactions: [ParseTransaction], sips incomingSips: [ParseSip], now: Date = Date()) -> (dataset: ParseDataset, report: MergeReport) {
  var accounts = base.accounts
  var report = MergeReport(added: 0, duplicates: 0, accountsAdded: 0, accountsUpdated: 0, sipsUpserted: 0)
  for account in incomingAccounts {
    if let index = accounts.firstIndex(where: { $0.id == account.id }) {
      if account.asOf >= accounts[index].asOf {
        accounts[index] = mergedAccount(accounts[index], account)
        report.accountsUpdated += 1
      }
    } else {
      accounts.append(account)
      report.accountsAdded += 1
    }
  }
  var ids = Set(base.transactions.map(\.id))
  var transactions = base.transactions
  for transaction in incomingTransactions {
    if ids.contains(transaction.id) {
      report.duplicates += 1
      continue
    }
    ids.insert(transaction.id)
    transactions.append(transaction)
    report.added += 1
  }
  transactions.sort { $0.date < $1.date }
  var sips = base.sips
  for sip in incomingSips {
    if let index = sips.firstIndex(where: { $0.id == sip.id }) {
      sips[index] = sip
    } else {
      sips.append(sip)
    }
    report.sipsUpserted += 1
  }
  var dataset = base
  dataset.generatedAt = isoTimestamp(now)
  dataset.synthetic = false
  dataset.accounts = accounts
  dataset.transactions = transactions
  dataset.sips = sips
  return (dataset, report)
}

private func mergedAccount(_ old: ParseAccount, _ new: ParseAccount) -> ParseAccount {
  ParseAccount(
    id: new.id,
    name: new.name,
    type: new.type,
    institution: new.institution,
    mask: new.mask ?? old.mask,
    currency: new.currency,
    balance: new.balance,
    invested: new.invested ?? old.invested,
    creditLimit: new.creditLimit ?? old.creditLimit,
    statementDay: new.statementDay ?? old.statementDay,
    dueDay: new.dueDay ?? old.dueDay,
    asOf: new.asOf,
    source: new.source ?? old.source)
}
