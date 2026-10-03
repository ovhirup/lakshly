"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { Glass, PageHeader } from "@/components/ui";
import { DataGate } from "@/components/DataState";
import { BackfillCard, useGame } from "@/components/Game";
import { useTier } from "@/components/useTier";
import { usePrivacy } from "@/components/Privacy";
import { formatDate, formatINR, formatPct } from "@/lib/format";
import { maskPctText, pctMasked } from "@/lib/privacy";
import { levelFor } from "@/lib/review";
import { isSingleTier, renderEvidence, ruleText, RULES, TIER_META, type BadgeRule, type LedgerEntry, type Tier } from "@/lib/badges";

const FRAMES_KEY = "lk-badge-frames";
const subHash = (l: () => void) => { window.addEventListener("hashchange", l); return () => window.removeEventListener("hashchange", l); };
const subFrames = (l: () => void) => { window.addEventListener("storage", l); window.addEventListener(FRAMES_KEY, l); return () => { window.removeEventListener("storage", l); window.removeEventListener(FRAMES_KEY, l); }; };

function tierLine(b: BadgeRule, earned: LedgerEntry[]): string {
  if (!earned.length) return "Locked";
  const best = [...earned].sort((x, y) => b.tiers.findIndex((t) => t.tier === y.tier) - b.tiers.findIndex((t) => t.tier === x.tier))[0];
  return isSingleTier(b) ? "Earned" : TIER_META[best.tier].label;
}

