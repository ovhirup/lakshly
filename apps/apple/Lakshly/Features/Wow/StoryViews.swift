import SwiftUI
#if os(iOS)
import UIKit
#elseif os(macOS)
import AppKit
#endif

/// Latest-month story on Overview. Free (`Feature.story`).
struct StoryCard: View {
  @Environment(\.theme) private var theme
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore
  @State private var open = false

  var body: some View {
    if entitlements.can(.story), let month = store.months.last {
      card(StoryReading.build(store, month: month))
        .sheet(isPresented: $open) { StoryPager(store: store) }
    }
  }

  private func card(_ story: MonthlyStory) -> some View {
    Card(title: "\(story.label) story") {
      Text(story.win)
        .font(.headline)
        .fixedSize(horizontal: false, vertical: true)
        .accessibilityIdentifier("wow.story.win")
      HStack(alignment: .top, spacing: 8) {
        mini("Spend change", tile(story, "Spend vs last month"), slug: "wow.story.spendChange")
        mini("Wants share", tile(story, "Wants share"), slug: "wow.story.wantsShare")
        mini("Budgets kept", tile(story, "Budgets kept"), slug: "wow.story.budgetsKept")
      }
      Button("Open story") { open = true }
        .buttonStyle(ThemedSubmitStyle())
        .accessibilityIdentifier("wow.story.open")
        .accessibilityHint("Opens the monthly story")
    }
    .accessibilityIdentifier("wow.story.card")
  }

  private func tile(_ story: MonthlyStory, _ label: String) -> String {
    Story.shareTiles(story).first { $0.label == label }?.value ?? "—"
  }

  private func mini(_ title: String, _ value: String, slug: String) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .font(.caption)
        .foregroundStyle(theme.secondaryText)
      MoneyText(value)
        .font(.subheadline.weight(.semibold))
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(10)
    .background(theme.surface.opacity(0.55), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    .accessibilityElement(children: .combine)
    .accessibilityIdentifier(slug)
  }
}

/// One slide at a time. Month chips and the share image sit here. No paging container, so it can render offscreen.
struct StoryPager: View {
  @Environment(\.theme) private var theme
  @Environment(\.privacy) private var privacy
  @Environment(\.colorScheme) private var colorScheme
  @Environment(\.dismiss) private var dismiss
  @Environment(EntitlementStore.self) private var entitlements
  let store: DataStore
  @State private var month: String
  @State private var index = 0
  @State private var showPaywall = false
  @State private var shareURL: URL?

  init(store: DataStore) {
    self.store = store
    _month = State(initialValue: store.months.last ?? "")
  }

  private var story: MonthlyStory { StoryReading.build(store, month: month) }
  private var slides: [StorySlide] { Story.slides(story) }
  private var slide: StorySlide {
    let rows = slides
    guard !rows.isEmpty else { return StorySlide(id: "empty", label: "Story", headline: "No story yet", detail: "") }
    return rows[min(max(0, index), rows.count - 1)]
  }

  var body: some View {
    VStack(alignment: .leading, spacing: theme.spacious ? 20 : 16) {
      HStack(alignment: .firstTextBaseline) {
        Text("\(story.label) story")
          .font(.system(.title2, design: .rounded, weight: .bold))
          .fixedSize(horizontal: false, vertical: true)
        Spacer(minLength: 8)
        Button("Done") { dismiss() }
          .frame(minHeight: 44)
          .accessibilityIdentifier("wow.story.done")
      }
      chips
      slideBody
      controls
      PremiumGate(
        feature: .storyShare,
        title: "Share your story",
        message: "Pick any past month and share a story card. The image shows percentages only, never amounts.",
        seePremiumIdentifier: "wow.storyShare.seePremium"
      ) {
        shareControl
          .task(id: month) { refreshShare() }
      }
      .accessibilityIdentifier("wow.storyShare.gate")
    }
    .padding(24)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    #if os(macOS)
    .frame(minWidth: 420, minHeight: 640)
    #endif
    .background { ThemeBackground() }
    .accessibilityIdentifier("wow.story.pager")
    .presentationDetents([.large])
    .sheet(isPresented: $showPaywall) { PaywallView(context: .feature(.storyShare)) }
    .onChange(of: month) { _, _ in
      index = 0
      refreshShare()
    }
  }

  private var chips: some View {
    VStack(alignment: .leading, spacing: 8) {
      ForEach(Array(chipRows.enumerated()), id: \.offset) { _, row in
        HStack(spacing: 8) {
          ForEach(row, id: \.self) { item in
            chip(item)
          }
          Spacer(minLength: 0)
        }
      }
    }
    .accessibilityIdentifier("wow.story.months")
  }

