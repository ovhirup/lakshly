import SwiftUI

@main struct LakshlyApp: App {
  @State private var store = DataStore()
  @State private var lock = AppLock()
  var body: some Scene { WindowGroup { RootView(store: store, lock: lock) } }
}

struct RootView: View {
  let store: DataStore
  let lock: AppLock
  @Environment(\.scenePhase) private var phase
  @AppStorage("appLock") private var lockEnabled = true
  @State private var settings = false
  @State private var selected = UserDefaults.standard.string(forKey: "startTab") ?? "overview"
  var body: some View {
    ZStack {
      LinearGradient(
        colors: [.pink.opacity(0.20), .orange.opacity(0.18), .yellow.opacity(0.22)],
        startPoint: .topLeading, endPoint: .bottomTrailing
      ).ignoresSafeArea()
      if lock.locked {
        VStack(spacing: 24) {
          Image(systemName: "lock.shield").font(.system(size: 64)).foregroundStyle(.orange)
          Text("Lakshly").font(.system(.largeTitle, design: .rounded, weight: .bold))
          Text("Every rupee on target.").foregroundStyle(.secondary)
          if lock.canAuthenticate {
            Button("Unlock with Face ID / Touch ID") { Task { await lock.unlock() } }.buttonStyle(
              .glass
            ).disabled(lock.authenticating)
          } else {
            Button("Continue (demo mode)") { lock.continueDemo() }.buttonStyle(.glass)
          }
          if lock.forced { Text("Lock screen preview").font(.caption) }
          if let message = lock.message { Text(message).font(.caption) }
        }.padding(36).modifier(GlassCard()).padding()
      } else {
        TabView(selection: $selected) {
          Tab("Overview", systemImage: "square.grid.2x2", value: "overview") {
            navigation { OverviewView(store: store, showFeedback: { selected = "feedback" }) }
          }
          Tab("Spend", systemImage: "chart.pie", value: "spend") {
            navigation { SpendView(store: store) }
          }
          Tab("Budget", systemImage: "target", value: "budget") {
            navigation { BudgetView(store: store) }
          }
          Tab("Feedback", systemImage: "heart.text.square", value: "feedback") {
            navigation { FeedbackView(store: store) }
          }
          Tab("Debt", systemImage: "chart.line.downtrend.xyaxis", value: "debt") {
            navigation { DebtView(store: store) }
          }
          Tab("Credit", systemImage: "creditcard", value: "credit") {
            navigation { CreditView(store: store) }
          }
          Tab("Investments", systemImage: "chart.line.uptrend.xyaxis", value: "investments") {
            navigation { InvestmentsView(store: store) }
          }
          Tab("Rewards", systemImage: "gift", value: "rewards") {
            navigation { RewardsView(store: store) }
          }
          Tab("History", systemImage: "clock", value: "history") {
            navigation { HistoryView(store: store) }
          }
        }.tabViewStyle(.sidebarAdaptable)
      }
    }.tint(.orange).sheet(isPresented: $settings) { SettingsView(store: store) }
      .onAppear { if !lockEnabled && !lock.forced { lock.locked = false } }
      .onChange(of: phase) { _, value in
        if value == .background || (value == .inactive && !lock.authenticating) {
          settings = false
          lock.relock(enabled: lockEnabled)
        }
      }
  }
  private func navigation<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    NavigationStack {
      content().toolbar { Button("Settings", systemImage: "gearshape") { settings = true } }
    }
  }
}
