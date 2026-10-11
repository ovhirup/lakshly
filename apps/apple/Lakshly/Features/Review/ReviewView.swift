import SwiftUI
#if os(iOS)
import UIKit
#endif

/// Weekly review inbox: confirm each new spend's category and Need/Want/Vice in seconds. Free, works offline.
/// Every input path (swipe, buttons, long-press menu, keys, VoiceOver actions) goes through `store.applyReview`.
struct ReviewView: View {
  @Environment(\.theme) private var theme
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(\.setupRendering) private var rendering
  let store: DataStore
  /// DEBUG shots only: preview a swipe offset or an open editor without gestures.
  var previewSwipe: (id: String, offset: CGFloat)? = nil
  var previewEditing: String? = nil
  @State private var selection: String?
  @State private var editing: String?
  @State private var toast: String?
  @State private var toastUndo = false
  @State private var askConfirmAll = false
  @State private var showOlder = false
  @State private var celebrate: String?
  @FocusState private var focused: Bool

  private var inbox: ReviewInbox { store.reviewInbox }
  private var state: ReviewState { store.reviewState }
  private var now: Date { store.reviewNow }
  private var wide: Bool {
    #if os(macOS)
    true
    #else
    false
    #endif
  }

  var body: some View {
    Page(title: "Weekly review", subtitle: subtitle) {
      header
      if inbox.count == 0 {
        done
      } else if wide {
        HStack(alignment: .top, spacing: 16) {
          list.frame(maxWidth: .infinity)
          editorPane.frame(width: 320)
        }
      } else {
        list
      }
      if !inbox.older.isEmpty { older }
      WorthItCard(store: store)
      Text("Swipe right to confirm, left to change. Long-press for Need, Want, Vice and Skip.\(wide ? " Keys: ↑/↓ or J/K move, Return confirm, E change, 1/2/3 Need/Want/Vice, S skip, W/Q worth it, ⌘Z undo." : "")")
        .font(.caption).foregroundStyle(theme.secondaryText)
    }
    .overlay(alignment: .bottom) { toastView }
    .confirmationDialog("Confirm \(inbox.count) items?", isPresented: $askConfirmAll, titleVisibility: .visible) {
      Button("Confirm \(inbox.count) · +\(inbox.count) XP") { act(.confirmAll) }
      Button("Cancel", role: .cancel) {}
    }
    #if os(iOS)
    .sheet(item: Binding(get: { editing.flatMap { id in row(id) } }, set: { editing = $0?.id })) { row in
      NavigationStack {
        ScrollView { ReviewEditor(row: row, onSave: save(row), onCancel: { editing = nil }).padding(20) }
          .navigationTitle(row.tx.name)
          .navigationBarTitleDisplayMode(.inline)
      }
      .presentationDetents([.medium, .large])
      .environment(\.theme, theme)
    }
    #endif
    #if os(macOS)
    .focusable()
    .focused($focused)
    .focusEffectDisabled()
    .onKeyPress(phases: .down) { press in key(press) }
    .background {
      Group {
        Button("Undo") { undo() }.keyboardShortcut("z", modifiers: .command)
        Button("Confirm all") { if inbox.count > 0 { askConfirmAll = true } }.keyboardShortcut(.return, modifiers: [.command, .shift])
      }.opacity(0).accessibilityHidden(true)
    }
    .onAppear { focused = true; selection = selection ?? inbox.rows.first?.id }
    #endif
    .onAppear { store.publishReviewGlance() }
    .accessibilityIdentifier("review.screen")
  }

  private var subtitle: String {
    inbox.count == 0 ? "Inbox zero ✨" : "This week · \(Review.countLabel(inbox.count)) to review"
  }

  // MARK: Header (streak, XP, level)

