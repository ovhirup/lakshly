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

func mergeResult(_ base: ParseDataset, _ result: ParseResult, now: Date = Date()) -> (dataset: ParseDataset, report: MergeReport, accountAliases: [String: String]) {
  mergeParsed(base, accounts: result.accounts, transactions: result.transactions, sips: result.sips, accountAliases: result.accountAliases, now: now)
}

func mergeParsed(_ base: ParseDataset, accounts incomingAccounts: [ParseAccount], transactions incomingTransactions: [ParseTransaction], sips incomingSips: [ParseSip], accountAliases proposed: [String: String] = [:], now: Date = Date()) -> (dataset: ParseDataset, report: MergeReport, accountAliases: [String: String]) {
  var aliases: [String: String] = [:]
  for (source, target) in proposed {
    guard source != target, proposed[target] == nil, !proposed.values.contains(source),
          incomingAccounts.contains(where: { $0.id == target && $0.type == "mutual_fund" }),
          !base.accounts.contains(where: { $0.id == source && $0.type != "mutual_fund" }) else { continue }
    aliases[source] = target
  }
  func remapTransaction(_ value: ParseTransaction) -> ParseTransaction {
    var result = value
    result.accountId = aliases[value.accountId] ?? value.accountId
    return result
  }
  func remapSip(_ value: ParseSip) -> ParseSip {
    var result = value
    if let id = value.accountId { result.accountId = aliases[id] ?? id }
    return result
  }
  var accounts: [ParseAccount] = []
  var originalCanonical = Set<String>()
  for original in base.accounts {
    var account = original
    account.id = aliases[original.id] ?? original.id
    if let index = accounts.firstIndex(where: { $0.id == account.id }) {
      let old = accounts[index]
      let incomingWins = account.asOf > old.asOf || (account.asOf == old.asOf && original.id == account.id && !originalCanonical.contains(account.id))
      accounts[index] = incomingWins ? mergedAccount(old, account) : mergedAccount(account, old)
    } else { accounts.append(account) }
    if original.id == account.id { originalCanonical.insert(account.id) }
  }
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
  var transactions = base.transactions.map(remapTransaction)
  for transaction in incomingTransactions {
    if ids.contains(transaction.id) {
      report.duplicates += 1
      continue
    }
    ids.insert(transaction.id)
    transactions.append(remapTransaction(transaction))
    report.added += 1
  }
  transactions.sort { $0.date < $1.date }
  var sips = base.sips.map(remapSip)
  for sip in incomingSips {
    if let index = sips.firstIndex(where: { $0.id == sip.id }) {
      sips[index] = remapSip(sip)
    } else {
      sips.append(remapSip(sip))
    }
    report.sipsUpserted += 1
  }
  var dataset = base
  dataset.generatedAt = isoTimestamp(now)
  dataset.synthetic = false
  dataset.accounts = accounts
  dataset.transactions = transactions
  dataset.sips = sips
  return (dataset, report, aliases)
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
