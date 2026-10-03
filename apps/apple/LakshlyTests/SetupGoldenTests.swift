import XCTest
@testable import Lakshly

final class SetupGoldenTests: XCTestCase {
  private struct ExpectedFile: Decodable {
    var now: String
    var provider: [String: String]
    var outlookOpenUrl: [String: String]
    var gmailUrlNoEmail: String
    var links: [Link]
    var budget: BudgetSuggestion
    var goal: GoalSuggestion
    var goalIfLowCash: GoalSuggestion
    var budgetStarterWhenNoCompleteMonth: String
    var freshnessAtNow: [String: String]
    var checklistBefore: [String: Checklist]
    var checklistAfter: [String: Checklist]
    var events: [SetupEvent]
    var completedAt: String
    var goalsAfter: [SetupGoal]
    var attribution: [String: Attribution]
    var sync: SyncBlock
  }

  private struct Link: Decodable {
    var source: String
    var search: String
    var gmailQuery: String
    var gmailUrl: String
    var outlookQuery: String
  }

  private struct SyncBlock: Decodable {
    struct Run: Decodable {
      var queries: [SyncQuery]
      var fetched: [String]
      var readLog: [ReadLogEntry]
      var neverFetched: [String]?
    }
    struct IMAP: Decodable {
      var generic: String
      var gmailXGmRaw: String
    }
    var first: Run
    var cursorsAfterFirst: [String: String]
    var second: Run
    var graphFirstQueriesHdfcBank: [SyncQuery]
    var graphIncrementalExample: String
    var imapExample: IMAP
  }

  private struct MailboxFile: Decodable {
    var first: [SyntheticMessage]
    var second: [SyntheticMessage]
    var picked: [String]
    var firstSyncAt: String
    var secondSyncAt: String
  }

  private struct TimedAction: Decodable {
    var at: String
    var action: SetupAction
    init(from decoder: Decoder) throws {
      let container = try decoder.container(keyedBy: CodingKeys.self)
      at = try container.decode(String.self, forKey: .at)
      action = try SetupAction(from: decoder)
    }
    private enum CodingKeys: String, CodingKey { case at }
  }

  private struct SessionFile: Decodable {
    var session: Body
    struct Body: Decodable { var actions: [TimedAction] }
  }

  private var expected: ExpectedFile!
  private var dataset: SetupDataset!
  private var state: SetupState!
  private var mailbox: MailboxFile!
  private var today: String!

  override func setUpWithError() throws {
    expected = try load("expected")
    dataset = try load("dataset.after-import")
    state = try load("state.midway")
    mailbox = try load("mailbox.synthetic")
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = try XCTUnwrap(TimeZone(identifier: "Asia/Kolkata"))
    let millis = try XCTUnwrap(SetupISO.parseInstantMillis(expected.now))
    let instant = Date(timeIntervalSince1970: TimeInterval(millis) / 1000)
    today = SetupISO.today(instant: instant, calendar: calendar)
    XCTAssertEqual(today, "2026-10-03")
    XCTAssertEqual(today, SetupISO.todayPrefix(expected.now))
  }

  func testProviderOutlookAndGmailUrl() {
    for (email, provider) in expected.provider {
      XCTAssertEqual(detectProvider(email).rawValue, provider, email)
    }
    for (email, url) in expected.outlookOpenUrl {
      XCTAssertEqual(outlookOpenUrl(email), url, email)
    }
    XCTAssertEqual(gmailUrl("", "from:netflix.com"), expected.gmailUrlNoEmail)
  }

  func testLinksAreByteForByte() {
    let primary = state.email.primary
    for link in expected.links {
      let source = sourceFor(link.source)
      let search = source.searches.first { $0.id == link.search }
      XCTAssertEqual(gmailQuery(source, search!), link.gmailQuery, link.source)
      XCTAssertEqual(gmailUrl(primary, gmailQuery(source, search!)), link.gmailUrl, link.source)
      XCTAssertEqual(outlookQuery(source, search!), link.outlookQuery, link.source)
    }
  }

  func testBudgetIntegerPaise() {
    XCTAssertEqual(suggestBudget(dataset, today: today), expected.budget)
  }

  func testGoalAnnualPayment() {
    XCTAssertEqual(suggestGoal(dataset, today: today), expected.goal)
  }