  private var header: some View {
    let level = Review.level(for: state.xp)
    return HStack(alignment: .center, spacing: 14) {
      VStack(alignment: .leading, spacing: 6) {
        Text("Week \(ReviewDates.weekNumber(inbox.week))").font(.caption.weight(.semibold)).foregroundStyle(theme.secondaryText)
        Text(Review.streakText(state, now: now)).font(.headline)
          .accessibilityIdentifier("review.streak")
        HStack(spacing: 8) {
          Text("Level \(level.current.level) · \(level.current.name)").font(.subheadline.weight(.semibold))
          Text("\(state.xp) XP").font(.subheadline).foregroundStyle(theme.gold).monospacedDigit()
            .accessibilityIdentifier("review.xp")
        }
        ProgressView(value: level.progress).tint(theme.gold)
          .accessibilityLabel(level.next.map { "\($0.minXP - state.xp) XP to \($0.name)" } ?? "Top level reached")
        Text("This week \(state.weekXP[inbox.week] ?? 0) of \(ReviewRules.weeklyCap) review XP · +1 confirm, +2 change, +15 week cleared")
          .font(.caption).foregroundStyle(theme.secondaryText)
      }
      Spacer(minLength: 0)
      if inbox.count > 0 {
        Button("Confirm all") { askConfirmAll = true }
          .buttonStyle(ThemedSubmitStyle())
          .accessibilityIdentifier("review.confirmAll")
      }
    }.modifier(GlassCard())
  }

  // MARK: Rows

  private var groups: [(day: String, rows: [InboxRow])] {
    var out: [(String, [InboxRow])] = []
    for r in inbox.rows {
      if let i = out.firstIndex(where: { $0.0 == r.tx.date }) { out[i].1.append(r) } else { out.append((r.tx.date, [r])) }
    }
    return out.map { (day: $0.0, rows: $0.1) }
  }

  private var list: some View {
    VStack(alignment: .leading, spacing: 10) {
      ForEach(groups, id: \.day) { group in
        Text(ReviewFormat.day(group.day)).font(.caption.weight(.semibold)).foregroundStyle(theme.secondaryText)
          .padding(.top, 4).accessibilityAddTraits(.isHeader)
        ForEach(group.rows) { r in
          ReviewRow(
            row: r, worth: state.worth[r.id], selected: wide && selection == r.id,
            previewOffset: previewSwipe?.id == r.id ? previewSwipe?.offset : nil,
            act: act, edit: { startEdit(r) }
          )
          .onTapGesture { selection = r.id }
          .transition(reduceMotion ? .opacity : .asymmetric(insertion: .opacity, removal: .move(edge: .trailing).combined(with: .opacity)))
        }
      }
    }
  }

  @ViewBuilder private var editorPane: some View {
    let current = (previewEditing ?? editing ?? selection).flatMap { row($0) } ?? inbox.rows.first
    if let current {
      VStack(alignment: .leading, spacing: 10) {
        Text(current.tx.name).font(.headline)
        Text(ReviewFormat.day(current.tx.date)).font(.caption).foregroundStyle(theme.secondaryText)
        ReviewEditor(row: current, onSave: save(current), onCancel: { editing = nil }).id(current.id)
      }.modifier(GlassCard())
    }
  }

  private var older: some View {
    DisclosureGroup(isExpanded: $showOlder) {
      VStack(spacing: 10) {
        ForEach(inbox.older) { r in
          ReviewRow(row: r, worth: state.worth[r.id], selected: false, previewOffset: nil, act: act, edit: { startEdit(r) })
        }
        Text("Older imports can be confirmed but earn no XP.").font(.caption).foregroundStyle(theme.secondaryText)
      }.padding(.top, 8)
    } label: {
      Text("Older imports (\(inbox.older.count))").font(.subheadline.weight(.semibold))
    }.modifier(GlassCard())
  }

  // MARK: Completion

