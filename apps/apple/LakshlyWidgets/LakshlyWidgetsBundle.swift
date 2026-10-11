import SwiftUI
import WidgetKit

@main struct LakshlyWidgets: WidgetBundle {
  var body: some Widget { widgets }

  #if os(iOS) && canImport(ActivityKit)
  @WidgetBundleBuilder private var widgets: some Widget {
    BudgetPaceWidget()
    UpcomingBillWidget()
    NetWorthWidget()
    DebtWidget()
    ReviewWidget()
    LakshlyLiveActivity()
  }
  #else
  @WidgetBundleBuilder private var widgets: some Widget {
    BudgetPaceWidget()
    UpcomingBillWidget()
    NetWorthWidget()
    DebtWidget()
    ReviewWidget()
  }
  #endif
}
