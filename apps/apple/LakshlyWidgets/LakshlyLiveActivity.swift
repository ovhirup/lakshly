#if os(iOS) && canImport(ActivityKit)
import ActivityKit
import LakshlyGlance
import SwiftUI
import WidgetKit

struct LakshlyLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: LakshlyActivityAttributes.self) { context in
      let chrome = activityChrome()
      GlanceActivityView(model: model(context), chrome: .lock)
        .environment(\.theme, chrome.palette)
        .modifier(GlanceForcedScheme(scheme: chrome.scheme))
        .activityBackgroundTint(chrome.palette.bg)
        .widgetURL(activityURL(context.attributes.kind))
    } dynamicIsland: { context in
      let chrome = activityChrome()
      let model = model(context)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: model.kind == .budget ? "target" : "calendar")
            .foregroundStyle(chrome.palette.gold)
        }
        DynamicIslandExpandedRegion(.trailing) {
          Text(model.kind == .budget ? GlanceFormat.percent(model.progress * 100) : "Today")
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
        }
        DynamicIslandExpandedRegion(.bottom) {
          GlanceActivityView(model: model, chrome: .expanded)
            .environment(\.theme, chrome.palette)
        }
      } compactLeading: {
        Image(systemName: model.kind == .budget ? "target" : "calendar")
          .foregroundStyle(chrome.palette.gold)
      } compactTrailing: {
        Text(model.kind == .budget ? GlanceFormat.percent(model.progress * 100) : "Today")
          .font(.caption.weight(.bold))
          .foregroundStyle(.white)
          .privacySensitive(model.amount != nil)
      } minimal: {
        Image(systemName: model.kind == .budget ? "target" : "calendar")
          .foregroundStyle(chrome.palette.gold)
      }
      .widgetURL(activityURL(context.attributes.kind))
      .keylineTint(chrome.palette.gold)
    }
  }

  private func model(_ context: ActivityViewContext<LakshlyActivityAttributes>) -> GlanceActivityModel {
    GlanceActivityModel(
      kind: context.attributes.kind == .bill ? .bill : .budget,
      title: context.state.title,
      subtitle: context.state.subtitle,
      progress: context.state.progress,
      amount: context.state.amount)
  }

  private func activityChrome() -> (palette: ThemePalette, scheme: ColorScheme?) {
    GlanceChrome.palette(for: GlanceStore.read())
  }

  private func activityURL(_ kind: LakshlyActivityAttributes.Kind) -> URL? {
    URL(string: kind == .budget ? GlanceWidgetKind.budgetPace.deepLink : GlanceWidgetKind.upcomingBill.deepLink)
  }
}
#endif
