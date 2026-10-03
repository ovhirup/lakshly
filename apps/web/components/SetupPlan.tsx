"use client";
import { useState } from "react";
import { suggestBudget, suggestGoal, variableCategories, addYears, type BudgetLine, type SetupDataset, type SetupGoal } from "@lakshly/shared";
import { useData } from "./DataState";
import { useAppState } from "./AppState";
import { Glass } from "./ui";
import { formatMoney, formatMonth, titleCase, formatDate } from "@/lib/format";
import { can, limit, ENTITLEMENTS_MAP } from "@/lib/entitlements";

export function SetupPlan({ today, currency, notify }: { today: string; currency: string; notify: (text: string) => void }) {
  const d = useData();
  const { plan, privacy } = useAppState();
  const dataset: SetupDataset = { transactions: d.user?.dataset.transactions ?? [], accounts: d.user?.dataset.accounts ?? [], budgets: d.user?.dataset.budgets, goals: d.goals };
  const [factor, setFactor] = useState(95);
  const [edits, setEdits] = useState<Record<string, number>>({});
  const [starter, setStarter] = useState<string[]>(["groceries", "dining", "transport"]);
  const [busy, setBusy] = useState(false);
  const [editGoal, setEditGoal] = useState(false);
  const suggestion = suggestBudget(dataset, today, factor);
  const goalSuggestion = suggestGoal(dataset, today);
  const [goalEdits, setGoalEdits] = useState<Partial<SetupGoal>>({});
  const month = today.slice(0, 7);
  const starterMode = suggestion.mode === "starter" || !suggestion.lines.length;
  const lines: (BudgetLine & { median?: number })[] = (starterMode ? starter.map(category => ({
    id: `bud_${month.replace("-", "")}${category}`, month, category, limit: 0, rollover: false,
  })) : suggestion.lines).map(l => ({ ...l, limit: edits[l.category] ?? l.limit }));
  const money = (value: number) => formatMoney(value, { privacy, currency });
  const goal: SetupGoal = { id: "goal_setup01", name: goalSuggestion.name, kind: goalSuggestion.kind,
    target: goalSuggestion.target ?? 0, saved: goalSuggestion.saved ?? 0, monthly: goalSuggestion.monthly ?? 0,
    due: goalSuggestion.due ?? addYears(today), createdAt: new Date().toISOString(), createdBy: "setup", ...goalEdits };
  const budgetSaved = d.budgets.some(b => b.month === month);
  const allowedBudget = !Object.hasOwn(ENTITLEMENTS_MAP, "budgets.unlimited") || limit("budgets.unlimited", plan) >= 1;
  async function save(kind: "budget" | "goal") {
    setBusy(true);
    try {
      if (kind === "budget") await d.saveBudgets(lines.map(({ id, month, category, limit, rollover }) => ({ id, month, category, limit, rollover })));
      else await d.saveGoal(goal);
      notify(kind === "budget" ? `Budget saved for ${formatMonth(month)}.` : "Your Laksh goal is saved.");
    } catch (error) { notify(error instanceof Error ? error.message : "Couldn't save. Please try again."); }
    finally { setBusy(false); }
  }
  if (!can("setup.suggestions", plan)) return <p>Budget and goal suggestions are unavailable.</p>;
  return <div className="setup-stack">
    <Glass className="card setup-stack">
      <h2>First budget</h2>
      <p className="muted">{starterMode ? "No complete month yet. Pick categories and type a calm starting limit, or come back after your next statement."
        : `Based on ${suggestion.months.map(m => formatMonth(m, true)).join("–")}, here's a calm starting budget for ${formatMonth(month, true)}.`}</p>
      {suggestion.mode === "history" && suggestion.confidence === "low" && <p className="tiny muted">Based on one month; we&apos;ll refine it.</p>}
      {starterMode ? <div className="chips" aria-label="Budget categories">{variableCategories.map(category => <button key={category} className={`chip ${starter.includes(category) ? "active" : ""}`} aria-pressed={starter.includes(category)} onClick={() => setStarter(starter.includes(category) ? starter.filter(c => c !== category) : [...starter, category].slice(0, 6))}>{titleCase(category)}</button>)}</div>
        : <div className="chips" aria-label="Budget ambition">{[[100, "Gentle"], [95, "Balanced"], [90, "Stretch"]].map(([value, label]) => <button key={value} className={`chip ${factor === value ? "active" : ""}`} aria-pressed={factor === value} onClick={() => { setFactor(Number(value)); setEdits({}); }}>{label} {value}%</button>)}</div>}
      {lines.map(line => <div className="setup-budget-row" key={line.category}>
        <div><strong>{titleCase(line.category)}</strong>{line.median !== undefined && <p className="tiny muted">You usually spend {money(line.median)}</p>}</div>
        <div className="setup-stepper">
          <button className="btn ghost" aria-label={`Reduce ${line.category} by 100`} onClick={() => setEdits({ ...edits, [line.category]: Math.max(0, line.limit - 10000) })}>−100</button>
          <button className="btn ghost" aria-label={`Reduce ${line.category} by 500`} onClick={() => setEdits({ ...edits, [line.category]: Math.max(0, line.limit - 50000) })}>−500</button>
          <label className="field"><span className="tiny">Limit ({currency})</span><input inputMode="decimal" type={privacy ? "password" : "number"} min="0" step="100" disabled={privacy} aria-label={`${titleCase(line.category)} budget limit`} value={privacy ? "" : line.limit / 100} placeholder={privacy ? "Hidden" : "0"} onChange={e => setEdits({ ...edits, [line.category]: Math.max(0, Math.round(Number(e.target.value) * 100)) })} /></label>
          <button className="btn ghost" aria-label={`Increase ${line.category} by 100`} onClick={() => setEdits({ ...edits, [line.category]: line.limit + 10000 })}>+100</button>
          <button className="btn ghost" aria-label={`Increase ${line.category} by 500`} onClick={() => setEdits({ ...edits, [line.category]: line.limit + 50000 })}>+500</button>
        </div>
      </div>)}
      <div className="card-head"><strong>Total</strong><strong className="setup-total">{money(lines.reduce((sum, l) => sum + l.limit, 0))}</strong></div>
      {budgetSaved && <p className="up">✓ Budget saved for {formatMonth(month)}</p>}
      <div className="row-actions"><button className="btn primary" disabled={busy || !allowedBudget || !lines.length || lines.every(l => l.limit === 0)} onClick={() => void save("budget")}>{budgetSaved ? "Update budget" : "Save budget"}</button>
        {starterMode && <button className="btn ghost" onClick={() => notify("Come back after your next statement. Your setup card will be waiting on Overview.")}>Remind me after my next statement</button>}</div>
    </Glass>
    <Glass className="card setup-stack">
      <h2>One Laksh goal</h2>
      {d.goals.length ? <><p className="up">✓ {d.goals[0].name}</p><p className="muted">{money(d.goals[0].saved)} saved towards {money(d.goals[0].target)}. Your first goal is already set.</p></> : <>
        <h3>{goal.name}</h3>
        {goalSuggestion.monthsCovered != null && <p className="muted">You have about {goalSuggestion.monthsCovered} months of spending in cash.</p>}
        {goalSuggestion.rule === "annualPayment" && <p className="muted">This payment looks yearly. Put aside {money(goal.monthly)}/month to have {money(goal.target)} by {formatDate(goal.due)}.</p>}
        {goalSuggestion.kind === "emergency" && <p className="muted">A little breathing room: {money(goal.saved)} already saved towards {money(goal.target)}, with {money(goal.monthly)}/month until {formatDate(goal.due)}.</p>}
        {goalSuggestion.kind === "custom" && <p className="muted">Choose something that matters to you, and give it a target.</p>}
        {(editGoal || goalSuggestion.kind === "custom") && <div className="setup-fields">
          <label className="field">Goal name<input maxLength={80} value={goal.name} onChange={e => setGoalEdits({ ...goalEdits, name: e.target.value })} /></label>
          {(["target", "saved", "monthly"] as const).map(key => <label className="field" key={key}>{titleCase(key)} ({currency})<input type={privacy ? "password" : "number"} min="0" inputMode="decimal" disabled={privacy} value={privacy ? "" : goal[key] / 100} placeholder={privacy ? "Hidden" : "0"} onChange={e => setGoalEdits({ ...goalEdits, [key]: Math.max(0, Math.round(Number(e.target.value) * 100)) })} /></label>)}
          <label className="field">Due date<input type="date" value={goal.due} onChange={e => setGoalEdits({ ...goalEdits, due: e.target.value })} /></label>
        </div>}
        <div className="row-actions"><button className="btn primary" disabled={busy || goal.target <= 0 || !goal.name.trim() || !goal.due} onClick={() => void save("goal")}>Create goal</button><button className="btn ghost" onClick={() => setEditGoal(!editGoal)}>Edit</button><button className="btn ghost" onClick={() => notify("Goal skipped for now. You can create it later from setup.")}>Skip goal</button></div>
      </>}
    </Glass>
  </div>;
}
