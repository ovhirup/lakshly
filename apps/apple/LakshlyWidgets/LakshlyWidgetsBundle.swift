import SwiftUI
import WidgetKit

@main struct LakshlyWidgets: WidgetBundle {
  var body: some Widget { widgets }

  #if os(iOS) && canImport(ActivityKit)
  @WidgetBundleBuilder private var widgets: some Widget {
    BudgetPaceWidget()
    UpcomingBillWidget()
    BillRadarWidget()
    NetWorthWidget()
    DebtWidget()
    ReviewWidget()
    LakshlyLiveActivity()
  }
  #else
  @WidgetBundleBuilder private var widgets: some Widget {
    BudgetPaceWidget()
    UpcomingBillWidget()
    BillRadarWidget()
    NetWorthWidget()
    DebtWidget()
    ReviewWidget()
  }
  #endif
}