  private var done: some View {
    let clearedThisWeek = state.lastClearedWeek == inbox.week
    return VStack(spacing: 12) {
      if !reduceMotion { Confetti().frame(height: 70).accessibilityHidden(true) }
      Text(celebrate ?? (clearedThisWeek ? "Inbox zero. Week \(ReviewDates.weekNumber(inbox.week)) done ✨" : "Nothing new to review ✨"))
        .font(.system(.title2, design: .rounded, weight: .bold)).multilineTextAlignment(.center)
        .accessibilityIdentifier("review.done")
      Text(Review.streakText(state, now: now)).font(.headline).foregroundStyle(theme.gold)
      Text("Come back next week. New spends show up here on their own.")
        .font(.subheadline).foregroundStyle(theme.secondaryText).multilineTextAlignment(.center)
    }.frame(maxWidth: .infinity).modifier(GlassCard())
  }

  @ViewBuilder private var toastView: some View {
    if let toast, !rendering {
      HStack(spacing: 12) {
        Text(toast).font(.subheadline).lineLimit(2)
        if toastUndo { Button("Undo") { undo() }.fontWeight(.semibold).accessibilityIdentifier("review.undo") }
      }
      .padding(.horizontal, 16).padding(.vertical, 12)
      .background(theme.surface, in: Capsule())
      .overlay(Capsule().strokeBorder(theme.gold.opacity(0.35)))
      .padding(.bottom, 20)
      .transition(.opacity)
    }
  }

  // MARK: Actions

  private func row(_ id: String) -> InboxRow? { (inbox.rows + inbox.older).first { $0.id == id } }

  private func startEdit(_ r: InboxRow) {
    if r.refund {
      act(.confirm(r.id))
      return
    }
    selection = r.id
    editing = r.id
  }

  private func save(_ r: InboxRow) -> (String, Nwv?, Bool) -> Void {
    { category, nwv, remember in
      editing = nil
      act(.change(r.id, category: category, nwv: nwv, rememberMerchant: remember))
    }
  }

  private func act(_ action: ReviewAction) {
    let next = nextSelection(after: action)
    let update = { _ = apply(action) }
    if reduceMotion { update() } else { withAnimation(.easeInOut(duration: 0.2), update) }
    selection = next
  }

  private func apply(_ action: ReviewAction) -> ReviewResult {
    let r = store.applyReview(action)
    if r.cleared { celebrate = r.message }
    feedback(success: r.cleared)
    if !r.message.isEmpty {
      AccessibilityNotification.Announcement(r.message).post()
      show(r.message, undo: { if case .skip = action { return false }; if case .snooze = action { return false }; return true }())
    }
    return r
  }

  private func nextSelection(after action: ReviewAction) -> String? {
    let ids = inbox.rows.map(\.id)
    let target: String? = switch action {
    case .confirm(let id, _), .change(let id, _, _, _), .skip(let id): id
    default: nil
    }
    guard let target, let i = ids.firstIndex(of: target) else { return selection }
    let rest = ids.filter { $0 != target }
    return rest.isEmpty ? nil : rest[min(i, rest.count - 1)]
  }

  private func undo() {
    guard let message = store.undoReview() else { return }
    celebrate = nil
    AccessibilityNotification.Announcement(message).post()
    show(message, undo: false)
  }

  private func show(_ message: String, undo: Bool) {
    toast = message
    toastUndo = undo
    let current = message
    DispatchQueue.main.asyncAfter(deadline: .now() + ReviewRules.undoSeconds) {
      if toast == current { toast = nil }
    }
  }

