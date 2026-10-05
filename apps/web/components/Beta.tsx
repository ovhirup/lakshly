"use client";
// Beta-edition chrome: a small persistent ribbon, the "Beta tester" pill and a floating feedback button.
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { Glass } from "./ui";

const TESTER_START_KEY = "lk-tester-start-hidden";

export function BetaRibbon() {
  return <div className="beta-ribbon" role="note" aria-label="Lakshly beta: sample data, nothing is real"><span>Beta</span></div>;
}

export function BetaTesterPill({ size = "sm" }: { size?: "sm" | "lg" }) {
  return <span className={`tier-pill premium beta-pill ${size}`}><Icon name="sparkle" size={size === "lg" ? 13 : 11} /> Beta tester</span>;
}

/** Always-visible feedback entry (opens the existing hub; relay at feedback.lakshly.com, mailto fallback there). */
/** Three first actions on the tester site. Hidden on the public build. */
export function TesterStartCard() {
  const [hidden, setHidden] = useState<boolean | null>(null);
  useEffect(() => {
    try { setHidden(localStorage.getItem(TESTER_START_KEY) === "1"); } catch { setHidden(false); }
  }, []);
  if (hidden !== false) return null;
  return (
    <Glass className="card">
      <div className="card-head"><h2>Three things to try</h2><span className="badge">Beta</span></div>
      <ol className="tester-start">
        <li><Link href="/import/?sample=1">Try a sample statement</Link> and confirm the review.</li>
        <li>Tap <b>Hide amounts</b>. The figures turn into dots, and they stay hidden after a reload.</li>
        <li><Link href="/feedback/">Send one note</Link> if a number or a screen looks wrong.</li>
      </ol>
      <button className="btn ghost" type="button" onClick={() => { try { localStorage.setItem(TESTER_START_KEY, "1"); } catch { /* private mode */ } setHidden(true); }}>Hide this</button>
    </Glass>
  );
}

export function FeedbackFab() {
  const path = usePathname() || "/";
  if (path.startsWith("/feedback")) return null;
  return (
    <Link href="/feedback/" className="feedback-fab" aria-label="Send feedback on the beta">
      <Icon name="feedback" size={18} /><span>Feedback</span>
    </Link>
  );
}
