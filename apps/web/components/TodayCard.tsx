"use client";
import { Glass } from "./ui";
import { useData } from "./DataState";
import { SundayBanner, useQuestToday, useSundayToday } from "./ReviewParts";
import { CardDueReminder, StatementCloseReminder, useCardDueToday, useStatementCloseToday } from "./CardDueReminder";
import { FreshnessReminder, useFreshnessToday } from "./FreshnessReminder";
import { formatDate } from "@/lib/format";

export function TodayCard() {
  const sunday = useSundayToday();
  const closing = useStatementCloseToday();
  const due = useCardDueToday();
  const fresh = useFreshnessToday();
  const quest = useQuestToday();
  const { review } = useData();
  if (!sunday && !closing && !due && !fresh && !quest) return null;
  return (
    <Glass className="card today-card">
      <div className="card-head"><h2>Today</h2></div>
      {sunday && <SundayBanner row />}
      {quest?.waiting && (
        <div className="today-row">
          <h3>3-day wait</h3>
          <p>Wait until <b>{formatDate(quest.until)}</b> before buying from <b>{quest.merchant}</b>. On this device. Nothing is sent.</p>
        </div>
      )}
      {quest && !quest.waiting && (
        <div className="today-row">
          <h3>3-day wait</h3>
          <p>The 3-day wait for <b>{quest.merchant}</b> is over.</p>
          <div className="row-actions">
            <button className="btn primary" type="button" onClick={() => review.dispatch({ type: "clearQuest" })}>Got it</button>
          </div>
        </div>
      )}
      {closing && <StatementCloseReminder row />}
      {due && <CardDueReminder row />}
      {fresh && <FreshnessReminder row />}
    </Glass>
  );
}
