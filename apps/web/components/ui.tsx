"use client";
import { useAppState } from "./AppState";
import { Icon } from "./Icon";
import { useTier } from "./useTier";
import { PRICE_TEXT, type FeatureId } from "@/lib/entitlements";

export function Glass({ children, className = "", as: Tag = "section", style }: {
  children: React.ReactNode; className?: string; as?: "section" | "div" | "article"; style?: React.CSSProperties;
}) {
  return <Tag className={`glass ${className}`} style={style}>{children}</Tag>;
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {children && <div className="header-actions">{children}</div>}
    </header>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "up" | "down" }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone ?? ""}`}>{value}</span>
      {hint && <span className={`stat-hint ${tone ?? ""}`}>{hint}</span>}
    </div>
  );
}

export function Progress({ pct, color }: { pct: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const over = pct > 100;
  return (
    <div className="progress" role="progressbar" aria-label="Progress" aria-valuetext={`${Math.round(pct)}%`} aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${clamped}%`, background: over ? "var(--danger)" : color ?? "var(--accent-grad)" }} />
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange, label }: {
  value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="chips" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value}
          className={`chip ${o.value === value ? "active" : ""}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PremiumBadge({ small }: { small?: boolean }) {
  return <span className={`badge premium ${small ? "small" : ""}`}><Icon name="sparkle" size={small ? 11 : 13} /> Premium</span>;
}

/** Shows Premium content when can(id); otherwise a blurred, inert preview plus a tasteful upsell. */
export function PremiumGate({ children, feature, id }: { children: React.ReactNode; feature: string; id: FeatureId }) {
  const { setPlan } = useAppState();
  const { can } = useTier();
  if (can(id)) return <>{children}</>;
  return (
    <div className="gate">
      <div className="gate-preview" aria-hidden="true" inert>{children}</div>
      <div className="gate-overlay">
        <Glass className="gate-card">
          <div className="gate-icon"><Icon name="sparkle" size={22} /></div>
          <h3>{feature} is part of Premium</h3>
          <p className="muted">Unlock the full picture: debt planner, credit, investments, rewards, unlimited budgets and history.</p>
          <p className="price"><strong>{PRICE_TEXT.yearly}</strong>/year <span className="muted">(≈{PRICE_TEXT.yearlyPerMonth}/month)</span> · or <strong>{PRICE_TEXT.monthly}</strong>/month</p>
          <button className="btn primary" onClick={() => setPlan("premium")}>Preview Premium (demo)</button>
          <p className="tiny muted">Demo only. No payment is taken in this preview.</p>
        </Glass>
      </div>
    </div>
  );
}