  func testGoalIfLowCash() {
    var low = dataset!
    var accounts = low.accounts ?? []
    accounts[0].balance = 4_000_000
    low.accounts = accounts
    XCTAssertEqual(suggestGoal(low, today: today), expected.goalIfLowCash)
  }

  func testStarterWithoutCompleteMonth() {
    let partial = SetupDataset(
      transactions: dataset.transactions.filter { $0.date >= "2026-09-10" },
      accounts: dataset.accounts,
      budgets: dataset.budgets,
      goals: dataset.goals
    )
    XCTAssertEqual(suggestBudget(partial, today: today).mode, expected.budgetStarterWhenNoCompleteMonth)
  }

  func testFreshnessAtNow() {
    var actual: [String: String] = [:]
    for source in state.sources { actual[source.catalogId] = freshness(source, today: today).rawValue }
    XCTAssertEqual(actual, expected.freshnessAtNow)
  }

  func testChecklistBeforeWebAndApple() {
    XCTAssertEqual(checklist(state, dataset, .web, today: today), expected.checklistBefore["web"])
    XCTAssertEqual(checklist(state, dataset, .ios, today: today), expected.checklistBefore["ios"])
    XCTAssertEqual(checklist(state, dataset, .macos, today: today), expected.checklistBefore["ios"])
    XCTAssertEqual(expected.checklistBefore["ios"]?.done, 5)
    XCTAssertEqual(expected.checklistBefore["ios"]?.applicable, 10)
  }

  func testReplayCompletesOnceAtBudgetAccept() throws {
    let session = try load(SessionFile.self, name: "state.midway")
    var data = dataset!
    data.goals = []
    var current = state!
    for timed in session.session.actions {
      current = setupReducer(current, timed.action, now: timed.at, dataset: data, platform: .web, today: today)
      if case .acceptBudget(_, let factor) = timed.action {
        data.budgets = suggestBudget(data, today: today, factorPct: factor ?? 95).lines.map {
          SetupBudgetRef(id: $0.id, month: $0.month, category: $0.category, limit: $0.limit, rollover: $0.rollover)
        }
      }
      if case .acceptGoal = timed.action {
        let goal = try XCTUnwrap(goalFromSuggestion(data, today: today, now: timed.at))
        data.goals = [SetupGoalRef(id: goal.id)]
        XCTAssertEqual([goal], expected.goalsAfter)
      }
    }
    XCTAssertEqual(checklist(current, data, .web, today: today), expected.checklistAfter["web"])
    XCTAssertEqual(checklist(current, data, .ios, today: today), expected.checklistAfter["ios"])
    XCTAssertEqual(checklist(current, data, .macos, today: today), expected.checklistAfter["ios"])
    XCTAssertEqual(expected.checklistAfter["ios"]?.done, 9)
    XCTAssertEqual(expected.checklistAfter["ios"]?.applicable, 10)
    XCTAssertEqual(current.events, expected.events)
    XCTAssertEqual(current.completedAt, expected.completedAt)
    let again = setupReducer(current, .start, now: "2026-10-03T11:15:00+05:30", dataset: data, platform: .web, today: today)
    XCTAssertEqual(again.events, expected.events)
    XCTAssertEqual(state.sources[2].status, .todo)
  }

  func testAttribution() {
    for (description, value) in expected.attribution {
      let parts = description.components(separatedBy: " with ")
      let ids = parts[1].dropFirst().dropLast().split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
      XCTAssertEqual(attribute(parts[0], ids), value, description)
    }
  }

  func testSyncFirstSecondAndGraph() throws {
    let cursors: [String: String] = [:]
    let seen: [String] = []
    let first = try runSyncSimulation(mailbox.first, picked: mailbox.picked, cursors: cursors, seen: seen, now: mailbox.firstSyncAt)
    XCTAssertEqual(first.queries, expected.sync.first.queries)
    XCTAssertEqual(first.fetched, expected.sync.first.fetched)
    XCTAssertEqual(first.readLog, expected.sync.first.readLog)
    XCTAssertEqual(first.neverFetched, expected.sync.first.neverFetched)
    XCTAssertEqual(first.cursors, expected.sync.cursorsAfterFirst)
    let second = try runSyncSimulation(
      mailbox.first + mailbox.second,
      picked: mailbox.picked,
      cursors: first.cursors,
      seen: first.seen,
      now: mailbox.secondSyncAt
    )
    XCTAssertEqual(second.queries, expected.sync.second.queries)
    XCTAssertEqual(second.fetched, expected.sync.second.fetched)
    XCTAssertEqual(second.readLog, expected.sync.second.readLog)
    XCTAssertTrue(second.neverFetched.contains("msg_p002"))
    XCTAssertFalse(second.fetched.contains("msg_a002"))
    let graph = try planQueries(["hdfc-bank"], cursors: [:], now: mailbox.firstSyncAt, provider: .graph)
    XCTAssertEqual(graph, expected.sync.graphFirstQueriesHdfcBank)
  }

