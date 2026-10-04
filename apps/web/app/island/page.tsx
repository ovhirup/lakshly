"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PageHeader } from "@/components/ui";
import {
  MOTIONS, PILL_COPY, endPhase, frameFor, islandTimingStyle, motionDuration, pillText, refundTrail,
  type MotionId,
} from "@/lib/island-storyboard";
import "./island.css";

const PETAL = "M0 -44C11 -28 12 -12 0 0C-12 -12 -11 -28 0 -44Z";
const PETAL_TURNS = [-78, 78, -50, 50, -24, 24, 0];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function PaceRing() {
  return (
    <svg className="pace-ring" viewBox="0 0 44 44" aria-hidden="true">
      <circle className="track" cx="22" cy="22" r="16" />
      <circle className="arc" cx="22" cy="22" r="16" pathLength="100" />
    </svg>
  );
}

function Lotus() {
  return (
    <svg className="lotus" viewBox="-56 -64 112 78" aria-hidden="true">
      {PETAL_TURNS.map((deg, i) => (
        <g key={deg} transform={`rotate(${deg})`}>
          <path className={i % 2 === 0 ? "lotus-petal deep" : "lotus-petal"} d={PETAL} style={{ "--i": i } as CSSProperties} />
        </g>
      ))}
      <circle className="lotus-core" cx="0" cy="-2" r="4.5" />
    </svg>
  );
}

function Medal() {
  return (
    <svg className="medal" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M11 3.5h10l-1.7 7.2h-6.6L11 3.5Z" fill="currentColor" />
      <circle cx="16" cy="19" r="8.2" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M16 14.2l1.35 2.7 3 .4-2.15 2.1.5 3L16 21.1l-2.7 1.3.5-3-2.15-2.1 3-.4 1.35-2.7Z" fill="currentColor" />
    </svg>
  );
}

function Pill({ expanded, children, label }: { expanded?: boolean; children: ReactNode; label: string }) {
  return (
    <div className={`island-pill ${expanded ? "is-expanded" : ""}`} data-island-pill="" aria-label={label}>
      {children}
    </div>
  );
}

function MotionFace({ id, phase }: { id: MotionId; phase: string }) {
  if (id === "pace") {
    const line = phase === "over" ? PILL_COPY.overPace : phase === "on" ? PILL_COPY.onPace : "";
    return (
      <Pill expanded={phase === "on" || phase === "over"} label={line || "Pace ring"}>
        <span className="ring-pulse"><PaceRing /></span>
        {line && <p className="pill-line" key={line}>{line}</p>}
      </Pill>
    );
  }

  if (id === "bloom") {
    const settled = phase === "settle";
    return (
      <Pill expanded={false} label={settled ? PILL_COPY.streak : "Sunday bloom"}>
        <Lotus />
        {settled && <p className="pill-line streak-num">{PILL_COPY.streak}</p>}
      </Pill>
    );
  }

  if (id === "refund") {
    const trail = refundTrail(phase);
    const hint = phase === "hint";
    return (
      <Pill expanded={hint} label={pillText("refund", phase)}>
        <span className="refund-lead">{PILL_COPY.refund}</span>
        <span className="refund-trail" key={trail}>{trail}</span>
        {hint && <p className="refund-hint">{PILL_COPY.complaint}</p>}
      </Pill>
    );
  }

  if (id === "badge") {
    const named = phase === "name" || phase === "tier";
    const tier = phase === "tier";
    return (
      <Pill expanded={tier} label={pillText("badge", phase) || "Badge"}>
        <span className="medal-wrap"><Medal /></span>
        {named && (
          <span className="pill-stack">
            <p className="badge-name">{PILL_COPY.badge}</p>
            {tier && <p className="badge-tier">{PILL_COPY.tier}</p>}
          </span>
        )}
      </Pill>
    );
  }

  if (id === "import") {
    const saved = phase === "saved";
    const line = saved ? PILL_COPY.saved : PILL_COPY.reading;
    return (
      <Pill label={line}>
        <p className="import-line" key={line}>{line}</p>
      </Pill>
    );
  }

  const card = phase === "card";
  return (
    <div className="duo">
      <div className="outer">
        <Pill label="Pace ring"><PaceRing /></Pill>
      </div>
      <div className="duo-jumper" aria-hidden="true"><PaceRing /></div>
      <div className="inner">
        <Pill expanded={card} label={card ? PILL_COPY.onPace : "Inner pill"}>
          <PaceRing />
          {card && <p className="pill-line">{PILL_COPY.onPace}</p>}
        </Pill>
      </div>
    </div>
  );
}

const FILM_GAP_MS = 640;

