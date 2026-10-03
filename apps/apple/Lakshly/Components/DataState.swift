import SwiftUI

enum DataNeed {
  case transactions, accounts, savings, cards, debts, sips, rewards

  func isMissing(in dataset: Dataset) -> Bool {
    switch self {
    case .transactions: dataset.transactions.isEmpty
    case .accounts: dataset.accounts.isEmpty
    case .savings: !dataset.accounts.contains { $0.type == "savings" || $0.type == "current" }
    case .cards: !dataset.accounts.contains { $0.type == "credit_card" }
    case .debts: (dataset.debts ?? []).isEmpty
    case .sips: (dataset.sips ?? []).isEmpty && !dataset.accounts.contains { $0.type == "mutual_fund" }
    case .rewards: (dataset.rewards ?? []).isEmpty
    }
  }
}

extension EnvironmentValues {
  @Entry var openImport: () -> Void = {}
  @Entry var openSetup: (_ health: Bool, _ step: String?) -> Void = { _, _ in }
  @Entry var selectTheme: (String) -> Void = { _ in }
}

/// Small label used in the shell: which dataset is on screen.
struct DataPill: View {
  @Environment(\.theme) private var theme
  let source: DataSource
  var body: some View {
    switch source {
    case .demo:
      Pill(text: "Demo data")
    case .mine:
      Pill(text: "My data", color: theme.gold)
    }
  }
}

struct DataNote: View {
  @Environment(\.theme) private var theme
  let source: DataSource
  var body: some View {
    Text(
      source == .mine
        ? "Your data · encrypted, stored only on this device"
        : "Synthetic demo data · stored only on this device"
    )
    .font(.caption)
    .foregroundStyle(theme.secondaryText)
  }
}

/// Renders children when the active dataset has what the page needs; otherwise a friendly empty state.
struct DataGate<Content: View>: View {
  @Environment(\.theme) private var theme
  @Environment(\.openImport) private var openImport
  @Environment(\.openSetup) private var openSetup
  let store: DataStore
  let title: String
  var need: [DataNeed] = [.transactions]
  @ViewBuilder var content: Content

  private var missing: Bool {
    guard store.source == .mine else { return false }
    let dataset = store.dataset ?? DataStore.emptyUserDataset()
    return need.contains { $0.isMissing(in: dataset) }
  }

  var body: some View {
    if missing {
      Page(title: title, subtitle: "Showing your data") {
        Card(title: "Nothing here yet") {
          Text(
            "Import a bank, credit-card or mutual fund (CAS) statement to fill this page. Parsing happens on this device; nothing is uploaded."
          )
          .foregroundStyle(theme.secondaryText)
          Button("Import a statement") { openImport() }
            .buttonStyle(ThemedSubmitStyle())
          Button("Guided setup") { openSetup(false, nil) }
            .buttonStyle(ThemedSubmitStyle())
          Button("View demo data") { store.setSource(.demo) }
        }
      }
    } else {
      content
    }
  }
}