  func testGraphAndIMAPStrings() throws {
    let source = sourceFor("hdfc-bank")
    let search = source.searches[0]
    XCTAssertEqual(graphSearch(source, search, since: "2026-10-02"), expected.sync.graphIncrementalExample)
    XCTAssertEqual(try imapSearch(source, since: "2026-10-02"), expected.sync.imapExample.generic)
    let raw = "UID SEARCH X-GM-RAW \"\(gmailApiQuery(source, search, afterEpoch: 1_790_920_200))\""
    XCTAssertEqual(raw, expected.sync.imapExample.gmailXGmRaw)
  }

  func testSenderRulesAndCursorOffset() {
    let hdfc = sourceFor("hdfc-bank")
    XCTAssertTrue(senderAllowed(hdfc, "alerts@HDFCBANK.NET"))
    XCTAssertFalse(senderAllowed(hdfc, "information@mailers.hdfcbank.bank.in"))
    XCTAssertFalse(senderAllowed(hdfc, "alerts@evilhdfcbank.net"))
    XCTAssertTrue(senderAllowed(sourceFor("cdsl-cas"), "ECAS@CDSLSTATEMENT.COM"))
    XCTAssertEqual(subtractDaysWithOffset("2026-10-03T11:20:00.123+05:30", 1), "2026-10-02T11:20:00.123+05:30")
    XCTAssertEqual(subtractDaysWithOffset("2026-10-03T11:20:00.123Z", 1), "2026-10-02T11:20:00.123Z")
  }

  func testPlannerRefusesUndatedGraphRun() throws {
    XCTAssertEqual(try planQueries(["hdfc-bank"], cursors: [:]).count, 2)
    XCTAssertThrowsError(try planQueries(["hdfc-bank"], cursors: [:], provider: .graph))
  }

  func testPickerProvidersAndPlainSearch() {
    let cases = [
      ("demo@gmail.com", "google"),
      ("demo@outlook.in", "microsoft"),
      ("demo@me.com", "icloud"),
      ("demo@yahoo.in", "yahoo"),
      ("demo@zoho.in", "zoho"),
      ("demo@example.org", "other"),
    ]
    for (email, provider) in cases {
      XCTAssertEqual(detectPickerProvider(email).rawValue, provider, email)
    }
    let source = sourceFor("hdfc-bank")
    XCTAssertTrue(plainSearch(source, source.searches[1]).contains("with 'statement' in the subject"))
  }

