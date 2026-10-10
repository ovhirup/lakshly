import SwiftUI

#if !PARITY_SHOTS
@MainActor @Observable final class BulkImportController {
  let runner: BulkImportRunner
  var passwordFile: String?
  var incorrect = false
  private var answer: CheckedContinuation<BulkPasswordAnswer?, Never>?
  private var task: Task<Void, Never>?
  init(files: [BulkImportFile], imports: [ImportLogEntry]) {
    runner = BulkImportRunner(rows: BulkImportPlan.rows(files,
      importedHashes: Set(imports.compactMap(\.contentHash)),
      importedFileKeys: Set(imports.compactMap { entry in
        entry.fileSize.map { BulkImportFile.normalizedName(entry.file) + ":\($0)" }
      }), importedLegacyNames: Set(imports.filter { $0.contentHash == nil && $0.fileSize == nil }.map { BulkImportFile.normalizedName($0.file) }), classify: BulkStatementParser.classify))
  }
  func submit(_ value: BulkPasswordAnswer?) {
    passwordFile = nil
    let continuation = answer; answer = nil
    continuation?.resume(returning: value)
  }
  func cancel() {
    runner.stopRequested = true
    task?.cancel()
    submit(nil)
  }
  func start(store: DataStore, ids: Set<String>? = nil, recordsImport: Bool = true,
             onImported: ((MergeReport, ParseResult, String, String) -> Void)? = nil) {
    guard !runner.running, task == nil else { return }
    task = Task { @MainActor in
      defer { task = nil; passwordFile = nil }
      await runner.run(ids: ids, attempt: { file, password in
        // Yield between rows so stop and VoiceOver have an opportunity to respond.
        await Task.yield()
        if Task.isCancelled { return .failed }
        do {
          let parsed = try BulkStatementParser.parse(file, password: password)
          guard BulkStatementParser.isStatement(parsed) else { return .notStatement }
          let report: MergeReport
          let id: String
          if recordsImport {
            report = store.importParsed(parsed, fileName: file.name, contentHash: file.hash, fileSize: file.data.count)
            guard store.error == nil else { return .failed }
            id = store.imports.last?.id ?? ""
          } else {
            report = MergeReport(added: parsed.transactions.count, duplicates: 0, accountsAdded: parsed.accounts.count,
                                 accountsUpdated: 0, sipsUpserted: parsed.sips.count)
            id = "imp_preview_" + file.id
          }
          onImported?(report, parsed, id, file.name)
          return .imported
        } catch is PasswordRequired { return .needsPassword }
        catch { return .failed }
      }, password: { file, incorrect in
        if Task.isCancelled { return nil }
        self.passwordFile = file.name; self.incorrect = incorrect
        return await withCheckedContinuation { self.answer = $0 }
      })
    }
  }
}

#endif

