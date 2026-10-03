"use client";
import { Glass } from "./ui";
import { Switch } from "./PrivacySettings";
import { saveCoachPrefs, useGame } from "./Game";
import { useTier } from "./useTier";
import { formatINR } from "@/lib/format";
import { CATALOG, renderNudge, snoozedUntil, SOURCES, type Candidate, type Tone } from "@/lib/nudges";

const TONES: { id: Tone; label: string; blurb: string }[] = [
  { id: "hype", label: "Hype", blurb: "Cheerful and encouraging" },
  { id: "straight", label: "Straight", blurb: "Just the facts (default)" },
  { id: "roast", label: "Roast-lite", blurb: "Playful teasing, never mean" },
];

export function CoachSettings() {
  const { prefs, decision, log, unsnooze, facts } = useGame();
  const { can } = useTier();
  const premium = can("nudges.tone.roast");
  const sample: { def: (typeof CATALOG.nudges)[number]; c: Candidate } = decision.shown
    ? { def: decision.shown.def, c: decision.shown }
    : { def: CATALOG.nudges.find((n) => n.id === "review_waiting")!, c: { id: "review_waiting", subject: "sample", vars: { count: 6 } } };
  const previewTone: Tone = prefs.tone === "roast" && (!premium || sample.def.templates.roast === null) ? "straight" : prefs.tone;
  const now = Date.parse(`${facts.today}T12:00:00`);
  const snoozed = [...new Map(log.filter((e) => ["notNow", "snooze7", "snooze30", "off"].includes(e.action)).map((e) => [`${e.id}:${e.subject}`, e])).values()]
    .map((e) => ({ e, until: snoozedUntil(log, e.id, e.subject) })).filter((x) => x.until > now);
  const setTone = (t: Tone) => { if (t === "roast" && !premium) return; saveCoachPrefs({ ...prefs, tone: t }); };

  return (
    <Glass className="card coach-settings">
      <div className="card-head"><h2>Coach</h2><span className="badge small">At most 1 nudge a day</span></div>
      <p className="editor-label">Tone</p>
      <div className="tone-grid" role="radiogroup" aria-label="Coach tone">
        {TONES.map((t) => {
          const locked = t.id === "roast" && !premium;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={prefs.tone === t.id} aria-disabled={locked} className={`tone-opt ${prefs.tone === t.id ? "on" : ""} ${locked ? "locked" : ""}`} onClick={() => setTone(t.id)}>
              <b>{t.label}{locked ? " 🔒" : ""}</b><small>{locked ? "Part of Premium" : t.blurb}</small>
            </button>
          );
        })}
      </div>
      <div className="tone-preview" aria-live="polite"><span className="tiny muted">Preview (amounts hidden):</span> {renderNudge(sample.def, sample.c, previewTone, true, (p) => formatINR(p))}</div>

      <p className="editor-label">Nudge me about</p>
      {SOURCES.map((s) => (
        <div className="toggle-row" key={s.id}>
          <div className="grow"><b>{s.label}</b></div>
          <Switch checked={prefs.sources[s.id] !== false} onChange={(v) => saveCoachPrefs({ ...prefs, sources: { ...prefs.sources, [s.id]: v } })} label={s.label} />
        </div>
      ))}
      <p className="tiny muted">On the web, nudges appear as one card inside the app; nothing is pushed and nothing leaves this device. Quiet hours 22:00–08:00 apply to phone notifications in the Apple apps.</p>
      {decision.guardrail && <p className="tiny">You&apos;ve been snoozing a lot, so we&apos;re keeping it to one nudge a week in Straight tone for now. <button className="linkish" onClick={() => saveCoachPrefs({ ...prefs, guardrailOptOutUntil: new Date(now + 30 * 86400000).toISOString() })}>Go back to normal</button></p>}
      {snoozed.length > 0 && (
        <>
          <p className="editor-label">Snoozed</p>
          <ul className="snoozed-list">
            {snoozed.map(({ e, until }) => (
              <li key={`${e.id}:${e.subject}`}><span>{e.id.replace(/_/g, " ")} · {e.action === "off" ? "off" : `until ${new Date(until).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}</span><button className="linkish" onClick={() => unsnooze(e.id, e.subject)}>Undo</button></li>
            ))}
          </ul>
        </>
      )}
    </Glass>
  );
}