export function IslandBoard({ filmOnLoad = false }: { filmOnLoad?: boolean }) {
  const reduced = useReducedMotion();
  const auto = useRef(!filmOnLoad);
  const [active, setActive] = useState<MotionId>(MOTIONS[0].id);
  const [playId, setPlayId] = useState(0);
  const [phase, setPhase] = useState("compact");
  const [seenMotion, setSeenMotion] = useState<MotionId>(MOTIONS[0].id);
  const [film, setFilm] = useState<"off" | "count" | "play" | "done">(filmOnLoad ? "count" : "off");
  const [count, setCount] = useState(3);
  if (seenMotion !== active) {
    setSeenMotion(active);
    setPhase(reduced ? endPhase(active) : frameFor(active, 0, false));
  }
  const shownPhase = reduced ? endPhase(active) : phase;
  const motion = MOTIONS.find((m) => m.id === active) ?? MOTIONS[0];
  const index = MOTIONS.findIndex((m) => m.id === active);
  const filming = film !== "off";

  const armFilm = () => {
    auto.current = true;
    setCount(3);
    setPhase(frameFor(MOTIONS[0].id, 0, reduced));
    setActive(MOTIONS[0].id);
    setPlayId((n) => n + 1);
    setFilm("count");
  };

  useEffect(() => {
    if (film === "off") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFilm("off"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [film]);

  useEffect(() => {
    if (film !== "count") return;
    const timer = window.setTimeout(() => {
      if (reduced) {
        setFilm("play");
        return;
      }
      setCount((n) => {
        if (n <= 1) {
          setFilm("play");
          return 0;
        }
        return n - 1;
      });
    }, reduced ? 0 : 700);
    return () => window.clearTimeout(timer);
  }, [film, count, reduced]);

  useEffect(() => {
    if (film === "count" || film === "done" || reduced) {
      if (reduced) auto.current = false;
      return;
    }
    const total = motionDuration(active);
    const start = performance.now();
    let raf = 0;
    let gapTimer = 0;
    let stopped = false;
    let current = frameFor(active, 0, false);
    const tick = (now: number) => {
      if (stopped) return;
      const t = now - start;
      if (t >= total) {
        const idx = MOTIONS.findIndex((m) => m.id === active);
        if (auto.current && idx >= 0 && idx < MOTIONS.length - 1) {
          const next = MOTIONS[idx + 1].id;
          const advance = () => {
            if (stopped) return;
            setPhase(frameFor(next, 0, false));
            setActive(next);
          };
          if (film === "play") gapTimer = window.setTimeout(advance, FILM_GAP_MS);
          else advance();
        } else {
          auto.current = false;
          setPhase(endPhase(active));
          if (film === "play") setFilm("done");
        }
        return;
      }
      const next = frameFor(active, t, false);
      if (next !== current) {
        current = next;
        setPhase(next);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(gapTimer);
    };
  }, [active, playId, reduced, film]);

  const replay = (id: MotionId) => {
    auto.current = false;
    setPhase(frameFor(id, 0, reduced));
    if (id === active) setPlayId((n) => n + 1);
    else setActive(id);
  };

  return (
    <div className={`island-board motion-${active} ${filming ? "is-filming" : ""} ${film === "count" ? "is-counting" : ""} ${film === "done" ? "is-done" : ""}`} data-phase={shownPhase} style={islandTimingStyle() as CSSProperties}>
      <div className="island-chrome">
        <PageHeader
          title="Island motions"
          subtitle="Six takes for the camera. Synthetic demo. Nothing is sent off this phone."
        />
        <p className="island-actions"><button type="button" className="island-film" onClick={armFilm}>Film the take</button></p>
      </div>

      <div className={`island-stage ${active === "duo" ? "is-duo" : ""}`} key={`${active}-${playId}`}>
        {film === "count" && count > 0 ? <p className="island-count" aria-live="assertive">{count}</p> : <MotionFace id={active} phase={shownPhase} />}
        <p className="island-slate">{motion.title}</p>
      </div>

      <div className="island-chrome">
      <p className="island-caption">Storyboard. Synthetic. Amounts stay off the pill.</p>
      <p className="island-note">{motion.note}</p>

      <ol className="island-takes">
        {MOTIONS.map((m, i) => (
          <li key={m.id} className={m.id === active ? "is-current" : undefined} aria-current={m.id === active ? "true" : undefined}>
            <span className="take-title">
              <strong>{i + 1}. {m.title}</strong>
              <span className="take-note">{m.note}</span>
            </span>
            <button type="button" className="island-replay" onClick={() => replay(m.id)} aria-label={`Replay ${m.title}`}>
              Replay
            </button>
          </li>
        ))}
      </ol>
      </div>
      {film === "done" && <button type="button" className="island-again" onClick={armFilm}>Take again</button>}
      {filming && film !== "done" && <button type="button" className="island-exit" onClick={() => setFilm("off")}>Leave film</button>}
      <p className="sr-only" aria-live="polite">{film === "count" && count > 0 ? count : `${index + 1}. ${motion.title}. ${pillText(active, shownPhase)}`}</p>
    </div>
  );
}

export default function IslandPage() {
  return <IslandBoard />;
}
