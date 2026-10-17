"use client";
import { useState } from "react";
import { useAppState } from "@/components/AppState";
import { useData } from "@/components/DataState";
import { Icon } from "@/components/Icon";
import { Amount, usePrivacy } from "@/components/Privacy";
import { useTier } from "@/components/useTier";
import type { WowApi } from "@/components/useWow";
import { Glass, PremiumBadge, Progress } from "@/components/ui";
import { IS_BETA } from "@/lib/edition";
import { formatINR, formatPct } from "@/lib/format";
import type { Transaction } from "@/lib/schema.gen";
import {
  dayString, dueDateLabel, dueLine, feeFormIssue, feeSuggestions, paiseFromRupees, runwayPlan, rupeeField, statusTitle,
  type RunwayFee, type RunwayStatus,
} from "@/lib/wow/fee-runway";
import type { WowFee } from "@/lib/wow/state";
import "../wow.css";

function shownMoney(paise: number): string {
  return formatINR(paise, paise % 100 !== 0 ? { decimals: true } : {});
}

function yearAhead(now: Date): string {
  const year = now.getFullYear() + 1;
  const monthIndex = now.getMonth();
  const last = new Date(year, monthIndex + 1, 0).getDate();
  return dayString(new Date(year, monthIndex, Math.min(now.getDate(), last), 12));
}

function statusColor(status: RunwayStatus): string {
  if (status === "funded") return "var(--lk-income)";
  if (status === "onTrack") return "var(--lk-gold)";
  return "var(--lk-danger)";
}

function statusClass(status: RunwayStatus): string {
  if (status === "funded") return "wow-pill wow-fee-status funded";
  if (status === "onTrack") return "wow-pill wow-fee-status track";
  return "wow-pill wow-fee-status behind";
}

/** Yearly fees with a monthly set-aside. Premium (`wow.feeRunway`). */
export function FeeRunwayCard() {
  const { can } = useTier();
  if (!can("wow.feeRunway")) return <LockedRunway />;
  return <RunwayHost />;
}

function LockedRunway() {
  const { setPlan } = useAppState();
  return (
    <Glass className="card wow-locked" data-testid="wow-feeRunway-card" aria-label="Fee runway">
      <div className="wow-locked-top">
        <div className="wow-lock" aria-hidden="true"><Icon name="lock" size={18} /></div>
        <div>
          <h2>Fee runway</h2>
          <p className="muted">Yearly fees, sorted. See what to set aside each month so insurance and card fees never surprise you.</p>
        </div>
      </div>
      <PremiumBadge small />
      {IS_BETA
        ? <button type="button" className="btn primary" data-testid="wow-feeRunway-preview" onClick={() => setPlan("premium")}>Preview Premium (demo)</button>
        : <p className="tiny muted">Payments aren’t live yet.</p>}
    </Glass>
  );
}

function RunwayHost() {
  const { source, transactions, review, wow } = useData();
  return <RunwayBody key={source} transactions={transactions} now={review.now} wow={wow} />;
}

