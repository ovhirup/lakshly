"use client";
// Beta-edition chrome: a small persistent ribbon, the "Beta tester" pill and a floating feedback button.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

export function BetaRibbon() {
  return <div className="beta-ribbon" role="note" aria-label="Lakshly beta: sample data, nothing is real"><span>Beta</span></div>;
}

export function BetaTesterPill({ size = "sm" }: { size?: "sm" | "lg" }) {
  return <span className={`tier-pill premium beta-pill ${size}`}><Icon name="sparkle" size={size === "lg" ? 13 : 11} /> Beta tester</span>;
}

/** Always-visible feedback entry (opens the existing hub; relay at feedback.lakshly.com, mailto fallback there). */
export function FeedbackFab() {
  const path = usePathname() || "/";
  if (path.startsWith("/feedback")) return null;
  return (
    <Link href="/feedback/" className="feedback-fab" aria-label="Send feedback on the beta">
      <Icon name="feedback" size={18} /><span>Feedback</span>
    </Link>
  );
}
