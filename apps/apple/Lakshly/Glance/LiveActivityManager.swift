#if os(iOS) && canImport(ActivityKit)
import ActivityKit
import Foundation
import LakshlyGlance

@MainActor final class LiveActivityManager {
  static let shared = LiveActivityManager()
  private init() {}

  func sync(snapshot: GlanceSnapshot? = nil) {
    let preferences = GlanceStore.preferences
    guard GlancePreferences.liveActivities(in: preferences), ActivityAuthorizationInfo().areActivitiesEnabled else {
      endAll(immediate: true)
      return
    }
    guard let snapshot = snapshot ?? GlanceStore.read() else {
      endAll(immediate: false)
      return
    }
    let month = preferences.string(forKey: GlancePreferences.budgetAlertMonthKey)
    let running = Activity<LakshlyActivityAttributes>.activities.contains {
      $0.attributes.kind == .budget && isLive($0)
    }
    let plan = LiveActivityPlanner.select(
      snapshot: snapshot,
      now: Date(),
      budgetAlertMonth: month,
      budgetActivityRunningToday: running)
    Task { await apply(plan) }
  }

  private func apply(_ plan: LiveActivityPlan?) async {
    let activities = Activity<LakshlyActivityAttributes>.activities.filter(isLive)
    guard let plan else {
      let end = LiveActivityPlanner.endOfDay(Date(), calendar: .current)
      for activity in activities {
        await activity.end(nil, dismissalPolicy: .after(end))
      }
      return
    }
    let kind: LakshlyActivityAttributes.Kind = plan.kind == .bill ? .bill : .budget
    let state = LakshlyActivityAttributes.ContentState(
      title: plan.title,
      subtitle: plan.subtitle,
      progress: plan.progress,
      amount: amountText(plan))
    let content = ActivityContent(state: state, staleDate: plan.endOfDay)
    do {
      if let match = activities.first(where: { $0.attributes.kind == kind }) {
        await match.update(content)
        for other in activities where other.id != match.id {
          await other.end(nil, dismissalPolicy: .immediate)
        }
      } else {
        for other in activities {
          await other.end(nil, dismissalPolicy: .immediate)
        }
        _ = try Activity.request(attributes: LakshlyActivityAttributes(kind: kind), content: content, pushType: nil)
      }
      if let month = plan.budgetAlertMonth {
        GlanceStore.preferences.set(month, forKey: GlancePreferences.budgetAlertMonthKey)
      }
    } catch {}
  }

  private func amountText(_ plan: LiveActivityPlan) -> String? {
    guard GlancePreferences.lockScreenAmounts(in: GlanceStore.preferences), let paise = plan.amountPaise else {
      return nil
    }
    return Money.format(paise)
  }

  private func endAll(immediate: Bool) {
    let end = LiveActivityPlanner.endOfDay(Date(), calendar: .current)
    Task {
      for activity in Activity<LakshlyActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: immediate ? .immediate : .after(end))
      }
    }
  }

  private func isLive(_ activity: Activity<LakshlyActivityAttributes>) -> Bool {
    switch activity.activityState {
    case .active, .stale, .pending: true
    default: false
    }
  }
}
#endif
