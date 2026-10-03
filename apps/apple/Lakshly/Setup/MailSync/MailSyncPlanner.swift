import Foundation

// Pure query planning and a synthetic mailbox rehearsal. No network calls.

enum SyncProvider: String, Codable, Equatable {
  case gmail, graph, imap
}

enum MailSyncPlanError: Error, Equatable {
  case senderRequired
  case firstRunNeedsTimestamp
}

struct SyncQuery: Codable, Equatable {
  var key: String
  var q: String?
  var search: String?
}

struct SyntheticAttachment: Codable, Equatable {
  var name: String
  var type: String
  var encrypted: Bool?
}

struct SyntheticMessage: Codable, Equatable {
  var id: String
  var date: String
  var from: String
  var subject: String
  var attachments: [SyntheticAttachment]?
}

struct ReadLogEntry: Codable, Equatable {
  var messageId: String
  var date: String
  var from: String
  var subject: String
  var matched: [String]
  var route: String
  var outcome: String
  var passwordHints: [String]?
}

struct SyncSimulation: Equatable {
  var queries: [SyncQuery]
  var fetched: [String]
  var readLog: [ReadLogEntry]
  var neverFetched: [String]
  var cursors: [String: String]
  var seen: [String]
}

func gmailApiQuery(_ source: CatalogSource, _ search: CatalogSearch, afterEpoch: Int64? = nil) -> String {
  let query = gmailQuery(source, search)
  guard let afterEpoch, let range = query.range(of: #" newer_than:[^ ]+$"#, options: .regularExpression) else { return query }
  return query.replacingCharacters(in: range, with: " after:\(afterEpoch)")
}

func graphSearch(_ source: CatalogSource, _ search: CatalogSearch, since: String? = nil) -> String {
  var query = outlookQuery(source, search)
  if let range = query.range(of: "hasattachments:yes") {
    query.replaceSubrange(range, with: "hasattachments:true")
  }
  if let since { query += " AND received>=\(since)" }
  return query
}

func imapSearch(_ source: CatalogSource, since: String) throws -> String {
  let months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  let date = SetupISO.ymd(since)
  let senders = froms(source)
  if senders.isEmpty { throw MailSyncPlanError.senderRequired }
  var expr = "FROM \"\(senders[0])\""
  for sender in senders.dropFirst() { expr = "OR \(expr) FROM \"\(sender)\"" }
  return "UID SEARCH SINCE \(String(format: "%02d", date.d))-\(months[date.m - 1])-\(date.y) \(expr)"
}

func senderAllowed(_ source: CatalogSource, _ from: String) -> Bool {
  let sender = setupLower(from)
  let domain = sender.split(separator: "@", omittingEmptySubsequences: false).last.map(String.init) ?? ""
  func matches(_ pattern: String) -> Bool {
    let needle = setupLower(pattern)
    return domain == needle || domain.hasSuffix("." + needle)
  }
  if source.senders.excludeDomains.contains(where: matches) { return false }
  return source.senders.addresses.contains { setupLower($0) == sender } || source.senders.domains.contains(where: matches)
}

func routeFor(_ searchId: String) -> String {
  switch searchId {
  case "alerts": return "email.alert"
  case "statements": return "pdf.statement"
  case "cas": return "pdf.cas"
  default: return "email.receipt"
  }
}

func subtractDaysWithOffset(_ now: String, _ days: Int) -> String {
  SetupISO.subtractDaysWithOffset(now, days: days)
}

func planQueries(
  _ picked: [String],
  cursors: [String: String],
  now: String? = nil,
  provider: SyncProvider = .gmail
) throws -> [SyncQuery] {
  if provider != .gmail && (now == nil || now?.isEmpty == true) {
    throw MailSyncPlanError.firstRunNeedsTimestamp
  }
  var queries: [SyncQuery] = []
  for id in picked {
    let source = sourceFor(id)
    for search in source.searches {
      let key = "\(source.id)/\(search.id)"
      let cursor = cursors[key]
      if provider == .gmail {
        let epoch: Int64? = {
          guard let cursor, !cursor.isEmpty, let millis = SetupISO.parseInstantMillis(cursor) else { return nil }
          return millis / 1000
        }()
        queries.append(SyncQuery(key: key, q: gmailApiQuery(source, search, afterEpoch: epoch), search: nil))
      } else {
        let since: String
        if let cursor, !cursor.isEmpty {
          since = String(cursor.prefix(10))
        } else {
          let days = 365 * SetupISO.parseIntPrefix(search.window)
          since = String(subtractDaysWithOffset(now!, days).prefix(10))
        }
        let text = provider == .graph ? graphSearch(source, search, since: since) : try imapSearch(source, since: since)
        queries.append(SyncQuery(key: key, q: nil, search: text))
      }
    }
  }
  return queries
}

func runSyncSimulation(
  _ mailbox: [SyntheticMessage],
  picked: [String],
  cursors: [String: String],
  seen: [String],
  now: String,
  provider: SyncProvider = .gmail
) throws -> SyncSimulation {
  let queries = try planQueries(picked, cursors: cursors, now: now, provider: provider)
  var matched: [String: [String]] = [:]
  var nextCursors = cursors
  var seenOrder: [String] = []
  var seenSet = Set<String>()
  for id in seen where seenSet.insert(id).inserted { seenOrder.append(id) }
  for id in picked {
    let source = sourceFor(id)
    for search in source.searches {
      let key = "\(source.id)/\(search.id)"
      let cursor = cursors[key]
      for message in mailbox {
        if !senderAllowed(source, message.from) { continue }
        let subject = setupLower(message.subject)
        let tokenHit = search.subjectAny.contains { subject.contains(setupLower(stripSubjectQuotes($0))) }
        if !tokenHit { continue }
        if search.attachment && (message.attachments?.isEmpty ?? true) { continue }
        if let cursor, !cursor.isEmpty, message.date <= cursor { continue }
        matched[message.id, default: []].append(key)
      }
      nextCursors[key] = subtractDaysWithOffset(now, 1)
    }
  }
  var readLog: [ReadLogEntry] = []
  for message in mailbox.sorted(by: { $0.date < $1.date }) {
    guard let keys = matched[message.id], !seenSet.contains(message.id) else { continue }
    let parts = keys[0].split(separator: "/", omittingEmptySubsequences: false)
    let sourceId = parts.first.map(String.init) ?? ""
    let searchId = parts.dropFirst().first.map(String.init) ?? ""
    let route = routeFor(searchId)
    let outcome: String
    if route.hasPrefix("pdf.") {
      outcome = message.attachments?.first?.encrypted == true ? "awaitingPassword" : "parsed"
    } else if route == "email.alert" {
      outcome = "parsed"
    } else {
      outcome = "enrichOnly"
    }
    readLog.append(ReadLogEntry(
      messageId: message.id,
      date: message.date,
      from: message.from,
      subject: message.subject,
      matched: keys,
      route: route,
      outcome: outcome,
      passwordHints: outcome == "awaitingPassword" ? sourceFor(sourceId).passwordHints : nil
    ))
    if seenSet.insert(message.id).inserted { seenOrder.append(message.id) }
  }
  return SyncSimulation(
    queries: queries,
    fetched: readLog.map(\.messageId),
    readLog: readLog,
    neverFetched: mailbox.filter { matched[$0.id] == nil }.map(\.id).sorted(),
    cursors: nextCursors,
    seen: seenOrder
  )
}
