"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "./AppState";
import { Icon } from "./Icon";
import { PremiumBadge } from "./ui";

export const NAV = [
  { href: "/", label: "Overview", icon: "overview" },
  { href: "/spend/", label: "Spend", icon: "spend" },
  { href: "/budget/", label: "Budget", icon: "budget" },
  { href: "/debt/", label: "Debt", icon: "debt", premium: true },
  { href: "/credit/", label: "Credit", icon: "credit", premium: true },
  { href: "/investments/", label: "Investments", icon: "invest", premium: true },
  { href: "/rewards/", label: "Rewards", icon: "rewards", premium: true },
  { href: "/history/", label: "History", icon: "history" },
  { href: "/feedback/", label: "Feedback & Requests", icon: "feedback" },
];
const MOBILE = ["/", "/spend/", "/budget/", "/investments/", "/feedback/"];

const norm = (p: string) => (p.endsWith("/") ? p : `${p}/`);

export function Shell({ children }: { children: React.ReactNode }) {
  const path = norm(usePathname() || "/");
  const { plan, setPlan, theme, toggleTheme } = useAppState();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="app">
      <div className="bg" aria-hidden="true"><i /><i /><i /></div>
      <aside className="sidebar glass">
        <Link href="/" className="brand" aria-label="Lakshly home">
          <span className="logo" aria-hidden="true">🪷</span>
          <span>
            <strong>Lakshly</strong>
            <small>Every rupee on target.</small>
          </span>
        </Link>
        <nav aria-label="Main">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`nav-item ${active(n.href) ? "active" : ""}`}
              aria-current={active(n.href) ? "page" : undefined}>
              <Icon name={n.icon} size={18} />
              <span>{n.label}</span>
              {n.premium && plan === "free" && <Icon name="lock" size={13} />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <PlanSwitch plan={plan} setPlan={setPlan} />
          <p className="tiny muted">Synthetic demo data · stored only on this device</p>
        </div>
      </aside>

      <div className="main">
        <div className="topbar glass">
          <Link href="/" className="brand compact"><span className="logo">🪷</span><strong>Lakshly</strong></Link>
          <span className="demo-pill">Demo data</span>
          <div className="topbar-actions">
            {plan === "premium" ? <PremiumBadge small /> : null}
            <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
              <Icon name={theme === "dark" ? "sun" : "moon"} size={18} stroke={theme === "dark"} />
            </button>
          </div>
        </div>
        <main className="content" key={path}>{children}</main>
      </div>

      <nav className="tabbar glass" aria-label="Quick">
        {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} className={`tab ${active(n.href) ? "active" : ""}`}>
            <Icon name={n.icon} size={20} />
            <span>{n.label.split(" ")[0]}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function PlanSwitch({ plan, setPlan }: { plan: string; setPlan: (p: "free" | "premium") => void }) {
  return (
    <div className="plan-switch" role="radiogroup" aria-label="Demo plan">
      {(["free", "premium"] as const).map((p) => (
        <button key={p} role="radio" aria-checked={plan === p} className={plan === p ? "on" : ""} onClick={() => setPlan(p)}>
          {p === "free" ? "Free" : "✦ Premium"}
        </button>
      ))}
    </div>
  );
}
