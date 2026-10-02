import SwiftUI
import UniformTypeIdentifiers

@MainActor @Observable final class ImportModel {
  enum Stage { case picker, password, preview, done }

  var stage: Stage = .picker
  var incorrect = false
  var error: String?
  var result: ParseResult?
  var report: MergeReport?
  var presentPicker = false
  private var bytes: Data?
  private var fileName: String?
  #if DEBUG
  private static var didApplyDemo = false
  #endif

  func ingest(_ url: URL) {
    let scoped = url.startAccessingSecurityScopedResource()
    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
    do {
      let data = try Data(contentsOf: url)
      accept(data, fileName: url.lastPathComponent, csv: url.pathExtension.lowercased() == "csv")
    } catch {
      self.error = "This file could not be read."
      stage = .picker
    }
  }

  func unlock(_ attempt: String) {
    guard !attempt.isEmpty else {
      incorrect = false
      return
    }
    open(password: attempt)
  }

  func cancelPassword() {
    bytes = nil
    fileName = nil
    incorrect = false
    result = nil
    stage = .picker
  }

  func confirm(into store: DataStore) {
    guard let result else { return }
    report = store.importParsed(result)
    bytes = nil
    stage = .done
  }

  func reset() {
    stage = .picker
    incorrect = false
    error = nil
    result = nil
    report = nil
    bytes = nil
    fileName = nil
  }

  func applyLaunchDemo(into store: DataStore) {
    #if DEBUG
    guard !Self.didApplyDemo else { return }
    Self.didApplyDemo = true
    guard let demo = LaunchOptions.current.importDemo else { return }
    guard ["picker", "chooser", "password", "preview", "done"].contains(demo) else { return }
    if demo == "picker" || demo == "chooser" {
      stage = .picker
      presentPicker = demo == "chooser"
      return
    }
    let useCas = LaunchOptions.current.importDemoFile == "cas"
    let stem = (useCas ? "cas" : "hdfc-bank") + (demo == "password" ? "-locked.synthetic" : ".synthetic")
    guard let url = Bundle.main.url(forResource: stem, withExtension: "pdf"), let data = try? Data(contentsOf: url) else {
      error = "Demo statement is not in this build."
      return
    }
    accept(data, fileName: stem + ".pdf", csv: false)
    guard demo == "done", stage == .preview else { return }
    confirm(into: store)
    #endif
  }

  private func accept(_ data: Data, fileName: String, csv: Bool) {
    error = nil
    incorrect = false
    bytes = data
    self.fileName = fileName
    if csv {
      let text = String(data: data, encoding: .utf8) ?? String(decoding: data, as: UTF8.self)
      result = parseCsv(text, fileName: fileName)
      bytes = nil
      stage = .preview
      return
    }
    open(password: nil)
  }

  private func open(password: String?) {
    guard let bytes else { return }
    do {
      let document = try PDFTextExtractor.extract(data: bytes, password: password, fileName: fileName)
      result = parseDocument(document)
      self.bytes = nil
      incorrect = false
      stage = .preview
    } catch let required as PasswordRequired {
      incorrect = required.incorrect
      stage = .password
    } catch {
      self.error = "This file could not be read."
      self.bytes = nil
      stage = .picker
    }
  }
}

struct ImportView: View {
  @Environment(\.theme) private var theme
  let store: DataStore
  @State private var model = ImportModel()
  @State private var picking = false
  @State private var password = ""

  var body: some View {
    Page(title: "Import", subtitle: "Statements stay on this device.") {
      switch model.stage {
      case .picker: picker
      case .password: passwordPrompt
      case .preview: preview
      case .done: done
      }
    }
    .fileImporter(isPresented: $picking, allowedContentTypes: [.pdf, .commaSeparatedText], allowsMultipleSelection: false) { result in
      switch result {
      case .success(let urls):
        if let url = urls.first { model.ingest(url) }
      case .failure(let error):
        let ns = error as NSError
        if ns.domain == NSCocoaErrorDomain, ns.code == CocoaError.userCancelled.rawValue { return }
        model.error = "This file could not be read."
      }
    }
    .onAppear {
      model.applyLaunchDemo(into: store)
      if model.presentPicker {
        model.presentPicker = false
        picking = true
      }
    }
    .onChange(of: model.stage) { _, stage in
      if stage != .password { password = "" }
    }
  }

  private var picker: some View {
    Card(title: "Statement") {
      Button("Choose statement PDF") { picking = true }.buttonStyle(ThemedSubmitStyle())
      Text("Parsed on this device. Nothing is uploaded.").font(.subheadline).foregroundStyle(theme.secondaryText)
      if let error = model.error { Text(error).foregroundStyle(theme.danger) }
    }
  }

