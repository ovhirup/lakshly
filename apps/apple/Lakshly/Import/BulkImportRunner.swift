import Foundation
import Observation

/// Sequential, injected parse/save runner. Passwords exist only in this invocation.
@MainActor @Observable final class BulkImportRunner {
  var rows: [BulkImportRow]
  private(set) var running = false
  var stopRequested = false
  init(rows: [BulkImportRow] = []) { self.rows = rows }
  var selectedCount: Int { rows.filter { $0.selected && $0.selectable && $0.status != .imported }.count }
  var summary: String {
    "\(rows.filter { $0.status == .imported }.count) imported · \(rows.filter { $0.status == .failed }.count) failed · \(rows.filter { $0.status == .skipped || $0.status == .notStatement }.count) skipped"
  }
  func selectAll(_ selected: Bool) {
    guard !running else { return }
    for i in rows.indices { rows[i].selected = selected && rows[i].selectable && rows[i].status != .imported }
  }
  func run(ids: Set<String>? = nil,
           attempt: (BulkImportFile, String?) async -> BulkImportAttempt,
           password: (BulkImportFile, Bool) async -> BulkPasswordAnswer?) async {
    guard !running else { return }
    running = true; stopRequested = false
    var remembered: String?
    defer { remembered = nil; running = false; stopRequested = false }
    let indices = rows.indices.filter { index in
      rows[index].selectable && (ids.map { requested in requested.contains(rows[index].id) }
        ?? (rows[index].selected && rows[index].status != .imported))
    }
    for i in indices { rows[i].status = .queued }
    for i in indices {
      if stopRequested || Task.isCancelled { rows[i].status = .skipped; rows[i].detail = "Stopped"; continue }
      rows[i].status = .importing
      var credential = remembered
      var outcome = await attempt(rows[i].file, credential)
      var incorrect = false
      while case .needsPassword = outcome {
        rows[i].status = .needsPassword
        guard let answer = await password(rows[i].file, incorrect), !Task.isCancelled else {
          outcome = .failed; rows[i].status = .skipped; break
        }
        credential = answer.password
        remembered = answer.reuse ? answer.password : nil
        rows[i].status = .importing
        outcome = await attempt(rows[i].file, credential)
        incorrect = true
        if case .needsPassword = outcome { remembered = nil }
      }
      if rows[i].status == .skipped { continue }
      switch outcome {
      case .imported: rows[i].status = .imported; rows[i].selected = false
      case .failed: rows[i].status = .failed
      case .notStatement: rows[i].status = .notStatement; rows[i].kind = .notStatement; rows[i].selected = false
      case .needsPassword: rows[i].status = .skipped
      }
    }
  }
}
