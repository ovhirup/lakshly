import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { formatINR, formatINRCompact } from "@/lib/format";
import { setFormatMask } from "@/lib/privacy";

// Pins today's web output. The Swift side pins the same file in apps/apple/LakshlyTests/MoneyParityTests.swift.
// Differences between the platforms are listed in knownDivergences; WP2 removes them. Do not "fix" them here.
type Row = {
  paise: number;
  web: { full: string; decimals: string; signed: string; compact: string };
  swift: { glance: string; compact: string };
};
const fixture = JSON.parse(
  readFileSync(new URL("../../../packages/shared/money/__fixtures__/format-parity.json", import.meta.url), "utf8"),
) as { knownDivergences: number[]; rows: Row[] };

describe("money formatting parity fixture (web side)", () => {
  beforeEach(() => setFormatMask(false, false));

  it("matches the pinned web strings", () => {
    for (const r of fixture.rows) {
      expect(formatINR(r.paise), `full ${r.paise}`).toBe(r.web.full);
      expect(formatINR(r.paise, { decimals: true }), `decimals ${r.paise}`).toBe(r.web.decimals);
      expect(formatINR(r.paise, { signed: true }), `signed ${r.paise}`).toBe(r.web.signed);
      expect(formatINRCompact(r.paise), `compact ${r.paise}`).toBe(r.web.compact);
    }
  });

  it("records exactly the current web/Swift divergences", () => {
    const diverging = fixture.rows
      .filter((r) => r.web.full !== r.swift.glance || r.web.compact !== r.swift.compact)
      .map((r) => r.paise);
    expect(diverging).toEqual(fixture.knownDivergences);
  });
});
