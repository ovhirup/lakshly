"use client";
import Link from "next/link";
import { initial, useProfile } from "@/lib/profile";
import { useTier } from "./useTier";
import { Icon } from "./Icon";
import "./identity.css";
import { IS_BETA } from "@/lib/edition";
import { BetaTesterPill } from "./Beta";

/** Calm outline "Free Version" pill, or the gold "✦ Premium" pill with a slow sheen. */
export function TierPill({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { tier } = useTier();
  if (IS_BETA) return <BetaTesterPill size={size} />;
  return tier === "premium"
    ? <span className={`tier-pill premium ${size}`}><Icon name="sparkle" size={size === "lg" ? 13 : 11} /> Premium</span>
    : <span className={`tier-pill free ${size}`}>Free Version</span>;
}

export function Avatar({ size = 36 }: { size?: number }) {
  const { name } = useProfile();
  const { tier } = useTier();
  const ch = initial(name);
  return (
    <span className={`id-avatar ${tier === "premium" ? "ring" : ""}`} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {ch || <Icon name="user" size={Math.round(size * 0.5)} />}
    </span>
  );
}

/** Sidebar / top bar identity: your own name (stored on this device) with your tier. */
export function IdentityChip({ compact = false }: { compact?: boolean }) {
  const { name } = useProfile();
  const { tier } = useTier();
  const label = `${name || "Add your name"}, ${IS_BETA ? "Beta tester, Premium unlocked" : tier === "premium" ? "Premium" : "Free Version"}. Open profile`;
  return (
    <Link href="/profile/" className={`id-chip ${compact ? "compact" : ""}`} aria-label={label}>
      <Avatar size={compact ? 32 : 38} />
      {compact ? <TierPill /> : (
        <span className="id-text">
          <strong className={name ? "" : "muted"}>{name || "Add your name"}</strong>
          <TierPill />
        </span>
      )}
    </Link>
  );
}