  func testCatalogGuard() throws {
    let raw = try SourcesCatalog.rawJSON()
    XCTAssertNil(raw.range(of: #"password\s*[:=]|\b[A-Z]{5}\d{4}[A-Z]\b"#, options: .regularExpression))
    let catalog = SetupSources.catalog
    XCTAssertEqual(Set(catalog.sources.map(\.id)).count, catalog.sources.count)
    for source in catalog.sources {
      XCTAssertGreaterThan(source.senders.domains.count + source.senders.addresses.count, 0, source.id)
      for hint in source.passwordHints {
        XCTAssertNotNil(catalog.passwordHintFormats[hint], "\(source.id) \(hint)")
      }
    }
    for kind in catalog.kindOrder {
      let regions = catalog.sources.filter { $0.kinds.contains(kind) }.map(\.region)
      if let firstGlobal = regions.firstIndex(of: "GLOBAL") {
        XCTAssertFalse(regions[firstGlobal...].contains("IN"), kind)
      }
    }
    for id in ["cdsl-cas", "nsdl-cas"] {
      XCTAssertEqual(sourceFor(id).importer, CatalogImporter(formats: ["pdf"], adapters: ["cas.depository"], supported: true, note: nil))
    }
  }

  func testFixturesAreSynthetic() throws {
    for name in ["dataset.after-import", "state.midway", "mailbox.synthetic", "expected"] {
      let text = String(data: try Data(contentsOf: fixtureURL(name)), encoding: .utf8) ?? ""
      XCTAssertTrue(text.contains("SYNTHETIC"), name)
    }
  }

  func testLowConfidenceImportDoesNotComplete() {
    var current = setupReducer(initialSetup(now: expected.now), .setProfile(SetupProfilePatch(name: "SYNTHETIC Demo", currency: nil)), now: expected.now)
    current = setupReducer(current, .toggleSource("hdfc-bank"), now: expected.now)
    current = setupReducer(
      current,
      .importAttributed(ImportAttribution(
        adapter: "bank.hdfc",
        catalogId: nil,
        importId: nil,
        file: "SYNTHETIC.pdf",
        accountIds: ["acc_demo001"],
        added: 1,
        duplicates: 0,
        confidence: 0.5,
        lastDataDate: nil,
        accountDataDates: nil
      )),
      now: expected.now,
      dataset: SetupDataset(transactions: [], accounts: nil, budgets: [SetupBudgetRef(month: "2026-10")], goals: nil)
    )
    XCTAssertEqual(current.sources.first?.status, .error)
    XCTAssertEqual(current.events, [])
    XCTAssertNil(current.completedAt)
  }

  func testNavigatedStepSurvivesEdits() {
    var current = setupReducer(
      state,
      .setProfile(SetupProfilePatch(name: "SYNTHETIC Demo", currency: nil)),
      now: expected.now,
      currentStep: .email
    )
    XCTAssertEqual(current.currentStep, .email)
    current = setupReducer(current, .finishLater, now: expected.now, currentStep: .email)
    XCTAssertEqual(current.currentStep, .email)
    XCTAssertNil(current.dismissedAt)
    let moved = setupReducer(state, .goTo(step: .accounts, done: true, from: .email), now: expected.now)
    XCTAssertTrue(moved.stepsDone.contains(.email))
    XCTAssertFalse(moved.stepsDone.contains(.importStep))
  }

  func testProfileMailSourcesDemoAndReset() {
    let now = "2026-10-03T11:00:00+05:30"
    var current = initialSetup(now: now)
    func apply(_ action: SetupAction) { current = setupReducer(current, action, now: now) }
    apply(.setProfile(SetupProfilePatch(name: String(repeating: "x", count: 50), currency: nil)))
    XCTAssertEqual(current.profile.name.count, 40)
    apply(.chooseMode(.mine))
    XCTAssertEqual(current.currentStep, .email)
    apply(.setEmail(" DEMO@EXAMPLE.ORG ", provider: nil, pickerProvider: nil))
    XCTAssertEqual(current.email.primary, "demo@example.org")
    apply(.setEmail("bad", provider: nil, pickerProvider: nil))
    XCTAssertEqual(current.email.primary, "demo@example.org")
    apply(.addEmail(" extra@example.org "))
    apply(.addEmail("extra@example.org"))
    XCTAssertEqual(current.email.extra, ["extra@example.org"])
    apply(.removeEmail("extra@example.org"))
    XCTAssertEqual(current.email.extra, [])
    apply(.toggleSource("hdfc-bank"))
    apply(.toggleSource("hdfc-bank"))
    XCTAssertEqual(current.sources, [])
    apply(.addCustomSource(name: "Example Co-op", domain: "MAIL.EXAMPLE.ORG", catalogId: nil))
    XCTAssertEqual(sourceFor(current.sources[0]).senders.domains, ["mail.example.org"])
    apply(.searchTapped(current.sources[0].catalogId))
    XCTAssertEqual(current.sources[0].status, .searching)
    apply(.importFailed(catalogId: current.sources[0].catalogId, reason: nil))
    XCTAssertEqual(current.sources[0].status, .error)
    apply(.skipEmail)
    XCTAssertTrue(current.email.skipped)
    apply(.skipStep(.accounts))
    XCTAssertEqual(current.currentStep, .importStep)
    apply(.goTo(step: .plan, done: true, from: nil))
    XCTAssertEqual(current.currentStep, .plan)
    XCTAssertTrue(current.stepsDone.contains(.importStep))
    apply(.finishLater)
    XCTAssertNil(current.dismissedAt)
    XCTAssertEqual(current.currentStep, .plan)
    apply(.dismissCard)
    XCTAssertEqual(current.dismissedAt, now)
    apply(.chooseMode(.demo))
    apply(.toggleSource("hdfc-bank"))
    XCTAssertEqual(current.sources, [])
    XCTAssertEqual(current.events, [])
    apply(.reset)
    XCTAssertEqual(current, initialSetup(now: now))
  }

  func testMailboxLifecycle() {
    let now = "2026-10-03T11:00:00+05:30"
    var current = initialSetup(now: now)
    func apply(_ action: SetupAction) { current = setupReducer(current, action, now: now) }
    apply(.consentGiven(nil, senders: 4, mailboxId: nil))
    apply(.mailboxConnected(SetupMailbox(
      id: "mbx_demo", provider: .google, address: "demo@example.org", method: .oauth, imapHost: nil,
      connectedAt: now, lastSyncAt: nil, status: .ok, cursors: [:], seenIds: [], passwordTasks: []
    )))
    XCTAssertEqual(current.mailboxes?.first?.consent, MailboxConsent(version: "mailsync-consent-v1", at: now, senders: 4))
    apply(.discoveryDone(mailboxId: "mbx_demo", sources: [
      DiscoveryHit(catalogId: "hdfc-bank", count: 2),
      DiscoveryHit(catalogId: "netflix", count: 0),
    ]))
    XCTAssertEqual(current.sources.map(\.catalogId), ["hdfc-bank"])
    apply(.syncStarted(mailboxId: "mbx_demo"))
    XCTAssertEqual(current.sources[0].status, .searching)
    apply(.syncProgress(mailboxId: "mbx_demo", done: 1, total: 2, catalogId: nil, status: nil))
    XCTAssertEqual(current.mailboxes?.first?.progress, MailboxProgress(done: 1, total: 2))
    apply(.passwordTaskAdded(mailboxId: "mbx_demo", PasswordTask(messageId: "msg_demo", attachmentId: "att_demo", sourceId: "hdfc-bank", since: nil)))
    XCTAssertEqual(current.sources[0].status, .waiting)
    apply(.passwordTaskResolved(mailboxId: "mbx_demo", messageId: "msg_demo", attachmentId: nil))
    XCTAssertEqual(current.mailboxes?.first?.passwordTasks, [])
    apply(.syncDone(mailboxId: "mbx_demo", cursors: ["hdfc-bank/alerts": now], seenIds: ["msg_demo"]))
    XCTAssertEqual(current.mailboxes?.first?.lastSyncAt, now)
    XCTAssertNil(current.mailboxes?.first?.progress)
    apply(.mailboxReauthNeeded(mailboxId: "mbx_demo"))
    XCTAssertEqual(current.mailboxes?.first?.status, .reauth)
    apply(.mailboxDisconnected(mailboxId: "mbx_demo"))
    XCTAssertEqual(current.mailboxes, [])
  }

  func testRememberedAttributionUsesOldestAccountDate() {
    let now = "2026-10-03T11:00:00+05:30"
    let current = setupReducer(
      state,
      .importAttributed(ImportAttribution(
        adapter: "bank.generic",
        catalogId: nil,
        importId: "imp_demo",
        file: "synthetic.pdf",
        accountIds: ["acc_sav001", "acc_sav002"],
        added: 0,
        duplicates: 3,
        confidence: nil,
        lastDataDate: nil,
        accountDataDates: ["acc_sav001": "2026-10-02", "acc_sav002": "2026-09-30"]
      )),
      now: now
    )
    XCTAssertTrue(current.sources[0].importIds?.contains("imp_demo") == true)
    XCTAssertEqual(current.sources[0].lastDataDate, "2026-09-30")
    XCTAssertNil(attribute("bank.generic", ["hdfc-bank", "kotak-bank"]).auto)
  }

  private func load<T: Decodable>(_ name: String) throws -> T {
    try load(T.self, name: name)
  }

  private func load<T: Decodable>(_ type: T.Type, name: String) throws -> T {
    try JSONDecoder().decode(type, from: Data(contentsOf: fixtureURL(name)))
  }

  private func fixtureURL(_ name: String) throws -> URL {
    let bundle = Bundle(for: SetupGoldenTests.self)
    if let url = bundle.url(forResource: name, withExtension: "json", subdirectory: "__fixtures__")
      ?? bundle.url(forResource: name, withExtension: "json") {
      return url
    }
    let enumerator = FileManager.default.enumerator(at: bundle.bundleURL, includingPropertiesForKeys: nil)
    while let item = enumerator?.nextObject() as? URL {
      if item.lastPathComponent == "\(name).json" { return item }
    }
    throw CocoaError(.fileNoSuchFile)
  }
}