  private func feedback(success: Bool) {
    #if os(iOS)
    if success { UINotificationFeedbackGenerator().notificationOccurred(.success) }
    else { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    #endif
  }

  #if os(macOS)
  private func key(_ press: KeyPress) -> KeyPress.Result {
    guard editing == nil || press.key == .escape else { return .ignored }
    let ids = inbox.rows.map(\.id)
    let index = selection.flatMap { ids.firstIndex(of: $0) } ?? 0
    let current = ids.isEmpty ? nil : row(ids[min(index, ids.count - 1)])
    switch press.key {
    case .downArrow: selection = ids.isEmpty ? nil : ids[min(index + 1, ids.count - 1)]; return .handled
    case .upArrow: selection = ids.isEmpty ? nil : ids[max(index - 1, 0)]; return .handled
    case .return:
      guard press.modifiers.isEmpty, let current else { return .ignored }
      act(.confirm(current.id)); return .handled
    case .escape: editing = nil; return .handled
    default: break
    }
    guard press.modifiers.subtracting(.shift).isEmpty, let ch = press.characters.lowercased().first else { return .ignored }
    switch ch {
    case "j": selection = ids.isEmpty ? nil : ids[min(index + 1, ids.count - 1)]
    case "k": selection = ids.isEmpty ? nil : ids[max(index - 1, 0)]
    case "e": if let current { startEdit(current) }
    case "1", "2", "3":
      guard let current else { return .ignored }
      act(.confirm(current.id, nwv: current.refund ? nil : [Nwv.need, .want, .vice][Int(String(ch))! - 1]))
    case "s": if let current { act(.skip(current.id)) }
    case "w", "q":
      guard let current, current.ratable else { return .ignored }
      let value: Worth = ch == "w" ? .yes : .no
      _ = apply(.rate(current.id, state.worth[current.id] == value ? nil : value))
    default: return .ignored
    }
    return .handled
  }
  #endif
}

enum ReviewFormat {
  static func day(_ ymd: String) -> String {
    guard let d = ReviewDates.ymd(ymd) else { return ymd }
    let f = DateFormatter()
    f.timeZone = TimeZone(identifier: "UTC")
    f.locale = Locale(identifier: "en_IN")
    f.dateFormat = "EEE d MMM"
    return f.string(from: d)
  }
  static func longDay(_ ymd: String) -> String {
    guard let d = ReviewDates.ymd(ymd) else { return ymd }
    let f = DateFormatter()
    f.timeZone = TimeZone(identifier: "UTC")
    f.locale = Locale(identifier: "en_IN")
    f.dateFormat = "d MMMM"
    return f.string(from: d)
  }
  static func amount(_ r: InboxRow) -> String {
    r.refund ? "+" + Money.format(r.tx.amount) : Money.format(abs(r.tx.amount))
  }
}

/// One inbox row. Swipe right = Confirm, swipe left = Change; buttons are always visible too.
struct ReviewRow: View {
  @Environment(\.theme) private var theme
  @Environment(\.privacy) private var privacy
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  let row: InboxRow
  let worth: Worth?
  let selected: Bool
  let previewOffset: CGFloat?
  let act: (ReviewAction) -> Void
  let edit: () -> Void
  @State private var drag: CGFloat = 0
  @State private var width: CGFloat = 360

  private var offset: CGFloat { previewOffset ?? drag }
  private var threshold: CGFloat { min(80, width * 0.35) }

  var body: some View {
    ZStack {
      swipeBackground
      content
        .offset(x: offset)
        .gesture(
          DragGesture(minimumDistance: 20)
            .onChanged { v in if abs(v.translation.width) > abs(v.translation.height) { drag = v.translation.width } }
            .onEnded { _ in
              let d = drag
              withAnimation(reduceMotion ? nil : .spring(duration: 0.25)) { drag = 0 }
              if d > threshold { act(.confirm(row.id)) } else if d < -threshold { edit() }
            }
        )
    }
    .background(GeometryReader { g in Color.clear.onAppear { width = g.size.width } })
    .contextMenu {
      Button("Confirm", systemImage: "checkmark") { act(.confirm(row.id)) }
      if !row.refund {
        Button("Change", systemImage: "square.and.pencil") { edit() }
        ForEach(Nwv.allCases, id: \.self) { n in Button("Mark \(n.label)") { act(.confirm(row.id, nwv: n)) } }
      }
      Button("Skip", systemImage: "arrow.down.to.line") { act(.skip(row.id)) }
      if row.ratable {
        Button("Worth it", systemImage: "hand.thumbsup") { act(.rate(row.id, worth == .yes ? nil : .yes)) }
        Button("Not really", systemImage: "hand.thumbsdown") { act(.rate(row.id, worth == .no ? nil : .no)) }
      }
    }
    .accessibilityElement(children: .combine)
    .accessibilityLabel(label)
    .accessibilityAction(named: "Confirm") { act(.confirm(row.id)) }
    .modifier(RowActions(row: row, worth: worth, act: act, edit: edit))
    .accessibilityIdentifier("review.row.\(row.id)")
  }

