"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/components/AppState";
import { useData } from "@/components/DataState";
import { Icon } from "@/components/Icon";
import { Amount } from "@/components/Privacy";
import { useTier } from "@/components/useTier";
import { Glass, PremiumBadge, Progress } from "@/components/ui";
import { IS_BETA } from "@/lib/edition";
import { formatINR, formatPct } from "@/lib/format";
import type { Debt } from "@/lib/schema.gen";
import {
  baseline, clearedPercent, extraStepPaise, freedomHeadline, interestSaved, message, noLoansCopy,
  overviewLine, payoffLabel, pullIn, simulate, sliderCeiling, soonerText, startMonth, stuckLines,
  unscheduledNote, whatIfDateLine,
} from "@/lib/wow/freedom";
import type { WowState } from "@/lib/wow/state";
import "../wow.css";

function clampExtra(value: number, maximum: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maximum, Math.max(0, Math.trunc(value)));
}

export function FreedomCard() {
  const { can } = useTier();
  const { debts, review } = useData();
  if (!can("wow.freedomDate")) return null;
  const plan = baseline(debts, review.now);
  const head = freedomHeadline(debts, plan, review.now);
  const cleared = clearedPercent(debts);
  return (
    <Glass className="card wow-freedom" data-testid="wow-freedomDate-card">
      <h2>Freedom date</h2>
      {debts.length === 0 ? <p>{noLoansCopy}</p> : (
        <>
          {head.title ? <p className={head.days ? "wow-freedom-headline" : "wow-freedom-subhead"}>{head.title}</p> : null}
          {head.days ? <p className="wow-freedom-days">{head.days}</p> : null}
          {head.stuck.map((line, index) => <p className="wow-stuck" key={`stuck-${index}`}>{line}</p>)}
          <div className="wow-cleared">
            <Progress pct={cleared} color="var(--accent)" />
            <p className="wow-cleared-label">{formatPct(cleared, 0)} cleared</p>
          </div>
          <ul className="wow-payoffs">
            {plan.payoffs.map((payoff) => (
              <li className="wow-payoff" key={payoff.id}>
                <span>{payoff.name}</span>
                <span>{payoffLabel(payoff.month)}</span>
              </li>
            ))}
          </ul>
          {plan.unscheduled.map((debt) => <p className="wow-note" key={debt.id}>{unscheduledNote(debt.name)}</p>)}
        </>
      )}
    </Glass>
  );
}

export function FreedomWhatIfCard() {
  const { can } = useTier();
  if (!can("wow.freedomWhatIf")) return <LockedWhatIf />;
  return <WhatIfHost />;
}

function LockedWhatIf() {
  const { setPlan } = useAppState();
  return (
    <Glass className="card wow-locked" data-testid="wow-freedomWhatIf-card">
      <div className="wow-locked-top">
        <div className="wow-lock" aria-hidden="true"><Icon name="lock" size={18} /></div>
        <div>
          <h2>What if I pay a bit extra?</h2>
          <p className="muted">Slide an extra monthly payment and watch your freedom date move. Roll cleared EMIs into the next loan.</p>
        </div>
      </div>
      <PremiumBadge small />
      {IS_BETA
        ? <button type="button" className="btn primary" data-testid="wow-freedomWhatIf-preview" onClick={() => setPlan("premium")}>Preview Premium (demo)</button>
        : <p className="tiny muted">Payments aren’t live yet.</p>}
    </Glass>
  );
}

function WhatIfHost() {
  const { debts, review, wow } = useData();
  return (
    <WhatIfForm
      key={wow.ready ? "saved" : "seed"}
      debts={debts}
      now={review.now}
      savedExtra={wow.state.extraPaise}
      savedRoll={wow.state.rollOver}
      ready={wow.ready}
      update={wow.update}
    />
  );
}

function WhatIfForm({ debts, now, savedExtra, savedRoll, ready, update }: {
  debts: readonly Debt[];
  now: Date;
  savedExtra: number;
  savedRoll: boolean;
  ready: boolean;
  update: (fn: (current: WowState) => WowState) => void;
}) {
  const maximum = sliderCeiling(debts);
  const [extra, setExtra] = useState(() => clampExtra(savedExtra, maximum));
  const [rollOver, setRollOver] = useState(savedRoll);
  const shown = clampExtra(extra, maximum);
  const amount = formatINR(shown);

  useEffect(() => {
    if (!ready) return;
    const clamped = clampExtra(extra, maximum);
    if (savedExtra === clamped && savedRoll === rollOver) return;
    let pending = true;
    const timer = window.setTimeout(() => {
      pending = false;
      update((current) => ({ ...current, extraPaise: clamped, rollOver }));
    }, 300);
    return () => {
      window.clearTimeout(timer);
      if (!pending) return;
      update((current) => ({ ...current, extraPaise: clamped, rollOver }));
    };
  }, [extra, rollOver, maximum, ready, savedExtra, savedRoll, update]);

  const base = baseline(debts, now);
  const whatIf = simulate(debts, startMonth(now), shown, rollOver);
  const months = pullIn(base, whatIf);
  const saved = interestSaved(base, whatIf);
  const open = whatIf.freedomMonth ? [] : stuckLines(debts, whatIf, false);

  return (
    <Glass className="card wow-whatif" data-testid="wow-freedomWhatIf-card">
      <h2>What if I pay a bit extra?</h2>
      <div className="wow-extra">
        <label htmlFor="wow-freedom-extra">Extra per month</label>
        <strong><Amount>{amount}</Amount></strong>
      </div>
      <input
        id="wow-freedom-extra"
        type="range"
        min={0}
        max={maximum}
        step={extraStepPaise}
        value={shown}
        aria-valuetext={amount.includes("•") ? "Amount hidden" : amount}
        data-testid="wow-freedomWhatIf-extra"
        onChange={(e) => setExtra(clampExtra(Number(e.target.value), maximum))}
      />
      <label className="wow-check">
        <input
          type="checkbox"
          checked={rollOver}
          data-testid="wow-freedomWhatIf-rollOver"
          onChange={(e) => setRollOver(e.target.checked)}
        />
        Roll cleared EMIs into the next loan
      </label>
      <div aria-live="polite">
        {debts.length === 0 ? <p>{noLoansCopy}</p> : (
          <>
            <p className="wow-whatif-date">{whatIfDateLine(whatIf)}</p>
            {open.map((line, index) => <p className="wow-stuck" key={`what-stuck-${index}`}>{line}</p>)}
            <p className="wow-sooner">{soonerText(months)}</p>
            <div className="wow-metric">
              <span>Interest saved</span>
              <strong><Amount>{formatINR(saved)}</Amount></strong>
            </div>
            <p className="muted">{message(months)}</p>
          </>
        )}
      </div>
    </Glass>
  );
}

export function FreedomOverviewRow() {
  const { can } = useTier();
  const { debts, review } = useData();
  if (!can("wow.freedomDate") || debts.length === 0) return null;
  const line = overviewLine(debts, review.now);
  return (
    <Glass as="div" className="wow-freedom-overview">
      <Link href="/debt/" className="wow-freedom-row" data-testid="wow-freedomDate-overview">
        <span className="wow-freedom-line">{line}</span>
        <span className="sr-only">Opens Debt</span>
        <span className="wow-chevron" aria-hidden="true" />
      </Link>
    </Glass>
  );
}
