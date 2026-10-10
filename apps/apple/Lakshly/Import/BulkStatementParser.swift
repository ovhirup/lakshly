import Foundation

/// Uses the same local parsers as single-file import; an encrypted PDF is undecided until unlocked.
enum BulkStatementParser {
  static func parse(_ file: BulkImportFile, password: String?) throws -> ParseResult {
    if file.name.lowercased().hasSuffix(".csv") {
      return parseCsv(String(decoding: file.data, as: UTF8.self), fileName: file.name)
    }
    return parseDocument(try PDFTextExtractor.extract(data: file.data, password: password, fileName: file.name))
  }
  static func isStatement(_ result: ParseResult) -> Bool {
    result.confidence >= specificThreshold && (!result.accounts.isEmpty || !result.transactions.isEmpty || !result.holdings.isEmpty)
  }
  static func classify(_ file: BulkImportFile) -> BulkStatementKind {
    do { return isStatement(try parse(file, password: nil)) ? .statement : .notStatement }
    catch is PasswordRequired { return .locked }
    catch { return .unreadable }
  }
  static func read(_ urls: [URL]) -> (files: [BulkImportFile], failures: Int) {
    var files: [BulkImportFile] = [], failures = 0
    for url in urls {
      let scoped = url.startAccessingSecurityScopedResource()
      defer { if scoped { url.stopAccessingSecurityScopedResource() } }
      do {
        let data = try Data(contentsOf: url)
        let date = try? url.resourceValues(forKeys: [.contentModificationDateKey]).contentModificationDate
        files.append(BulkImportFile(name: url.lastPathComponent, data: data, modified: date))
      } catch { failures += 1 }
    }
    return (files, failures)
  }
}