  private var label: String {
    let amount = privacy.masked ? Money.hiddenLabel : ReviewFormat.amount(row)
    let tag = row.suggestion.nwv.map { ", \($0.label)" } ?? ", Refund"
    return "\(row.tx.name), \(ReviewFormat.longDay(row.tx.date)), \(Review.title(row.suggestion.category))\(tag), \(amount). Suggested."
  }

  @ViewBuilder private var swipeBackground: some View {
    if offset > 0 {
      HStack {
        Label("Confirm", systemImage: "checkmark.circle.fill").font(.subheadline.weight(.bold)).padding(.leading, 20)
        Spacer()
      }
      .foregroundStyle(.white)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(theme.income.opacity(offset > threshold ? 1 : 0.7), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    } else if offset < 0 {
      HStack {
        Spacer()
        Label("Change", systemImage: "square.and.pencil").font(.subheadline.weight(.bold)).padding(.trailing, 20)
      }
      .foregroundStyle(.black)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(theme.gold.opacity(offset < -threshold ? 1 : 0.7), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }
  }

  private var content: some View {
    VStack(alignment: .leading, spacing: 10) {
      HStack(alignment: .firstTextBaseline) {
        Text(row.tx.name).font(.headline).lineLimit(2)
        Spacer(minLength: 8)
        MoneyText(ReviewFormat.amount(row)).font(.headline).monospacedDigit()
          .foregroundStyle(row.refund ? theme.income : theme.text)
      }
      HStack(spacing: 6) {
        CategoryChip(category: row.suggestion.category)
        NwvChip(nwv: row.suggestion.nwv)
        if row.ratable { WorthChips(worth: worth) { act(.rate(row.id, $0)) } }
        Spacer(minLength: 0)
      }
      HStack(spacing: 8) {
        Button { act(.confirm(row.id)) } label: { Label("Confirm", systemImage: "checkmark") }
          .buttonStyle(ReviewButtonStyle(fill: theme.gold, text: .black))
          .accessibilityIdentifier("review.confirm.\(row.id)")
        if !row.refund {
          Button { edit() } label: { Label("Change", systemImage: "square.and.pencil") }
            .buttonStyle(ReviewButtonStyle(fill: theme.secondaryText.opacity(0.16), text: theme.text))
        } else {
          Text("Refunds can only be confirmed.").font(.caption).foregroundStyle(theme.secondaryText)
        }
        Spacer(minLength: 0)
      }
    }
    .padding(16)
    .background(theme.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    .overlay {
      RoundedRectangle(cornerRadius: 20, style: .continuous)
        .strokeBorder(selected ? theme.gold : theme.secondaryText.opacity(0.15), lineWidth: selected ? 2 : 1)
    }
  }
}

private struct RowActions: ViewModifier {
  let row: InboxRow
  let worth: Worth?
  let act: (ReviewAction) -> Void
  let edit: () -> Void
  func body(content: Content) -> some View {
    if row.refund {
      content.accessibilityAction(named: "Skip") { act(.skip(row.id)) }
    } else {
      content
        .accessibilityAction(named: "Change category") { edit() }
        .accessibilityAction(named: "Mark Need") { act(.confirm(row.id, nwv: .need)) }
        .accessibilityAction(named: "Mark Want") { act(.confirm(row.id, nwv: .want)) }
        .accessibilityAction(named: "Mark Vice") { act(.confirm(row.id, nwv: .vice)) }
        .accessibilityAction(named: "Skip") { act(.skip(row.id)) }
        .modifier(WorthActions(row: row, worth: worth, act: act))
    }
  }
}

private struct WorthActions: ViewModifier {
  let row: InboxRow
  let worth: Worth?
  let act: (ReviewAction) -> Void
  func body(content: Content) -> some View {
    if row.ratable {
      content
        .accessibilityAction(named: worth == .yes ? "Clear worth it" : "Worth it") { act(.rate(row.id, worth == .yes ? nil : .yes)) }
        .accessibilityAction(named: worth == .no ? "Clear not really" : "Not really") { act(.rate(row.id, worth == .no ? nil : .no)) }
    } else {
      content
    }
  }
}

struct ReviewButtonStyle: ButtonStyle {
  let fill: Color
  let text: Color
  func makeBody(configuration: Configuration) -> some View {
    configuration.label.font(.subheadline.weight(.semibold))
      .padding(.horizontal, 14).frame(minHeight: 44)
      .foregroundStyle(text)
      .background(fill.opacity(configuration.isPressed ? 0.7 : 1), in: Capsule())
  }
}

struct CategoryChip: View {
  @Environment(\.theme) private var theme
  let category: String
  var body: some View {
    HStack(spacing: 5) {
      Circle().fill(theme.category(category)).frame(width: 8, height: 8)
      Text(Review.title(category))
    }
    .font(.caption.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 6)
    .background(theme.secondaryText.opacity(0.12), in: Capsule())
  }
}

/// Icon + text, never colour alone.
struct NwvChip: View {
  @Environment(\.theme) private var theme
  let nwv: Nwv?
  var body: some View {
    Text(nwv.map { "\($0.icon) \($0.label)" } ?? "↩︎ Refund")
      .font(.caption.weight(.semibold)).padding(.horizontal, 10).padding(.vertical, 6)
      .background(theme.gold.opacity(0.16), in: Capsule())
  }
}

struct WorthChips: View {
  @Environment(\.theme) private var theme
  let worth: Worth?
  let rate: (Worth?) -> Void
  var body: some View {
    HStack(spacing: 4) {
      chip("👍", .yes, "Worth it")
      chip("👎", .no, "Not really")
    }
  }
  private func chip(_ icon: String, _ value: Worth, _ name: String) -> some View {
    Button { rate(worth == value ? nil : value) } label: {
      Text(icon).font(.callout).frame(minWidth: 36, minHeight: 32)
        .background((worth == value ? theme.gold.opacity(0.35) : theme.secondaryText.opacity(0.10)), in: Capsule())
        .overlay(Capsule().strokeBorder(worth == value ? theme.gold : .clear, lineWidth: 1.5))
    }
    .buttonStyle(.plain)
    .frame(minHeight: 44)
    .accessibilityLabel(name)
    .accessibilityAddTraits(.isToggle)
    .accessibilityAddTraits(worth == value ? .isSelected : [])
  }
}

/// Change sheet (iPhone) or editor pane (Mac): category grid, Need/Want/Vice, Remember for merchant.
struct ReviewEditor: View {
  @Environment(\.theme) private var theme
  let row: InboxRow
  let onSave: (String, Nwv?, Bool) -> Void
  let onCancel: () -> Void
  @State private var category: String
  @State private var nwv: Nwv
  @State private var remember = false

  init(row: InboxRow, onSave: @escaping (String, Nwv?, Bool) -> Void, onCancel: @escaping () -> Void) {
    self.row = row
    self.onSave = onSave
    self.onCancel = onCancel
    _category = State(initialValue: ReviewRules.categories.contains(row.suggestion.category) ? row.suggestion.category : "other")
    _nwv = State(initialValue: row.suggestion.nwv ?? .want)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      if row.refund {
        Text("Refunds can only be confirmed.").font(.subheadline).foregroundStyle(theme.secondaryText)
      } else {
        Text("Category").font(.caption.weight(.semibold)).foregroundStyle(theme.secondaryText)
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], spacing: 8) {
          ForEach(ReviewRules.categories, id: \.self) { c in
            Button { category = c } label: {
              HStack(spacing: 5) {
                Circle().fill(theme.category(c)).frame(width: 8, height: 8)
                Text(Review.title(c)).lineLimit(1).minimumScaleFactor(0.8)
                Spacer(minLength: 0)
              }
              .font(.caption.weight(.semibold)).padding(.horizontal, 10).frame(minHeight: 36)
              .background(category == c ? theme.gold.opacity(0.3) : theme.secondaryText.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
              .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(category == c ? theme.gold : .clear, lineWidth: 1.5))
            }
            .buttonStyle(.plain)
            .accessibilityAddTraits(category == c ? .isSelected : [])
          }
        }
        Text("Need, Want or Vice").font(.caption.weight(.semibold)).foregroundStyle(theme.secondaryText)
        Picker("Need, Want or Vice", selection: $nwv) {
          ForEach(Nwv.allCases, id: \.self) { n in Text("\(n.icon) \(n.label)").tag(n) }
        }.pickerStyle(.segmented).labelsHidden()
        Toggle("Remember for \(row.tx.name)", isOn: $remember)
        HStack(spacing: 8) {
          Button("Save · +\(ReviewRules.xpChange) XP") { onSave(category, nwv, remember) }
            .buttonStyle(ThemedSubmitStyle())
            .accessibilityIdentifier("review.save")
          Button("Cancel", action: onCancel).buttonStyle(.plain).frame(minHeight: 44)
        }
      }
    }
  }
}

/// Celebration on inbox zero. Skipped entirely under Reduce Motion.
struct Confetti: View {
  @State private var fall = false
  private let pieces = ["✨", "🪷", "🎉", "✨", "🌟", "🪙", "✨", "🎊"]
  var body: some View {
    HStack(spacing: 18) {
      ForEach(Array(pieces.enumerated()), id: \.offset) { i, p in
        Text(p).font(.title2)
          .offset(y: fall ? CGFloat((i % 3) * 10) : -20)
          .opacity(fall ? 1 : 0)
          .animation(.spring(duration: 0.8).delay(Double(i) * 0.05), value: fall)
      }
    }
    .onAppear { fall = true }
  }
}

/// Worth-it month card: ratio as % only (never amounts) and a gentle suggestion for regretted merchants.
struct WorthItCard: View {
  @Environment(\.theme) private var theme
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore
  var compact = false
  var body: some View {
    let txns = store.reviewTransactions
    let state = store.reviewState
    let now = store.reviewNow
    let month = txns.filter { state.worth[$0.id] != nil }.map { String($0.date.prefix(7)) }.max()
      ?? String(ReviewDates.localDate(now).prefix(7))
    let ratio = Review.monthlyRatio(txns, state, month: month)
    let regrets = Review.regretMerchants(txns, state, now: now)
    let snoozed = { (m: String) in state.snoozed[m].flatMap(ReviewDates.parse).map { $0 > now } ?? false }
    let regret = ratio.ratio != nil ? regrets.first { !snoozed($0) } : nil
    let category = regret.flatMap { r in txns.first { $0.name == r }?.category }
    let quest = regret.map { Review.questFor($0, category: category, premium: entitlements.isPremium) }
    let noCount = regret.map { r in txns.filter { $0.name == r && state.worth[$0.id] == .no }.count } ?? 0
    return Card(title: "Worth-it ratio · \(ReviewFormat.month(month))") {
      if let value = ratio.ratio {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
          MoneyText("\(Int((value * 100).rounded()))%").font(.system(size: 34, weight: .bold, design: .rounded))
            .foregroundStyle(theme.gold)
          Text("(\(ratio.rated) rated)").font(.subheadline).foregroundStyle(theme.secondaryText)
        }.accessibilityIdentifier("review.worthRatio")
      } else {
        Text(ratio.rated > 0 ? "\(ratio.rated) rated · Rate a few more to see your ratio" : "Not rated yet · Rate a few more to see your ratio")
          .font(.subheadline)
      }
      if !compact {
        Text("Tap 👍 or 👎 on Wants and Vices while you review. No XP, no judgement: it's just for you.")
          .font(.caption).foregroundStyle(theme.secondaryText)
      }
      if let quest = state.quest, Review.questWaiting(quest, today: ReviewDates.localDate(now)) {
        Text("3-day wait on \(quest.merchant) until \(ReviewFormat.longDay(quest.until)).").font(.subheadline)
        Button("Clear the wait") { store.applyReview(.clearQuest) }.buttonStyle(.plain).frame(minHeight: 44)
      } else if state.quest == nil, let regret, let quest {
        Text("You've said ‘not really’ to \(regret) \(noCount) times. Try \(quest.title)?").font(.subheadline)
        HStack(spacing: 8) {
          if quest.id == .wishlistThree || quest.id == .custom {
            Button("Start the 3-day wait") {
              store.applyReview(.startQuest(merchant: regret, until: Review.wishlistUntil(ReviewDates.localDate(now))))
            }.buttonStyle(ThemedSubmitStyle())
          }
          Button("Not now") {
            store.applyReview(.snooze(merchant: regret, until: ReviewDates.isoLocal(now.addingTimeInterval(30 * 86_400))))
          }.buttonStyle(.plain).frame(minHeight: 44)
        }
        Text(quest.id == .wishlistThree || quest.id == .custom
          ? "On this device. Nothing is sent."
          : "Quests are coming soon. We only ever suggest one for merchants you said you regret.")
          .font(.caption).foregroundStyle(theme.secondaryText)
      }
    }
  }
}

