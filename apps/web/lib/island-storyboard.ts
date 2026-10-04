/** Phase clock for the /island storyboard. Visuals live in CSS; this only names when each beat starts. */

export const HOLD_MS = 1400;

export const PACE_FILL_DELAY_MS = 400;
export const PACE_FILL_MS = 2200;
export const PACE_ON_MS = PACE_FILL_DELAY_MS + PACE_FILL_MS;
export const PACE_OVER_MS = PACE_ON_MS + 1000;

export const BLOOM_OPEN_MS = 360;
export const BLOOM_PETAL_MS = 980;
export const BLOOM_SETTLE_MS = 2100;

export const REFUND_COUNT2_MS = 900;
export const REFUND_CLOSED_MS = 1800;
export const REFUND_HINT_MS = 2700;

export const BADGE_POP_MS = 280;
export const BADGE_POP_DUR_MS = 720;
export const BADGE_NAME_MS = 1100;
export const BADGE_TIER_MS = 1900;

export const IMPORT_BREATH_MS = 1100;
export const IMPORT_BREATHS = 2;
export const IMPORT_SAVED_MS = IMPORT_BREATH_MS * IMPORT_BREATHS + 80;
export const IMPORT_SNAP_MS = 380;

export const DUO_INNER_MS = 700;
export const DUO_JUMP_MS = 1500;
export const DUO_JUMP_DUR_MS = 760;
export const DUO_CARD_MS = DUO_JUMP_MS + DUO_JUMP_DUR_MS;

/** Every string that can appear inside a pill. Amounts, the rupee sign, and legal deadlines stay out. */
export const PILL_COPY = {
  onPace: "on pace",
  overPace: "over pace",
  streak: "4-week streak",
  refund: "Refund",
  days5: "5 days left",
  days2: "2 days left",
  closed: "window closed",
  complaint: "Copy a complaint",
  badge: "Under Budget",
  tier: "Gold",
  reading: "reading on this phone",
  saved: "saved on this phone",
} as const;

export const MOTIONS = [
  { id: "pace", title: "Pace ring", note: "The gold arc fills the month and pulses once at 80%." },
  { id: "bloom", title: "Sunday bloom", note: "The pill opens into a lotus once, then settles on a streak." },
  { id: "refund", title: "Refund countdown", note: "Demo of a refund window. Not legal advice." },
  { id: "badge", title: "Badge pop", note: "A badge name, then a tier word. Never a balance." },
  { id: "import", title: "Import breath", note: "Reading and saving stay on this phone. Nothing is sent." },
  { id: "duo", title: "Duo handoff", note: "Design preview of two pills. iPhone Duo is a spec, not a device you can buy." },
] as const;

export type MotionId = (typeof MOTIONS)[number]["id"];

export interface PhaseMark { id: string; at: number }

export const MOTION_PHASES: Record<MotionId, readonly PhaseMark[]> = {
  pace: [
    { id: "compact", at: 0 },
    { id: "fill", at: PACE_FILL_DELAY_MS },
    { id: "on", at: PACE_ON_MS },
    { id: "over", at: PACE_OVER_MS },
  ],
  bloom: [
    { id: "compact", at: 0 },
    { id: "open", at: BLOOM_OPEN_MS },
    { id: "bloom", at: BLOOM_OPEN_MS + 420 },
    { id: "settle", at: BLOOM_SETTLE_MS },
  ],
  refund: [
    { id: "count5", at: 0 },
    { id: "count2", at: REFUND_COUNT2_MS },
    { id: "closed", at: REFUND_CLOSED_MS },
    { id: "hint", at: REFUND_HINT_MS },
  ],
  badge: [
    { id: "rest", at: 0 },
    { id: "pop", at: BADGE_POP_MS },
    { id: "name", at: BADGE_NAME_MS },
    { id: "tier", at: BADGE_TIER_MS },
  ],
  import: [
    { id: "reading", at: 0 },
    { id: "saved", at: IMPORT_SAVED_MS },
  ],
  duo: [
    { id: "outer", at: 0 },
    { id: "inner", at: DUO_INNER_MS },
    { id: "jump", at: DUO_JUMP_MS },
    { id: "card", at: DUO_CARD_MS },
  ],
};

export function motionDuration(id: MotionId): number {
  const marks = MOTION_PHASES[id];
  return marks[marks.length - 1].at + HOLD_MS;
}

export function endPhase(id: MotionId): string {
  const marks = MOTION_PHASES[id];
  return marks[marks.length - 1].id;
}

export function phaseAt(id: MotionId, elapsedMs: number): string {
  const marks = MOTION_PHASES[id];
  let current = marks[0].id;
  for (const mark of marks) {
    if (elapsedMs >= mark.at) current = mark.id;
    else break;
  }
  return current;
}

export function frameFor(id: MotionId, elapsedMs: number, reduced: boolean): string {
  return reduced ? endPhase(id) : phaseAt(id, elapsedMs);
}

export function refundTrail(phase: string): string {
  if (phase === "count5") return PILL_COPY.days5;
  if (phase === "count2") return PILL_COPY.days2;
  return PILL_COPY.closed;
}

/** Full visible pill text for a frame, used by the page and the amount guard. */
export function pillText(id: MotionId, phase: string): string {
  switch (id) {
    case "pace":
      if (phase === "on") return PILL_COPY.onPace;
      if (phase === "over") return PILL_COPY.overPace;
      return "";
    case "bloom":
      return phase === "settle" ? PILL_COPY.streak : "";
    case "refund": {
      const hint = phase === "hint" ? ` ${PILL_COPY.complaint}` : "";
      return `${PILL_COPY.refund} ${refundTrail(phase)}${hint}`;
    }
    case "badge":
      if (phase === "name") return PILL_COPY.badge;
      if (phase === "tier") return `${PILL_COPY.badge} ${PILL_COPY.tier}`;
      return "";
    case "import":
      return phase === "saved" ? PILL_COPY.saved : PILL_COPY.reading;
    case "duo":
      return phase === "card" ? PILL_COPY.onPace : "";
    default:
      return "";
  }
}

export function pillCopy(): string[] {
  const seen: string[] = [];
  for (const motion of MOTIONS) {
    for (const mark of MOTION_PHASES[motion.id]) {
      const text = pillText(motion.id, mark.id).replace(/\s+/g, " ").trim();
      if (text && !seen.includes(text)) seen.push(text);
    }
  }
  return seen;
}

/** CSS custom properties so the animations use the same clock as the phase marks. */
export function islandTimingStyle(): Record<string, string> {
  return {
    "--pace-fill": `${PACE_FILL_MS}ms`,
    "--pace-fill-delay": `${PACE_FILL_DELAY_MS}ms`,
    "--bloom-delay": `${BLOOM_OPEN_MS}ms`,
    "--bloom-petal": `${BLOOM_PETAL_MS}ms`,
    "--badge-pop-delay": `${BADGE_POP_MS}ms`,
    "--badge-pop-dur": `${BADGE_POP_DUR_MS}ms`,
    "--import-breath": `${IMPORT_BREATH_MS}ms`,
    "--import-breaths": `${IMPORT_BREATHS}`,
    "--import-snap-delay": `${IMPORT_SAVED_MS}ms`,
    "--import-snap": `${IMPORT_SNAP_MS}ms`,
    "--duo-jump-delay": `${DUO_JUMP_MS}ms`,
    "--duo-jump-dur": `${DUO_JUMP_DUR_MS}ms`,
    "--duo-land-delay": `${DUO_CARD_MS - 180}ms`,
  };
}