  private var passwordPrompt: some View {
    Card(title: "Password") {
      Text("This statement is locked.").foregroundStyle(theme.secondaryText)
      SecureField("Password", text: $password).textFieldStyle(ThemedFieldStyle())
      if model.incorrect { Text("Incorrect password").foregroundStyle(theme.danger) }
      Button("Unlock") {
        let attempt = password
        password = ""
        model.unlock(attempt)
      }.buttonStyle(ThemedSubmitStyle())
      Button("Cancel") {
        password = ""
        model.cancelPassword()
      }
      Text("Parsed on this device. Nothing is uploaded.").font(.subheadline).foregroundStyle(theme.secondaryText)
    }
  }

  @ViewBuilder private var preview: some View {
    if let result = model.result {
      Card(title: "Summary") {
        VStack(alignment: .leading, spacing: 2) {
          Text(result.adapterLabel).font(.headline)
          Text("\(Int(jsRound(result.confidence * 100)))% match · \(result.transactions.count) rows")
            .font(.caption).foregroundStyle(theme.secondaryText)
        }
        ForEach(result.accounts, id: \.id) { account in
          MetricRow(
            title: account.name, value: Money.format(Int64(account.balance)),
            semantic: account.balance < 0 ? .spend : .income)
        }
        if let meta = result.meta.first {
          if meta.periodFrom != nil || meta.periodTo != nil {
            MetricRow(title: "Period", value: [meta.periodFrom, meta.periodTo].compactMap { $0 }.joined(separator: " – "))
          }
          if let total = meta.totalDue { MetricRow(title: "Total due", value: Money.format(Int64(total)), semantic: .spend) }
          if let minimum = meta.minDue { MetricRow(title: "Minimum due", value: Money.format(Int64(minimum))) }
          if let due = meta.dueDate { MetricRow(title: "Due date", value: due) }
        }
      }
      if !result.holdings.isEmpty {
        Card(title: "Holdings") {
          ForEach(result.holdings, id: \.accountId) { holding in
            VStack(alignment: .leading, spacing: 6) {
              Text(holding.scheme).font(.headline)
              Text("\(holding.registrar) · ••\(holding.folioMask)").font(.caption).foregroundStyle(theme.secondaryText)
              Text("\(formatted(holding.units)) units · NAV \(formatted(holding.nav))")
                .font(.caption).foregroundStyle(theme.secondaryText)
              SemanticAmount(value: Money.format(Int64(holding.marketValue)), semantic: .invest)
            }
            Divider()
          }
        }
      }
      if !result.warnings.isEmpty {
        Card(title: "Warnings") {
          ForEach(result.warnings, id: \.self) { warning in
            Text(warning).foregroundStyle(theme.secondaryText)
          }
        }
      }
      Card(title: "Transactions") {
        if result.transactions.isEmpty {
          Text("No transactions in this file.").foregroundStyle(theme.secondaryText)
        }
        ForEach(result.transactions, id: \.id) { row in
          HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 2) {
              Text(row.description).font(.subheadline.weight(.semibold)).lineLimit(1).truncationMode(.middle)
              Text("\(row.date) · \(row.category.capitalized)").font(.caption).foregroundStyle(theme.secondaryText)
            }
            Spacer(minLength: 8)
            SemanticAmount(
              value: Money.format(Int64(row.amount)),
              semantic: row.amount > 0 ? .income : (row.category == "investments" ? .invest : .spend)
            ).font(.subheadline).monospacedDigit()
          }
          Divider()
        }
      }
      Button("Import \(result.transactions.count) transactions") { model.confirm(into: store) }
        .buttonStyle(ThemedSubmitStyle())
    }
  }

  private var done: some View {
    Card(title: "Imported") {
      if let report = model.report {
        MetricRow(title: "Added", value: "\(report.added)")
        MetricRow(title: "Duplicates", value: "\(report.duplicates)")
        MetricRow(title: "Accounts added", value: "\(report.accountsAdded)")
        MetricRow(title: "Accounts updated", value: "\(report.accountsUpdated)")
        MetricRow(title: "SIPs", value: "\(report.sipsUpserted)")
      }
      Button("Import another") { model.reset() }.buttonStyle(ThemedSubmitStyle())
    }
  }

  private func formatted(_ value: Double) -> String {
    String(format: value == value.rounded() ? "%.0f" : "%.4f", value)
  }
}