extension ReviewFormat {
  static func month(_ ym: String) -> String {
    guard let d = ReviewDates.ymd(ym + "-01") else { return ym }
    let f = DateFormatter()
    f.timeZone = TimeZone(identifier: "UTC")
    f.locale = Locale(identifier: "en_IN")
    f.dateFormat = "MMM yyyy"
    return f.string(from: d)
  }
}

/// Overview entry card: "This week · 10 to review · 🔥 2-week streak" with a Review button.
struct ReviewEntryCard: View {
  @Environment(\.theme) private var theme
  let store: DataStore
  let open: () -> Void
  var body: some View {
    let inbox = store.reviewInbox
    let state = store.reviewState
    let level = Review.level(for: state.xp)
    HStack(alignment: .center, spacing: 12) {
      VStack(alignment: .leading, spacing: 4) {
        Text("This week · Week \(ReviewDates.weekNumber(inbox.week))").font(.caption.weight(.semibold)).foregroundStyle(theme.secondaryText)
        Text(inbox.count > 0 ? "\(Review.countLabel(inbox.count)) to review" : "Inbox zero ✨")
          .font(.system(.title3, design: .rounded, weight: .bold))
        Text("\(Review.streakText(state, now: store.reviewNow)) · Level \(level.current.level) \(level.current.name) · \(state.xp) XP")
          .font(.caption).foregroundStyle(theme.secondaryText)
      }
      Spacer(minLength: 8)
      Button(inbox.count > 0 ? "Review" : "Open review", action: open)
        .buttonStyle(ThemedSubmitStyle())
        .accessibilityIdentifier("overview.review")
    }.modifier(GlassCard())
  }
}

/// Spend header chip: "10 to review →" or "Inbox zero ✨".
struct ReviewChip: View {
  @Environment(\.theme) private var theme
  let store: DataStore
  let open: () -> Void
  var body: some View {
    let n = store.reviewInbox.count
    Button(action: open) {
      Text(n > 0 ? "\(Review.countLabel(n)) to review →" : "Inbox zero ✨ →")
        .font(.subheadline.weight(.semibold)).padding(.horizontal, 14).frame(minHeight: 44)
        .background(theme.gold.opacity(0.18), in: Capsule())
    }
    .buttonStyle(.plain)
    .accessibilityLabel(n > 0 ? "\(n) to review" : "Inbox zero")
    .accessibilityIdentifier("spend.reviewChip")
  }
}
