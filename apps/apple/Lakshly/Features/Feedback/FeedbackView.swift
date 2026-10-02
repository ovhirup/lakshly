import SwiftUI

struct FeedbackView: View {
  @Environment(\.theme) private var theme
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.openURL) private var openURL
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore
  @State private var title = ""
  @State private var details = ""
  @State private var kind: FeedbackKind = .feedback
  @State private var confirmation = false

  init(store: DataStore) {
    self.store = store
    #if DEBUG
    if LaunchOptions.current.feedbackDemo == true {
      _kind = State(initialValue: .request)
      _title = State(initialValue: "Split bills with friends")
      _details = State(initialValue: "Let me split a bill & track who paid.")
    }
    #endif
  }

  private var issueEnvironment: IssueEnvironment {
    .current(themeName: theme.definition.name, isDark: colorScheme == .dark, tier: entitlements.tier)
  }
  private var issueTitle: String { GitHubIssueLink.title(kind: kind, title: title, text: details) }
  private var priority: Bool { entitlements.can(.priorityFeedback) }

  private func statusColor(_ status: String) -> Color {
    switch status {
    case "Planned": theme.indigo
    case "In progress": theme.invest
    case "Shipped": theme.success
    default: theme.slate
    }
  }
  var body: some View {
    Page(title: "Feedback & Requests", subtitle: "Built with you") {
      Card(title: "Thank you for helping shape Lakshly 💛") {
        Text("Every request is read by a human.").font(.headline)
        Text(
          "Feedback opens a prefilled GitHub issue in your browser. It includes only your message, the app version, platform, theme and tier. You review it and submit it yourself."
        ).foregroundStyle(theme.secondaryText)
      }
      Card(title: "Your next idea") {
        if store.encryptionStatus == "Encryption key not persisted (dev build)" {
          Text("Dev build: requests are kept in memory for this session only.").font(.caption)
            .foregroundStyle(theme.secondaryText)
        }
        Picker("Kind", selection: $kind) {
          ForEach(FeedbackKind.allCases) { Text($0.displayName).tag($0) }
        }.pickerStyle(.segmented)
        TextField("Title (optional)", text: $title).textFieldStyle(ThemedFieldStyle())
        TextField("Your message", text: $details, axis: .vertical).lineLimit(3...6)
          .textFieldStyle(ThemedFieldStyle())
        if priority {
          Pill(text: "Priority label", color: theme.lotus, symbol: "star.fill")
          Text("Premium requests get the priority label and are triaged first")
            .font(.caption).foregroundStyle(theme.secondaryText)
        } else {
          Text("Premium requests get the priority label")
            .font(.caption).foregroundStyle(theme.secondaryText)
        }
      }
      Card(title: "Exactly what GitHub will show") {
        Text("Title: \(issueTitle)\nLabels: \(GitHubIssueLink.labels(kind: kind, priority: priority))\n\n\(GitHubIssueLink.body(kind: kind, text: details, environment: issueEnvironment))")
          .font(.system(.caption, design: .monospaced))
          .foregroundStyle(theme.text).textSelection(.enabled)
        Button("Open GitHub issue", systemImage: "arrow.up.forward.app") {
          let localTitle = issueTitle
          openURL(GitHubIssueLink.url(kind: kind, title: title, text: details,
            environment: issueEnvironment, priority: priority))
          _ = store.submit(title: localTitle, details: GitHubIssueLink.message(details),
            type: kind.displayName, premium: priority)
          title = ""
          details = ""
          confirmation = true
        }.buttonStyle(ThemedSubmitStyle())
          .disabled(details.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        if let error = store.error { Text(error).foregroundStyle(theme.danger) }
      }
      Card(title: "Community requests · synthetic") {
        ForEach(
          store.requests.sorted {
            if $0.priority != $1.priority { return $0.priority }
            return $0.title < $1.title
          }
        ) { request in
          VStack(alignment: .leading, spacing: 8) {
            HStack {
              Text(request.title).font(.headline)
              Spacer()
              if request.priority { Pill(text: "Priority", color: theme.lotus, symbol: "star.fill") }
              Pill(text: request.status, color: statusColor(request.status))
            }
            Text(request.details).font(.subheadline).foregroundStyle(theme.secondaryText)
            Text("\(request.author) · \(request.type)").font(.caption)
          }.padding(.vertical, 8)
        }
      }
      Card(title: "Built with you") {
        Text("Synthetic community contributors").foregroundStyle(theme.secondaryText)
        ForEach(store.requests.filter { $0.status == "Shipped" }) {
          Text("\($0.author) · \($0.title)")
        }
      }
    }.alert("Opened in your browser", isPresented: $confirmation) {
      Button("Done", role: .cancel) {}
    } message: {
      Text("Review it and press Submit on GitHub. Nothing is sent until you do.")
    }
  }
}