  private var chipRows: [[String]] {
    let months = store.months
    var rows: [[String]] = []
    var cursor = 0
    while cursor < months.count {
      let end = min(cursor + 3, months.count)
      rows.append(Array(months[cursor..<end]))
      cursor = end
    }
    return rows
  }

  private func chip(_ item: String) -> some View {
    let open = StoryMonths.isOpen(item, months: store.months, tier: entitlements.tier)
    let selected = item == month
    let name = chipName(item)
    return Button {
      if open {
        month = item
      } else {
        showPaywall = true
      }
    } label: {
      HStack(spacing: 4) {
        if !open {
          Image(systemName: "lock.fill")
            .font(.caption2)
            .accessibilityHidden(true)
        }
        Text(name)
          .font(.subheadline.weight(.semibold))
      }
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .frame(minHeight: 44)
      .foregroundStyle(open ? theme.text : theme.secondaryText)
      .background((selected ? theme.gold : theme.surface).opacity(selected ? 0.22 : 0.7), in: Capsule())
      .overlay {
        Capsule().strokeBorder(selected ? theme.gold : theme.secondaryText.opacity(0.35), lineWidth: 1)
      }
    }
    .buttonStyle(.plain)
    .accessibilityLabel(open ? name : "\(name), locked")
    .accessibilityHint(open ? "Shows this month" : "Opens Lakshly Premium")
    .accessibilityAddTraits(selected ? .isSelected : [])
    .accessibilityIdentifier("wow.story.month.\(item)")
  }

  private var slideBody: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(slide.label)
        .font(.caption.weight(.semibold))
        .foregroundStyle(theme.gold)
      Text(slide.headline)
        .font(.system(.largeTitle, design: .rounded, weight: .bold))
        .fixedSize(horizontal: false, vertical: true)
        .minimumScaleFactor(0.6)
      if !slide.detail.isEmpty {
        Text(slide.detail)
          .font(.title3)
          .foregroundStyle(theme.secondaryText)
          .fixedSize(horizontal: false, vertical: true)
      }
      amountBlock
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(20)
    .background(theme.surface.opacity(0.92), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    .accessibilityElement(children: .contain)
    .accessibilityIdentifier("wow.story.slide.\(slide.id)")
  }

  @ViewBuilder private var amountBlock: some View {
    switch slide.id {
    case "intro":
      amountLine("Spent", story.spendPaise)
    case "category":
      if story.topCategory.paise > 0 { amountLine("Spent", story.topCategory.paise) }
    case "want":
      if let want = story.topWant { amountLine("Spent", want.paise) }
    case "savings":
      if story.incomePaise > 0 { amountLine("Income", story.incomePaise) }
    default:
      EmptyView()
    }
  }

  private func amountLine(_ caption: String, _ paise: Int64) -> some View {
    HStack(alignment: .firstTextBaseline) {
      Text(caption).foregroundStyle(theme.secondaryText)
      Spacer(minLength: 8)
      Text(Money.display(paise, masked: privacy.masked))
        .fontWeight(.semibold)
        .accessibilityLabel(privacy.masked ? Money.hiddenLabel : Money.format(paise))
    }
    .accessibilityIdentifier("wow.story.amount.\(slide.id)")
  }

  private var controls: some View {
    HStack(spacing: 12) {
      Button("Previous") { step(-1) }
        .buttonStyle(.plain)
        .frame(minHeight: 44)
        .disabled(index <= 0)
        .accessibilityIdentifier("wow.story.previous")
      Spacer(minLength: 8)
      dots
      Spacer(minLength: 8)
      Button("Next") { step(1) }
        .buttonStyle(ThemedSubmitStyle())
        .disabled(slides.isEmpty || index >= slides.count - 1)
        .accessibilityIdentifier("wow.story.next")
    }
  }

