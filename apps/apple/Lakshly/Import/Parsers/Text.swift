import Foundation
import PDFKit

/// Group positioned text runs into visual lines. PDF y grows upward, so the top of the page comes first.
func itemsToLines(page: Int, raw: [(str: String, x: Double, y: Double, w: Double)], tolerance: Double = 2.5) -> [TextLine] {
  struct Row {
    var y: Double
    var items: [TextItem]
  }
  var rows: [Row] = []
  for item in raw {
    let trimmed = item.str.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmed.isEmpty { continue }
    if let index = rows.firstIndex(where: { abs($0.y - item.y) <= tolerance }) {
      rows[index].items.append(TextItem(str: trimmed, x: item.x, w: item.w))
    } else {
      rows.append(Row(y: item.y, items: [TextItem(str: trimmed, x: item.x, w: item.w)]))
    }
  }
  rows.sort { $0.y > $1.y }
  return rows.map { row in
    let items = row.items.sorted { $0.x < $1.x }
    var text = ""
    var lastEnd = -Double.infinity
    for item in items {
      let gap = item.x - lastEnd
      if !text.isEmpty { text += gap > 12 ? "   " : " " }
      text += item.str
      lastEnd = item.x + item.w
    }
    return TextLine(page: page, y: row.y, items: items, text: text)
  }
}

func textDocFromLines(_ texts: [String], fileName: String? = nil) -> TextDoc {
  TextDoc(pages: 1, lines: texts.enumerated().map { index, text in
    let parts = text.split(separator: "   ", omittingEmptySubsequences: false).map(String.init)
    // JS `split(/\s{3,}/)` drops the trailing-empty quirk differently; the three-space split above
    // matches the fixture builder, which always separates cells with three spaces.
    let items = parts.enumerated().filter { !$0.element.isEmpty }.map { offset, part in
      TextItem(str: part, x: Double(offset) * 100, w: 90)
    }
    return TextLine(page: 1, y: Double(-index), items: items, text: text)
  }, fileName: fileName)
}

enum PDFTextExtractor {
  /// Rebuild pdf.js-style text runs from PDFKit.
  ///
  /// `characterBounds(at:)` is offset from `page.string` wherever PDFKit inserts a newline, so each
  /// character's box comes from `selection(for:)`. Characters whose advances touch belong to one
  /// draw. PDFKit also invents a space for a column gap; a space wider than 12pt is that gap, and
  /// `itemsToLines` turns it back into three spaces.
  static func extract(data: Data, password: String? = nil, fileName: String? = nil) throws -> TextDoc {
    guard let document = PDFDocument(data: data) else {
      throw CocoaError(.fileReadCorruptFile)
    }
    if document.isLocked {
      guard let password, !password.isEmpty else { throw PasswordRequired(incorrect: false) }
      guard document.unlock(withPassword: password) else { throw PasswordRequired(incorrect: true) }
    }
    var lines: [TextLine] = []
    for index in 0..<document.pageCount {
      guard let page = document.page(at: index) else { continue }
      lines.append(contentsOf: itemsToLines(page: index + 1, raw: runs(on: page)))
    }
    return TextDoc(pages: document.pageCount, lines: lines, fileName: fileName)
  }

  private struct Glyph {
    var character: String
    var x: Double
    var y: Double
    var w: Double
  }

  private static func runs(on page: PDFPage) -> [(str: String, x: Double, y: Double, w: Double)] {
    let text = (page.string ?? "") as NSString
    let count = min(page.numberOfCharacters, text.length)
    var glyphs: [Glyph] = []
    glyphs.reserveCapacity(count)
    for index in 0..<count {
      let character = text.substring(with: NSRange(location: index, length: 1))
      if character == "\n" || character == "\r" { continue }
      guard let selection = page.selection(for: NSRange(location: index, length: 1)) else { continue }
      let bounds = selection.bounds(for: page)
      let width = Double(bounds.width)
      if character == " ", width == 0 || width > 12 { continue }
      if width == 0, bounds.height == 0 { continue }
      glyphs.append(Glyph(character: character, x: Double(bounds.origin.x), y: Double(bounds.origin.y), w: width))
    }
    let sorted = glyphs.sorted { $0.y == $1.y ? $0.x < $1.x : $0.y > $1.y }
    var lines: [[Glyph]] = []
    for glyph in sorted {
      if let reference = lines.last?.first?.y, abs(reference - glyph.y) <= 2.5 {
        lines[lines.count - 1].append(glyph)
      } else {
        lines.append([glyph])
      }
    }
    var raw: [(str: String, x: Double, y: Double, w: Double)] = []
    for line in lines {
      let glyphs = line.sorted { $0.x < $1.x }
      let y = glyphs.first?.y ?? 0
      var str = ""
      var x = 0.0
      var end = 0.0
      var open = false
      func flush() {
        if open, !str.trimmingCharacters(in: .whitespaces).isEmpty {
          raw.append((str, x, y, end - x))
        }
        str = ""
        open = false
      }
      for glyph in glyphs {
        if !open {
          str = glyph.character
          x = glyph.x
          end = glyph.x + glyph.w
          open = true
        } else if glyph.x - end <= 0.8 {
          str += glyph.character
          end = max(end, glyph.x + glyph.w)
        } else {
          flush()
          str = glyph.character
          x = glyph.x
          end = glyph.x + glyph.w
          open = true
        }
      }
      flush()
    }
    return raw
  }
}
