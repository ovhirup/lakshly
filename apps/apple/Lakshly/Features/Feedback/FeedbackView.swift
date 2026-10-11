import SwiftUI

#if !FEEDBACK_SHOTS
struct FeedbackView: View {
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore
  @State private var requests = FeedbackRequestStore()
  @State private var paywall = false
  var body: some View {
    FeedbackCanvas(premium: entitlements.can(.priorityFeedback), requests: requests,
      transport: FeedbackTransport(), showPremium: { paywall = true })
      .sheet(isPresented: $paywall) { PaywallView(context: .feature(.priorityFeedback)) }
  }
}

#endif

enum FeedbackScreen { case hub, form, sent, mine, failed }
struct FeedbackCanvas: View {
  @Environment(\.theme) private var theme
  @Environment(\.openURL) private var openURL
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  let premium: Bool
  let requests: FeedbackRequestStore
  let transport: any FeedbackTransporting
  var showPremium: () -> Void = {}
  var roadmap: FeedbackRoadmap = .load()
  @State var screen: FeedbackScreen = .hub
  @State var draft = FeedbackDraft()
  @State var sent: FeedbackRequest?
  @State private var busy = false
  @State private var confirmSensitive = false
  @State private var message: String?
  @State private var retryAt: Date?
  @State private var heartbeat = false

