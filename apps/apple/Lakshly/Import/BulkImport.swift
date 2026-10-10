import Foundation
import CryptoKit

struct BulkImportFile: Identifiable, Equatable {
  var id = UUID().uuidString
  var name: String
  var data: Data
  var modified: Date? = nil
  var hash: String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
  var fallbackKey: String { Self.normalizedName(name) + ":\(data.count)" }
  static func normalizedName(_ name: String) -> String {
    name.precomposedStringWithCanonicalMapping.lowercased().split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
  }
}

enum BulkStatementKind: Equatable { case statement, locked, notStatement, unreadable }
enum BulkImportStatus: String, Equatable {
  case ready = "Ready", queued = "Queued", importing = "Importing", imported = "Imported"
  case needsPassword = "Needs password", failed = "Failed", skipped = "Skipped", notStatement = "Not a statement"
}
struct BulkImportRow: Identifiable, Equatable {
  var file: BulkImportFile
  var kind: BulkStatementKind
  var copies = 1
  var selected = true
  var status: BulkImportStatus = .ready
  var detail: String? = nil
  var id: String { file.id }
  var selectable: Bool { kind == .statement || kind == .locked }
}

enum BulkImportPlan {
  static func rows(_ files: [BulkImportFile], importedHashes: Set<String> = [], importedFileKeys: Set<String> = [], importedLegacyNames: Set<String> = [],
                   classify: (BulkImportFile) -> BulkStatementKind) -> [BulkImportRow] {
    // Stable newest-first: equal or unknown dates preserve the first picked file.
    let ordered = files.enumerated().sorted {
      let left = $0.element.modified ?? .distantPast, right = $1.element.modified ?? .distantPast
      return left == right ? $0.offset < $1.offset : left > right
    }.map(\.element)
    var rows: [BulkImportRow] = []
    var hashes: [String: Int] = [:], keys: [String: Int] = [:]
    for file in ordered {
      let hash = file.hash, key = file.fallbackKey
      if let index = hashes[hash] ?? keys[key] {
        rows[index].copies += 1
        hashes[hash] = index; keys[key] = index
        if importedHashes.contains(hash) || importedFileKeys.contains(key) || importedLegacyNames.contains(BulkImportFile.normalizedName(file.name)) {
          rows[index].status = .imported; rows[index].selected = false
        }
        continue
      }
      let kind = classify(file)
      let already = importedHashes.contains(hash) || importedFileKeys.contains(key) || importedLegacyNames.contains(BulkImportFile.normalizedName(file.name))
      var row = BulkImportRow(file: file, kind: kind)
      row.selected = row.selectable && !already
      row.status = already ? .imported : (kind == .notStatement ? .notStatement : (kind == .unreadable ? .failed : (kind == .locked ? .needsPassword : .ready)))
      hashes[hash] = rows.count; keys[key] = rows.count
      rows.append(row)
    }
    return rows
  }
}

struct BulkPasswordAnswer {
  var password: String
  var reuse: Bool
}
enum BulkImportAttempt { case imported, needsPassword, failed, notStatement }