struct BulkResultsCard: View {
  @Bindable var runner: BulkImportRunner
  var start: (Set<String>?) -> Void
  var rendering = false
  private var isRunning: Bool { runner.running || (rendering && runner.rows.contains { $0.status == .importing || $0.status == .queued }) }
  @Environment(\.theme) private var theme
  var body: some View {
    Card(title: "Statements") {
      let eligible = runner.rows.filter { $0.selectable && $0.status != .imported }
      let allSelected = !eligible.isEmpty && eligible.allSatisfy(\.selected)
      if rendering {
        Label("Select all", systemImage: allSelected ? "checkmark.square" : "square").frame(minHeight: 44)
      } else {
        Toggle("Select all", isOn: Binding(get: { allSelected }, set: { runner.selectAll($0) }))
          .disabled(isRunning).frame(minHeight: 44).accessibilityIdentifier("bulk.selectAll")
      }
      Text("\(runner.selectedCount) selected").font(.subheadline).accessibilityIdentifier("bulk.selectedCount")
      ForEach(runner.rows.indices, id: \.self) { i in
        VStack(alignment: .leading, spacing: 4) {
          HStack {
            if rendering {
              Label(runner.rows[i].file.name, systemImage: runner.rows[i].selected ? "checkmark.square" : "square")
                .frame(minHeight: 44)
            } else {
              Toggle(runner.rows[i].file.name, isOn: $runner.rows[i].selected)
                .disabled(isRunning || !runner.rows[i].selectable || runner.rows[i].status == .imported)
                .frame(minHeight: 44).accessibilityLabel("Select \(runner.rows[i].file.name)")
            }
            if runner.rows[i].copies > 1 { Text("\(runner.rows[i].copies) copies").font(.caption) }
          }
          HStack {
            Text(runner.rows[i].status.rawValue).font(.caption.weight(.semibold))
            if let detail = runner.rows[i].detail { Text(detail).font(.caption) }
            Spacer()
            if runner.rows[i].selectable {
              Button(runner.rows[i].status == .imported ? "Import again" : "Import") { start([runner.rows[i].id]) }
                .disabled(isRunning).frame(minHeight: 44)
                .accessibilityLabel("Import \(runner.rows[i].file.name)")
            }
          }.foregroundStyle(theme.secondaryText)
          Divider()
        }
      }
      Button("Import selected (\(runner.selectedCount))") { start(nil) }
        .buttonStyle(ThemedSubmitStyle()).disabled(isRunning || runner.selectedCount == 0)
        .accessibilityIdentifier("bulk.importSelected")
      Button("Import all (\(eligible.count))") { start(Set(eligible.map(\.id))) }
        .buttonStyle(SetupGhostStyle()).disabled(isRunning || eligible.isEmpty)
        .accessibilityIdentifier("bulk.importAll")
      if isRunning {
        Button(runner.stopRequested ? "Stopping after this one…" : "Stop after this one") { runner.stopRequested = true }
          .disabled(runner.stopRequested).frame(minHeight: 44).accessibilityIdentifier("bulk.stop")
      }
      Text(runner.summary).font(.caption).accessibilityIdentifier("bulk.summary")
    }
  }
}

struct BulkPasswordCard: View {
  var file: String
  var incorrect = false
  var submit: (BulkPasswordAnswer?) -> Void
  var rendering = false
  @State private var password = ""
  @State private var reuse = false
  var body: some View {
    Card(title: "Password") {
      Text("\(file) is locked.")
      if rendering {
        Text("Password").frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
          .padding(.horizontal, 12).background(.secondary.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
      } else {
        SecureField("Password", text: $password).textFieldStyle(ThemedFieldStyle())
          .accessibilityIdentifier("bulk.password")
      }
      if incorrect { Text("Incorrect password. Try again.") }
      if rendering {
        Label("Use the same password for the rest of this batch", systemImage: "square").frame(minHeight: 44)
      } else {
        Toggle("Use the same password for the rest of this batch", isOn: $reuse)
          .frame(minHeight: 44).accessibilityIdentifier("bulk.reusePassword")
      }
      Button("Unlock") {
        let answer = BulkPasswordAnswer(password: password, reuse: reuse)
        password = ""; submit(answer)
      }.buttonStyle(ThemedSubmitStyle()).disabled(password.isEmpty)
      Button("Skip this file") { password = ""; submit(nil) }.frame(minHeight: 44)
      Text("Passwords stay in memory for this run and are never saved.").font(.caption).foregroundStyle(.secondary)
    }.onDisappear { password = ""; reuse = false }
  }
}

#if !PARITY_SHOTS
struct BulkImportView: View {
  let store: DataStore
  @State var controller: BulkImportController
  var recordsImport = true
  var onImported: ((MergeReport, ParseResult, String, String) -> Void)?
  @Environment(\.dismiss) private var dismiss
  var body: some View {
    Page(title: "Import statements", subtitle: "Parsed and saved on this device, one at a time.") {
      if let file = controller.passwordFile {
        BulkPasswordCard(file: file, incorrect: controller.incorrect, submit: controller.submit)
      }
      BulkResultsCard(runner: controller.runner) { ids in
        controller.start(store: store, ids: ids, recordsImport: recordsImport, onImported: onImported)
      }
      Button("Done") { controller.cancel(); dismiss() }.frame(minHeight: 44)
    }.onDisappear { controller.cancel() }
  }
}

#endif
