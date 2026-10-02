"use client";
import { useState, useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "./AppState";
import { Icon } from "./Icon";
import { ThemeSwitcher } from "./ThemeSwitcher";
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
  { href: "/import/", label: "Import", icon: "import" },
  { href: "/feedback/", label: "Feedback & Requests", icon: "feedback" },
];
const MOBILE = ["/", "/spend/", "/budget/", "/history/"];

const norm = (p: string) => (p.endsWith("/") ? p : `${p}/`);

export function Shell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, [menuOpen]);
  const closeMenu = () => { setMenuOpen(false); moreRef.current?.focus(); };
  const path = norm(usePathname() || "/");
  const { plan, setPlan } = useAppState();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const mobileIndex = menuOpen ? 4 : MOBILE.findIndex(active);

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="bg" aria-hidden="true" />
      <aside className="sidebar glass">
        <Link href="/" className="brand" aria-label="Lakshly home">
          <span className="logo" aria-hidden="true"><Lotus /></span>
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
          <Link href="/" className="brand compact"><span className="logo"><Lotus /></span><strong>Lakshly</strong></Link>
          <span className="demo-pill">Demo data</span>
          <div className="topbar-actions">
            {plan === "premium" ? <PremiumBadge small /> : null}
            <ThemeSwitcher />
          </div>
        </div>
        <main id="main-content" className="content" key={path}>{children}</main>
      </div>

      {menuOpen && <div ref={menuRef} className="mobile-menu glass" id="more-navigation" role="region" aria-label="More navigation" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); closeMenu(); } }}>
        <div className="card-head"><h2>Explore Lakshly</h2><button className="icon-btn" onClick={closeMenu} aria-label="Close navigation">×</button></div>
        <nav aria-label="All pages">{NAV.map((n) => <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className={`nav-item ${active(n.href) ? "active" : ""}`} aria-current={active(n.href) ? "page" : undefined}><Icon name={n.icon} size={18} /><span>{n.label}</span>{n.premium && plan === "free" && <Icon name="lock" size={13} />}</Link>)}</nav>
        <PlanSwitch plan={plan} setPlan={setPlan} />
        <p className="tiny muted">Synthetic demo data. Stored only on this device.</p>
      </div>}
      <nav className="tabbar glass" aria-label="Quick" style={{ "--tab-index": mobileIndex < 0 ? 4 : mobileIndex } as CSSProperties}>
        <span className="tab-indicator" aria-hidden="true" />
        {NAV.filter((n) => MOBILE.includes(n.href)).map((n) => (
          <Link key={n.href} href={n.href} className={`tab ${active(n.href) ? "active" : ""}`} aria-current={active(n.href) ? "page" : undefined} onClick={() => setMenuOpen(false)}>
            <Icon name={n.icon} size={20} />
            <span>{n.label.split(" ")[0]}</span>
          </Link>
        ))}
        <button ref={moreRef} className={`tab ${menuOpen || !MOBILE.some(active) ? "active" : ""}`} aria-expanded={menuOpen} aria-controls="more-navigation" onClick={() => setMenuOpen(!menuOpen)}><Icon name="overview" size={20} /><span>More</span></button>
      </nav>
    </div>
  );
}

function PlanSwitch({ plan, setPlan }: { plan: string; setPlan: (p: "free" | "premium") => void }) {
  return (
    <div className="plan-switch" role="group" aria-label="Demo plan" style={{ "--plan-index": plan === "premium" ? 1 : 0 } as CSSProperties}>
      {(["free", "premium"] as const).map((p) => (
        <button key={p} aria-pressed={plan === p} className={plan === p ? "on" : ""} onClick={() => setPlan(p)}>
          {p === "free" ? "Free" : <><Icon name="sparkle" size={12} /> Premium</>}
        </button>
      ))}
    </div>
  );
}

function Lotus() {
  return <svg viewBox="0 0 40 40" fill="none" aria-hidden="true"><path d="M20 5c-8 9-8 18 0 27 8-9 8-18 0-27Z" stroke="currentColor" strokeWidth="1.8"/><path d="M7 15c-1 11 3 17 13 19 0-10-4-16-13-19Zm26 0c1 11-3 17-13 19 0-10 4-16 13-19Z" stroke="currentColor" strokeWidth="1.8"/><path d="M3 25c4 9 10 12 17 9 7 3 13 0 17-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>;
}