/** Share card: name, tier and date only. Never amounts. Rendered on-device to a PNG. */
async function shareBadge(b: BadgeRule, tier: Tier, date: string) {
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1080;
  const g = c.getContext("2d");
  if (!g) return;
  const grad = g.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, "#1f2366"); grad.addColorStop(1, "#3b2a6b");
  g.fillStyle = grad; g.fillRect(0, 0, 1080, 1080);
  g.strokeStyle = "#d9a93a"; g.lineWidth = 14; g.beginPath(); g.arc(540, 430, 230, 0, Math.PI * 2); g.stroke();
  g.textAlign = "center"; g.fillStyle = "#fff";
  g.font = "220px system-ui, 'Apple Color Emoji', 'Noto Color Emoji'"; g.fillText(b.emoji, 540, 510);
  g.font = "700 76px system-ui, sans-serif"; g.fillText(b.name, 540, 790);
  g.font = "600 46px system-ui, sans-serif"; g.fillStyle = "#e9c46a";
  g.fillText(`${isSingleTier(b) ? "" : `${TIER_META[tier].label} · `}${formatDate(date)}`, 540, 870);
  g.font = "500 36px system-ui, sans-serif"; g.fillStyle = "rgba(255,255,255,.7)"; g.fillText("Earned on Lakshly · Every rupee on target", 540, 980);
  const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/png"));
  if (!blob) return;
  const file = new File([blob], `lakshly-${b.id}-${tier}.png`, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], title: b.name }).catch(() => undefined); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function BadgesView() {
  const { evals, ledger, xp, totalXP, facts } = useGame();
  const { can } = useTier();
  const { masked } = usePrivacy();
  const hash = useSyncExternalStore(subHash, () => decodeURIComponent(window.location.hash.slice(1)), () => "");
  const open = RULES.badges.some((x) => x.id === hash) ? hash : null;
  const frames = useSyncExternalStore(subFrames, () => localStorage.getItem(FRAMES_KEY) === "1", () => false);
  const detailRef = useRef<HTMLDivElement>(null);
  const entries = Object.values(ledger.entries);
  const counts = { bronze: 0, silver: 0, gold: 0 } as Record<Tier, number>;
  for (const e of entries) counts[e.tier] += 1;
  const lvl = levelFor(totalXP);
  const premium = can("badges.animatedFrames");
  const showFrames = premium && frames;

  useEffect(() => { if (open) detailRef.current?.focus(); }, [open]);

  const openBadge = useCallback((id: string | null) => {
    history.replaceState(null, "", id ? `#${id}` : window.location.pathname);
    window.dispatchEvent(new Event("hashchange"));
  }, []);
  const toggleFrames = () => { localStorage.setItem(FRAMES_KEY, frames ? "0" : "1"); window.dispatchEvent(new Event(FRAMES_KEY)); };

  // Arrow keys move between tiles; Enter opens (native button).
  const onGridKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    const tiles = [...document.querySelectorAll<HTMLButtonElement>(".badge-tile")];
    const i = tiles.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const cols = Math.max(1, Math.round((tiles[0].parentElement?.clientWidth ?? 1) / (tiles[0].offsetWidth || 1)));
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? cols : -cols;
    tiles[Math.max(0, Math.min(tiles.length - 1, i + step))]?.focus();
  };

  const byId = useMemo(() => new Map(evals.map((e) => [e.id, e])), [evals]);
  const current = open ? RULES.badges.find((b) => b.id === open) : undefined;
  const curEarned = current ? entries.filter((e) => e.id === current.id).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const curEval = current ? byId.get(current.id) : undefined;

  return (
    <>
      <PageHeader title="Badges" subtitle={`🥉 ${counts.bronze} · 🥈 ${counts.silver} · 🥇 ${counts.gold} · Level ${lvl.current.level} ${lvl.current.name}`}>
        {premium
          ? <button className={`frames-pill ${frames ? "on" : ""}`} aria-pressed={frames} onClick={toggleFrames}>Frames ✨ {frames ? "on" : "off"}</button>
          : <Link className="frames-pill" href="/profile/">Frames ✨</Link>}
      </PageHeader>
      <BackfillCard />
      <Glass className="card badges-xp">
        <div className="badges-xp-grid">
          <div><p className="eyebrow">Total XP</p><p className="xp-big">{totalXP}</p></div>
          <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(lvl.progress * 100)} aria-label={lvl.next ? `Progress to ${lvl.next.name}` : "Top level"}><span style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></div>
          <p className="tiny muted">{lvl.next ? `${lvl.next.minXP - totalXP} XP to ${lvl.next.name}` : "Top level reached"} · Badges {xp.total} (history bonus {xp.historyBonus}{xp.banked ? `, ${xp.banked} banked for next week` : ""}) · up to 80 badge XP a week. All badges and XP are free and never for sale.</p>
        </div>
      </Glass>

      <div className="badge-families" onKeyDown={onGridKey}>
        {RULES.families.map((fam) => (
          <section key={fam.id} className="badge-family">
            <h2>{fam.label}</h2>
            <div className="badge-grid">
              {RULES.badges.filter((b) => b.family === fam.id).map((b) => {
                const earned = entries.filter((e) => e.id === b.id);
                const ev = byId.get(b.id);
                const pct = ev?.next ? Math.round(ev.next.pct * 100) : earned.length ? 100 : 0;
                const label = `${b.name}, ${tierLine(b, earned)}, ${earned.length ? `earned ${formatDate(earned.map((e) => e.date).sort().pop()!)}` : ev?.note ?? b.copy.hint}`;
                return (
                  <button key={b.id} id={`badge-${b.id}`} className={`badge-tile ${earned.length ? "earned" : "locked"} ${showFrames && earned.length ? "framed" : ""} ${open === b.id ? "open" : ""}`} aria-label={label} onClick={() => openBadge(b.id)}>
                    <span className="badge-ring" style={{ "--p": `${pct}%` } as React.CSSProperties}><span className="badge-emoji" aria-hidden="true">{b.emoji}</span></span>
                    <span className="badge-name">{b.name}</span>
                    <span className="badge-tiers" aria-hidden="true">{isSingleTier(b) ? (earned.length ? "✓ Earned" : "Locked") : b.tiers.map((t) => <span key={t.tier} className={earned.some((e) => e.tier === t.tier) ? "on" : ""}>{TIER_META[t.tier].medal}</span>)}</span>
                    <span className="badge-hint">{maskPctText(ev?.next ? ev.next.hint : earned.length ? "All tiers earned" : ev?.note ?? b.copy.hint)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {current && (
        <div className="badge-detail-scrim" onClick={() => openBadge(null)}>
          <div ref={detailRef} tabIndex={-1} className="badge-detail glass" role="dialog" aria-modal="true" aria-labelledby="badge-detail-title" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === "Escape") openBadge(null); }}>
            <div className="card-head">
              <h2 id="badge-detail-title"><span aria-hidden="true">{current.emoji}</span> {current.name}</h2>
              <button className="icon-btn" aria-label="Close" onClick={() => openBadge(null)}>×</button>
            </div>
            <p className="badge-rule">{ruleText(current, curEval?.next?.tier ?? curEarned[curEarned.length - 1]?.tier ?? current.tiers[0].tier)}</p>
            <ul className="tier-list">
              {current.tiers.map((t) => {
                const e = curEarned.filter((x) => x.tier === t.tier);
                return (
                  <li key={t.tier} className={e.length ? "on" : ""}>
                    <span className="tier-medal">{isSingleTier(current) ? "🏅" : TIER_META[t.tier].medal} {isSingleTier(current) ? "" : TIER_META[t.tier].label} <small>+{t.xp} XP</small></span>
                    {e.length ? e.map((x) => (
                      <span key={x.entity ?? "x"} className="tier-evidence">
                        <b>Earned {formatDate(x.date)}</b>{x.backfill ? " · found in history" : ""}
                        <span className="muted"> · {renderEvidence(x.evidence, (p) => formatINR(p))}</span>
                        <button className="linkish" onClick={() => void shareBadge(current, x.tier, x.date)}>Share image</button>
                      </span>
                    )) : <span className="muted tiny">{ruleText(current, t.tier)}</span>}
                  </li>
                );
              })}
            </ul>
            {curEval?.next && (
              <div className="badge-next">
                <div className="xp-bar" role="progressbar" {...(pctMasked() ? {} : { "aria-valuenow": Math.round(curEval.next.pct * 100), "aria-valuemin": 0, "aria-valuemax": 100 })} aria-label={pctMasked() ? `Progress to ${TIER_META[curEval.next.tier].label} (hidden)` : `${Math.round(curEval.next.pct * 100)} percent to ${TIER_META[curEval.next.tier].label}`}><span style={{ width: `${Math.round(curEval.next.pct * 100)}%` }} /></div>
                <p className="tiny">Next: {isSingleTier(current) ? current.name : TIER_META[curEval.next.tier].label} · {formatPct(curEval.next.pct * 100, 0)} · {maskPctText(curEval.next.hint)}</p>
              </div>
            )}
            {curEval?.note && !curEarned.length && <p className="tiny muted">{curEval.note}</p>}
            <p className="tiny muted">Data window: {facts.firstDate ? `${formatDate(facts.firstDate)} to ${formatDate(facts.asOf)}` : "no data yet"}. Complete months only, except streaks and balances. Badges are never taken away.{masked ? " Amounts hidden." : ""} <Link href="/spend/">See transactions</Link></p>
          </div>
        </div>
      )}
    </>
  );
}

export default function BadgesPage() {
  return <DataGate title="Badges"><BadgesView /></DataGate>;
}
