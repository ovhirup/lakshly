import { describe, expect, it } from "vitest";
import {
  MOTIONS, MOTION_PHASES, PACE_FILL_DELAY_MS, PACE_FILL_MS, PACE_ON_MS,
  endPhase, frameFor, islandTimingStyle, motionDuration, phaseAt, pillCopy,
} from "@/lib/island-storyboard";

describe("island storyboard", () => {
  it("lists the six motions in filming order", () => {
    expect(MOTIONS.map((m) => m.id)).toEqual(["pace", "bloom", "refund", "badge", "import", "duo"]);
  });

  it("walks each phase and holds the end state", () => {
    for (const motion of MOTIONS) {
      const marks = MOTION_PHASES[motion.id];
      expect(marks.map((m) => m.at)).toEqual([...marks.map((m) => m.at)].sort((a, b) => a - b));
      expect(phaseAt(motion.id, 0)).toBe(marks[0].id);
      expect(phaseAt(motion.id, -20)).toBe(marks[0].id);
      for (let i = 1; i < marks.length; i++) {
        expect(phaseAt(motion.id, marks[i].at - 1)).toBe(marks[i - 1].id);
        expect(phaseAt(motion.id, marks[i].at)).toBe(marks[i].id);
      }
      expect(phaseAt(motion.id, motionDuration(motion.id))).toBe(endPhase(motion.id));
      expect(frameFor(motion.id, 0, true)).toBe(endPhase(motion.id));
    }
  });

  it("starts the pace arc with the fill phase and reaches on-pace when the arc finishes", () => {
    expect(MOTION_PHASES.pace.find((p) => p.id === "fill")?.at).toBe(PACE_FILL_DELAY_MS);
    expect(MOTION_PHASES.pace.find((p) => p.id === "on")?.at).toBe(PACE_ON_MS);
    expect(PACE_ON_MS).toBe(PACE_FILL_DELAY_MS + PACE_FILL_MS);
    const style = islandTimingStyle();
    expect(style["--pace-fill-delay"]).toBe(`${PACE_FILL_DELAY_MS}ms`);
    expect(style["--pace-fill"]).toBe(`${PACE_FILL_MS}ms`);
  });

  it("keeps amounts, identifiers, and the rupee sign off the pill", () => {
    const text = pillCopy().join("\n");
    expect(text).not.toMatch(/₹|Rs\.?|INR|\$|rupee/i);
    expect(text).not.toMatch(/@|\b[A-Z]{5}\d{4}[A-Z]\b|\b\d{6,}\b/);
    expect(pillCopy()).toEqual(expect.arrayContaining([
      "on pace",
      "over pace",
      "4-week streak",
      "Refund 5 days left",
      "Refund window closed Copy a complaint",
      "Under Budget Gold",
      "reading on this phone",
      "saved on this phone",
    ]));
  });
});
