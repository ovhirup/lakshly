import SwiftUI

struct FeedbackView: View {
  let store: DataStore
  @AppStorage("premium") private var premium = false
  @State private var title = ""
  @State private var details = ""
  @State private var type = "Feature"
  @State private var confirmation = false
  private func statusColor(_ status: String) -> Color {
    switch status {
    case "Planned": .blue
    case "In progress": .orange
    case "Shipped": .green
    default: .gray
    }
  }
  var body: some View {
    Page(title: "Feedback & Requests", subtitle: "Built with you") {
      Card(title: "Thank you for helping shape Lakshly 💛") {
        Text("Every request is read by a human.").font(.headline)
        Text(
          "This demo saves requests only on this device. Share them manually on GitHub for a human to read."
        ).foregroundStyle(.secondary)
        Link(
          "GitHub Issues", destination: URL(string: "https://github.com/ovhirup/lakshly/issues")!)
      }
      Card(title: "Your next idea") {
        if store.encryptionStatus == "Encryption key not persisted (dev build)" {
          Text("Dev build: requests are kept in memory for this session only.").font(.caption)
            .foregroundStyle(.secondary)
        }
        TextField("Title", text: $title).textFieldStyle(.roundedBorder)
        TextField("Details", text: $details, axis: .vertical).lineLimit(3...6).textFieldStyle(
          .roundedBorder)
        Picker("Type", selection: $type) {
          ForEach(["Feature", "Bug", "Idea"], id: \.self) { Text($0) }
        }.pickerStyle(.segmented)
        Button("Submit") {
          if store.submit(
            title: title.trimmingCharacters(in: .whitespacesAndNewlines), details: details,
            type: type, premium: premium)
          {
            title = ""
            details = ""
            confirmation = true
          }
        }.buttonStyle(.glass).disabled(
          title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || details.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        if let error = store.error { Text(error).foregroundStyle(.red) }
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
              if request.priority { Pill(text: "Priority", color: .pink, symbol: "star.fill") }
              Pill(text: request.status, color: statusColor(request.status))
            }
            Text(request.details).font(.subheadline).foregroundStyle(.secondary)
            Text("\(request.author) · \(request.type)").font(.caption)
          }.padding(.vertical, 8)
        }
      }
      Card(title: "Built with you") {
        Text("Synthetic community contributors").foregroundStyle(.secondary)
        ForEach(store.requests.filter { $0.status == "Shipped" }) {
          Text("\($0.author) · \($0.title)")
        }
      }
    }.alert("Thank you 💛", isPresented: $confirmation) {
      Button("Done", role: .cancel) {}
    } message: {
      Text("Your request was received locally. Thank you for helping shape Lakshly.")
    }
  }
}