function RunwayBody({ transactions, now, wow }: {
  transactions: readonly Transaction[];
  now: Date;
  wow: WowApi;
}) {
  const { masked } = usePrivacy();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [due, setDue] = useState(() => yearAhead(now));
  const [yearly, setYearly] = useState(true);
  const plan = runwayPlan(wow.state.fees, wow.state.setAside, now);
  const found = feeSuggestions(transactions, wow.state.fees, now);
  const issue = feeFormIssue(draftName, draftAmount, due);

  function log(fee: RunwayFee) {
    const paise = paiseFromRupees(drafts[fee.id] ?? rupeeField(fee.perMonthPaise));
    if (paise === null) return;
    if (wow.logFee(fee.id, paise)) setToast(`Funded 🎉 ${fee.name}`);
  }

  function addDraft() {
    const name = draftName.trim();
    const amount = paiseFromRupees(draftAmount);
    if (!name || amount === null || issue) return;
    const id = `fee-${crypto.randomUUID()}`;
    const fee: WowFee = { id, name, amount, due, yearly };
    wow.addFee(fee);
    setDraftName("");
    setDraftAmount("");
  }

  return (
    <Glass className="card wow-fee" data-testid="wow-feeRunway-card" aria-label="Fee runway">
      <p className={toast ? "wow-fee-toast" : "sr-only"} role="status" aria-live="polite" data-testid="wow-feeRunway-toast">{toast ?? ""}</p>
      <h2 className="wow-fee-headline" data-testid="wow-feeRunway-headline">
        Set aside <Amount>{shownMoney(plan.monthlyNeedPaise)}</Amount> a month
      </h2>
      <div className="wow-fee-funded">
        <Progress pct={plan.fundedFraction * 100} color="var(--lk-gold)" />
        <p data-testid="wow-feeRunway-funded">
          <Amount>{shownMoney(plan.fundedPaise)}</Amount>
          {" of "}
          <Amount>{shownMoney(plan.totalPaise)}</Amount>
          {` ready (${formatPct(plan.fundedFraction * 100, 0)})`}
        </p>
      </div>
      {plan.fees.length === 0 ? (
        <p className="muted">No fees yet. Add one so a yearly bill does not sneak up on you.</p>
      ) : (
        <ul className="wow-fee-list">
          {plan.fees.map((fee) => {
            const text = drafts[fee.id] ?? rupeeField(fee.perMonthPaise);
            const logged = paiseFromRupees(text);
            return (
              <li className="wow-fee-row" data-testid={`wow-feeRunway-fee-${fee.id}`} key={fee.id}>
                <div className="wow-fee-top">
                  <span className="wow-fee-name">{fee.name}</span>
                  <span className={statusClass(fee.status)}>{statusTitle(fee.status)}</span>
                </div>
                <p className="wow-fee-due">{dueLine(fee.due, fee.daysLeft)}</p>
                <Progress pct={fee.fraction * 100} color={statusColor(fee.status)} />
                <p className="wow-fee-month"><Amount>{shownMoney(fee.perMonthPaise)}</Amount> a month</p>
                <div className="wow-fee-actions">
                  <FeeAmount fee={fee} text={text} masked={masked} onDraft={(value) => setDrafts((prev) => ({ ...prev, [fee.id]: value }))} />
                  <button
                    type="button"
                    className="wow-fee-log"
                    disabled={logged === null}
                    aria-label={`Log set-aside for ${fee.name}`}
                    data-testid={`wow-feeRunway-log-${fee.id}`}
                    onClick={() => log(fee)}
                  >
                    Log
                  </button>
                  <button
                    type="button"
                    className="wow-fee-quiet"
                    aria-label={`Mark ${fee.name} as paid and reset the set-aside`}
                    data-testid={`wow-feeRunway-reset-${fee.id}`}
                    onClick={() => { wow.resetFee(fee.id); setToast(null); }}
                  >
                    Paid? Reset
                  </button>
                  <button
                    type="button"
                    className="wow-fee-quiet"
                    aria-label={`Remove ${fee.name}`}
                    data-testid={`wow-feeRunway-remove-${fee.id}`}
                    onClick={() => { wow.removeFee(fee.id); setToast(null); }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {found.length > 0 && (
        <section className="wow-fee-suggest" aria-label="Spotted in your statements" data-testid="wow-feeRunway-suggestions">
          <h3>Spotted in your statements</h3>
          <ul>
            {found.map((fee) => (
              <li key={fee.id}>
                <div>
                  <span className="wow-fee-name">{fee.name}</span>
                  <span className="wow-fee-due">Due {dueDateLabel(fee.due)}</span>
                </div>
                <span className="wow-fee-month"><Amount>{shownMoney(fee.amount)}</Amount></span>
                <button
                  type="button"
                  className="wow-fee-log"
                  aria-label={`Add ${fee.name}`}
                  data-testid={`wow-feeRunway-suggest-${fee.id}`}
                  onClick={() => wow.addFee(fee)}
                >
                  Add
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="wow-fee-form" data-testid="wow-feeRunway-form">
        <h3>Add a fee</h3>
        <label className="field">
          Name
          <input
            type="text"
            value={draftName}
            placeholder="Insurance or card fee"
            aria-label="Fee name"
            data-testid="wow-feeRunway-name"
            onChange={(event) => setDraftName(event.target.value)}
          />
        </label>
        <label className="field">
          Amount
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draftAmount}
            placeholder="Amount"
            aria-label="Fee amount"
            data-testid="wow-feeRunway-newAmount"
            onChange={(event) => setDraftAmount(event.target.value)}
          />
        </label>
        <label className="field">
          Due
          <input
            type="date"
            value={due}
            aria-label="Due date"
            data-testid="wow-feeRunway-due"
            onChange={(event) => setDue(event.target.value)}
          />
        </label>
        <label className="wow-check">
          <input
            type="checkbox"
            checked={yearly}
            data-testid="wow-feeRunway-yearly"
            onChange={(event) => setYearly(event.target.checked)}
          />
          Repeats yearly
        </label>
        <button
          type="button"
          className="btn primary"
          disabled={issue.length > 0}
          aria-describedby={issue ? "wow-fee-issue" : undefined}
          data-testid="wow-feeRunway-add"
          onClick={addDraft}
        >
          Add fee
        </button>
        {issue ? <p className="tiny wow-fee-issue" id="wow-fee-issue" data-testid="wow-feeRunway-issue">{issue}</p> : null}
      </div>
    </Glass>
  );
}

function FeeAmount({ fee, text, masked, onDraft }: {
  fee: RunwayFee;
  text: string;
  masked: boolean;
  onDraft: (value: string) => void;
}) {
  const label = `Amount to set aside for ${fee.name}`;
  const testId = `wow-feeRunway-amount-${fee.id}`;
  if (masked) {
    const paise = paiseFromRupees(text) ?? fee.perMonthPaise;
    return (
      <span className="wow-fee-amount-mask" aria-label={label} data-testid={testId}>
        <Amount>{shownMoney(paise)}</Amount>
      </span>
    );
  }
  return (
    <input
      className="wow-fee-amount"
      type="text"
      inputMode="decimal"
      autoComplete="off"
      aria-label={label}
      data-testid={testId}
      value={text}
      onChange={(event) => onDraft(event.target.value)}
    />
  );
}
