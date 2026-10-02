import SwiftUI

struct HistoryView: View {
  @Environment(\.theme) private var theme
  let store: DataStore
  @State private var search = ""
  @State private var category = "All"
  @State private var flow = "All"
  private var all: [Transaction] { store.dataset?.transactions ?? [] }
  private var categories: [String] { ["All"] + Set(all.map(\.category)).sorted() }
  private var filtered: [Transaction] {
    all.filter { row in
      (category == "All" || row.category == category)
        && (flow == "All" || (flow == "Income" ? row.amount > 0 : row.amount < 0))
        && (search.isEmpty
          || "\(row.description) \(row.merchant ?? "") \(row.category)"
            .localizedCaseInsensitiveContains(search))
    }.sorted { $0.date > $1.date }
  }
  private var months: [String] { Set(filtered.map { String($0.date.prefix(7)) }).sorted(by: >) }
  var body: some View {
    Page(title: "History", subtitle: "Every transaction has a story.") {
      TextField("Search merchants or transactions", text: $search).textFieldStyle(ThemedFieldStyle())
      HStack {
        Picker("Category", selection: $category) {
          ForEach(categories, id: \.self) { Text($0.capitalized).tag($0) }
        }.pickerStyle(.menu)
        Picker("Flow", selection: $flow) {
          ForEach(["All", "Income", "Outflow"], id: \.self) { Text($0).tag($0) }
        }.pickerStyle(.menu)
      }
      if filtered.isEmpty {
        ContentUnavailableView(
          "No transactions", systemImage: "magnifyingglass",
          description: Text("Try another search or filter."))
      }
      ForEach(months, id: \.self) { month in
        Card(title: month) {
          ForEach(filtered.filter { $0.date.hasPrefix(month) }) { row in
            HStack(alignment: .top) {
              VStack(alignment: .leading, spacing: 6) {
                Text(row.merchant ?? row.description).font(.headline)
                Text(row.date).font(.caption).foregroundStyle(theme.secondaryText)
                Pill(text: row.category.capitalized)
              }
              Spacer()
              SemanticAmount(value: Money.format(row.amount),
                semantic: row.amount > 0 ? .income : (row.category == "investments" ? .invest : .spend))
                .font(.subheadline.bold())
            }
            Divider()
          }
        }
      }
    }
  }
}