  private var dots: some View {
    HStack(spacing: 6) {
      ForEach(slides.indices, id: \.self) { dot in
        Circle()
          .fill(dot == boundedIndex ? theme.gold : theme.secondaryText.opacity(0.35))
          .frame(width: dot == boundedIndex ? 8 : 6, height: dot == boundedIndex ? 8 : 6)
      }
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel("Slide \(boundedIndex + 1) of \(max(slides.count, 1))")
    .accessibilityIdentifier("wow.story.dots")
  }

  private var boundedIndex: Int {
    guard !slides.isEmpty else { return 0 }
    return min(max(0, index), slides.count - 1)
  }

  private func step(_ delta: Int) {
    guard !slides.isEmpty else { return }
    index = min(max(0, index + delta), slides.count - 1)
  }

  @ViewBuilder private var shareControl: some View {
    if let shareURL {
      ShareLink(item: shareURL) { Text("Share image") }
        .buttonStyle(ThemedSubmitStyle())
        .accessibilityLabel("Share image")
        .accessibilityHint("Shares a story card with percentages only")
        .accessibilityIdentifier("wow.storyShare.share")
    } else {
      Button("Share image") { refreshShare() }
        .buttonStyle(ThemedSubmitStyle())
        .accessibilityIdentifier("wow.storyShare.share")
    }
  }

  private func refreshShare() {
    guard entitlements.can(.storyShare), !month.isEmpty else {
      shareURL = nil
      return
    }
    let pinned = ThemePalette(theme.id, scheme: colorScheme)
    shareURL = StoryShareFile.write(story, theme: pinned, scheme: colorScheme)
  }

  private func chipName(_ month: String) -> String {
    let parts = month.split(separator: "-")
    guard parts.count == 2, let year = Int(parts[0]), let index = Int(parts[1]), (1...12).contains(index) else {
      return month
    }
    let names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    return "\(names[index - 1]) \(year)"
  }
}

/// 1080×1350 share card. Percentages only: no amounts and no merchant names.
struct StoryShareImage: View {
  @Environment(\.theme) private var theme
  let story: MonthlyStory
  static let width: CGFloat = 1080
  static let height: CGFloat = 1350

  var body: some View {
    let tiles = Story.shareTiles(story)
    VStack(alignment: .leading, spacing: 28) {
      Text("Lakshly · \(story.label)")
        .font(.system(size: 56, weight: .bold, design: .rounded))
        .foregroundStyle(theme.text)
        .fixedSize(horizontal: false, vertical: true)
      VStack(spacing: 20) {
        ForEach(0..<((tiles.count + 1) / 2), id: \.self) { row in
          HStack(spacing: 20) {
            shareTile(tiles[row * 2])
            if row * 2 + 1 < tiles.count {
              shareTile(tiles[row * 2 + 1])
            }
          }
        }
      }
      Spacer(minLength: 12)
      Text("Made with Lakshly · amounts hidden")
        .font(.system(size: 28, weight: .semibold, design: .rounded))
        .foregroundStyle(theme.secondaryText)
    }
    .padding(64)
    .frame(width: Self.width, height: Self.height, alignment: .topLeading)
    .background {
      LinearGradient(
        colors: [theme.bg, theme.lotus.opacity(0.72), theme.gold.opacity(0.55)],
        startPoint: .topLeading,
        endPoint: .bottomTrailing)
    }
    .accessibilityIdentifier("wow.storyShare.image")
  }

  private func shareTile(_ tile: (label: String, value: String)) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(tile.label)
        .font(.system(size: 22, weight: .semibold))
        .foregroundStyle(theme.secondaryText)
      Text(tile.value)
        .font(.system(size: 40, weight: .bold, design: .rounded))
        .foregroundStyle(theme.text)
        .minimumScaleFactor(0.6)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(24)
    .background(theme.surface.opacity(0.92), in: RoundedRectangle(cornerRadius: 28, style: .continuous))
  }
}

@MainActor
enum StoryReading {
  static func build(_ store: DataStore, month: String) -> MonthlyStory {
    Story.build(
      month: month,
      transactions: store.dataset?.transactions ?? [],
      budgets: store.dataset?.budgets ?? [],
      review: store.reviewState,
      reviewTxns: store.reviewTransactions,
      now: store.reviewNow)
  }
}

@MainActor
enum StoryShareFile {
  static func write(_ story: MonthlyStory, theme: ThemePalette, scheme: ColorScheme) -> URL? {
    let view = StoryShareImage(story: story)
      .environment(\.theme, theme)
      .environment(\.colorScheme, scheme)
      .frame(width: StoryShareImage.width, height: StoryShareImage.height)
    let renderer = ImageRenderer(content: view)
    renderer.scale = 2
    renderer.isOpaque = true
    renderer.proposedSize = ProposedViewSize(width: StoryShareImage.width, height: StoryShareImage.height)
    guard let data = pngData(renderer) else { return nil }
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("lakshly-story-\(story.month).png")
    do {
      try data.write(to: url, options: .atomic)
      return url
    } catch {
      return nil
    }
  }

  #if os(iOS)
  private static func pngData<V: View>(_ renderer: ImageRenderer<V>) -> Data? {
    renderer.uiImage?.pngData()
  }
  #else
  private static func pngData<V: View>(_ renderer: ImageRenderer<V>) -> Data? {
    guard let image = renderer.nsImage, let tiff = image.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff) else { return nil }
    return rep.representation(using: .png, properties: [:])
  }
  #endif
}