  init(premium: Bool, requests: FeedbackRequestStore, transport: any FeedbackTransporting,
       showPremium: @escaping () -> Void = {}, roadmap: FeedbackRoadmap = .load(),
       screen: FeedbackScreen = .hub, draft: FeedbackDraft = .init(), sent: FeedbackRequest? = nil) {
    self.premium = premium; self.requests = requests; self.transport = transport
    self.showPremium = showPremium; self.roadmap = roadmap
    _screen = State(initialValue: screen); _draft = State(initialValue: draft); _sent = State(initialValue: sent)
    #if DEBUG && !FEEDBACK_SHOTS
    if LaunchOptions.current.feedbackDemo == true {
      _screen = State(initialValue: .form)
      _draft = State(initialValue: FeedbackDraft(kind: .idea, title: "Split bills with friends", detail: "Let me split a bill & track who paid.", area: "Spend"))
    }
    #endif
  }
  private var payload: FeedbackPayload { FeedbackHelpers.buildPayload(draft, premium: premium, diagnostics: .current) }
  private var header: String { FeedbackHelpers.clientHeader(platform: FeedbackHelpers.clientPlatform,
    appVersion: FeedbackDiagnostics.current.appVersion, includeDiagnostics: draft.includeDiagnostics) }
  private var sensitive: Bool { FeedbackHelpers.looksSensitive([draft.title, draft.detail, draft.credit, draft.replyEmail].joined(separator: " ")) }
  var body: some View {
    Group {
      #if FEEDBACK_SHOTS
      VStack(alignment: .leading, spacing: 24) {
        Text("Feedback & Requests").font(.largeTitle.bold())
        Text("Built with you").foregroundStyle(theme.secondaryText)
        screenContent
      }.padding(24).frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background { ThemeBackground() }
      #else
      Page(title: "Feedback & Requests", subtitle: "Built with you") { screenContent }
      #endif
    }
    .foregroundStyle(theme.text)
    .tint(theme.gold)
    .alert("Check for sensitive information", isPresented: $confirmSensitive) {
      Button("Review message", role: .cancel) {}
      Button("Send anyway") { Task { await send() } }
    } message: { Text("Your message looks like it contains an account, card, phone number, PAN or IFSC. Remove personal information before sending.") }
  }
  @ViewBuilder private var screenContent: some View {
    if screen != .hub { Button("Back to feedback") { screen = .hub; message = nil } }
    switch screen {
    case .hub: hub
    case .form: form
    case .sent: sentView
    case .mine: mine
    case .failed: failure
    }
  }
  private var hub: some View {
    Group {
      Card(title: "Thank you for helping shape Lakshly 💛") {
        Text("Every idea, bug and kind word is read by a human. Thank you.")
        if premium { Text("⭐ Priority queue · human reply within 1 business day (Mon–Fri, IST)") }
        else {
          Text("Every message is read by a human. We aim to reply within 5 business days.")
          Button(action: showPremium) { Pill(text: "✦ Premium", color: theme.gold) }
            .buttonStyle(.plain).accessibilityHint("Opens Lakshly Premium")
        }
      }
      Card(title: "Your next message") {
        action("Suggest an idea", .idea)
        action("Report a bug", .bug)
        action("Send praise", .praise)
      }
      Card(title: "My requests") {
        Text("\(requests.requests.count) requests on this device")
        Button("View my requests") { screen = .mine }
      }
      Card(title: "Public roadmap") {
        Text("Updated \(roadmap.updated)").font(.caption).foregroundStyle(theme.secondaryText)
        ForEach(roadmap.items) { item in
          VStack(alignment: .leading, spacing: 6) {
            Text(item.title).font(.headline).fixedSize(horizontal: false, vertical: true)
            Text("\(item.status.label) · \(item.area) · \(item.votes) votes").font(.caption)
            if let reason = item.reason { Text(reason).foregroundStyle(theme.secondaryText) }
          }.padding(.vertical, 6)
        }
      }
      Card(title: "Built with you") {
        ForEach(roadmap.items.filter { !($0.credits ?? []).isEmpty }) { item in
          Text("\((item.credits ?? []).joined(separator: ", ")) · \(item.title)\(item.shippedIn.map { " · " + $0 } ?? "")")
            .fixedSize(horizontal: false, vertical: true)
        }
      }
    }
  }
  private func action(_ title: String, _ kind: FeedbackMessageKind) -> some View {
    Button(title) { draft = FeedbackDraft(kind: kind); message = nil; screen = .form }
      .buttonStyle(ThemedSubmitStyle())
  }
  private var form: some View {
    Group {
      Card(title: "Your \(draft.kind.label.lowercased())") {
        Picker("Kind", selection: $draft.kind) { ForEach(FeedbackMessageKind.allCases) { Text($0.label).tag($0) } }
          .accessibilityIdentifier("feedback.kind")
        formField("Title (at least 3 characters)", text: $draft.title)
          .accessibilityIdentifier("feedback.title")
        formField(draft.kind == .bug ? "Steps to reproduce and what you expected" : "Tell us more", text: $draft.detail)
          .accessibilityIdentifier("feedback.message")
        Picker("Area", selection: $draft.area) { ForEach(FeedbackHelpers.areas, id: \.self) { Text($0).tag($0) } }
        formField("Credit name (optional)", text: $draft.credit)
        formField("Reply email (optional)", text: $draft.replyEmail)
        Toggle("Include app version and platform diagnostics", isOn: $draft.includeDiagnostics)
        if sensitive {
          Text("⚠️ This looks like sensitive information. Remove account, card, phone numbers, PAN or IFSC. Sending requires confirmation.")
            .foregroundStyle(theme.danger).fixedSize(horizontal: false, vertical: true)
        }
      }
      Card(title: "Exactly what will be sent") {
        Text("X-Lakshly-Client: \(header)").font(.system(.caption, design: .monospaced))
          .fixedSize(horizontal: false, vertical: true)
        Text((try? String(decoding: payload.encoded(), as: UTF8.self)) ?? "Unable to encode preview")
          .font(.system(.caption, design: .monospaced)).textSelection(.enabled)
          .fixedSize(horizontal: false, vertical: true)
        Text("Only this message goes to the Lakshly feedback relay when you tap Send.").font(.caption)
        Button(busy ? "Sending…" : "Send") {
          if sensitive { confirmSensitive = true } else { Task { await send() } }
        }.buttonStyle(ThemedSubmitStyle()).disabled(busy || payload.title.utf16.count < 3)
          .accessibilityIdentifier("feedback.send")
      }
    }
  }
  @ViewBuilder private func formField(_ prompt: String, text: Binding<String>) -> some View {
    #if FEEDBACK_SHOTS
    VStack(alignment: .leading, spacing: 5) {
      Text(prompt).font(.caption).foregroundStyle(theme.secondaryText)
      Text(text.wrappedValue.isEmpty ? "Optional — not shared" : text.wrappedValue)
        .fixedSize(horizontal: false, vertical: true)
    }.padding(12).frame(maxWidth: .infinity, alignment: .leading)
      .background(theme.bg, in: RoundedRectangle(cornerRadius: 12))
    #else
    TextField(prompt, text: text, axis: .vertical).textFieldStyle(ThemedFieldStyle())
      .fixedSize(horizontal: false, vertical: true)
    #endif
  }
  private var sentView: some View {
    Card(title: "Thank you. You make Lakshly better.") {
      Image(systemName: "heart.fill").font(.largeTitle).foregroundStyle(theme.lotus)
        .scaleEffect(heartbeat ? 1.12 : 1)
        .onAppear {
          if !reduceMotion { withAnimation(.easeInOut(duration: 0.8).repeatForever(autoreverses: true)) { heartbeat = true } }
        }
      if let sent {
        Text("Reference: \(sent.id)").textSelection(.enabled)
        Text("Reply by \(FeedbackHelpers.dateLabel(FeedbackHelpers.replyBy(from: sent.createdAt, businessDays: sent.premium ? 1 : 5))) · Mon–Fri, IST")
        Text("What happens next").font(.headline)
        Text("1. Received — your message is in the queue.\n2. A human reads it and replies.\n3. Track planned work, progress and shipped updates in My requests.")
        if sent.kind == .idea { Text("If we build your idea, we'll credit you in Built with you when you opt in to a credit name.") }
      }
      if let message { Text(message) }
      Button("My requests") { screen = .mine }
      Button("Done") { screen = .hub }.accessibilityIdentifier("feedback.done")
    }
  }
  private var mine: some View {
    Group {
      if requests.requests.isEmpty { Card(title: "My requests") { Text("Your next idea could ship next. Send a message to start a thread.") } }
      ForEach(requests.requests) { request in
        Card(title: request.title) {
          Text("\(request.id) · \(request.kind.label) · \(request.area)").font(.caption)
          Text(request.status.label).font(.headline)
          if request.status != .notNow {
            VStack(alignment: .leading, spacing: 5) {
              ForEach([FeedbackStatus.received, .planned, .inProgress, .shipped], id: \.rawValue) { status in
                Text("\(status == request.status ? "●" : "○") \(status.label)")
                  .foregroundStyle(status == request.status ? theme.gold : theme.secondaryText)
              }
            }
          }
          ForEach(Array(request.replies.enumerated()), id: \.offset) { _, reply in
            VStack(alignment: .leading, spacing: 4) {
              Text("\(reply.name ?? "Lakshly") · \(reply.at)").font(.caption)
              Text(reply.text).fixedSize(horizontal: false, vertical: true)
            }
          }
          Button("Check for updates") { Task { await check(request) } }.disabled(busy)
        }
      }
      if let message { Text(message).fixedSize(horizontal: false, vertical: true) }
    }
  }
  private var failure: some View {
    Card(title: "Your message couldn't be sent yet") {
      Text(message ?? "The feedback service may not be ready, or you're offline. Please try again later.")
      if let retryAt { Text("Try again after \(retryAt.formatted(date: .omitted, time: .standard)).") }
      Button("Try again") { if sensitive { confirmSensitive = true } else { Task { await send() } } }.disabled(busy || (retryAt.map { $0 > Date() } ?? false))
      Button("Open as GitHub issue instead") {
        openURL(fallbackURL)
      }.accessibilityIdentifier("feedback.openGitHub")
      Text("GitHub opens a public draft with only the fields in your preview. Review it before submitting.")
        .font(.caption).fixedSize(horizontal: false, vertical: true)
      #if FEEDBACK_SHOTS
      Text("Prefer email? hello@lakshly.com").foregroundStyle(theme.gold).underline()
      #else
      Link("Prefer email? hello@lakshly.com", destination: URL(string: "mailto:hello@lakshly.com")!)
      #endif
    }
  }
  private var fallbackURL: URL {
    GitHubIssueLink.url(payload: payload)
  }
  @MainActor private func send() async {
    guard !busy else { return }; busy = true; defer { busy = false }
    let payload = payload
    do {
      let receipt = try await transport.send(payload, clientHeader: header)
      let now = Date()
      let request = FeedbackRequest(id: receipt.id, kind: payload.kind, title: payload.title, area: payload.area,
        createdAt: now, premium: payload.plan == "premium", status: .received,
        replies: [FeedbackHelpers.autoAck(at: ISO8601DateFormatter().string(from: now), premium: premium)])
      sent = request
      do { try requests.add(request, secret: receipt.secret) }
      catch { message = "Sent, but request history couldn't be saved on this device. Reference: \(receipt.id)"; screen = .sent; return }
      screen = .sent
    } catch {
      retryAt = nil
      if case let FeedbackTransportError.rateLimited(delay) = error {
        retryAt = Date().addingTimeInterval(delay); message = "You've sent a few messages recently. Give the queue a moment."
      } else { message = "The feedback service may not be ready, or you're offline. Please try again later." }
      screen = .failed
    }
  }
  @MainActor private func check(_ request: FeedbackRequest) async {
    guard !busy else { return }; busy = true; defer { busy = false }
    do {
      guard let secret = try requests.secrets.secret(for: request.id) else { message = "No lookup secret on this device for this request."; return }
      guard let remote = try await transport.fetchStatus(id: request.id, secret: secret,
        clientHeader: FeedbackHelpers.clientPlatform) else { message = "Not visible yet. Try again in a minute."; return }
      try requests.update(id: request.id, remote: remote); message = "Updated."
    } catch { message = "Couldn't check for updates. Try again later." }
  }
}
