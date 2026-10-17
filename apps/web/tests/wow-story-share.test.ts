import { describe, expect, it } from "vitest";
import {
  shareCardLayout,
  shareTileFrames,
  storyShareFileName,
  storyShareTitle,
  type ShareTile,
} from "../lib/wow/story";

const tiles: ShareTile[] = [
  { label: "Savings rate", value: "20%" },
  { label: "Wants share", value: "30%" },
  { label: "Spend vs last month", value: "-5%" },
  { label: "Budgets kept", value: "2/3" },
  { label: "Worth it", value: "\u2014" },
  { label: "Review XP", value: "+4" },
];

describe("story share image", () => {
  it("names the png from the month", () => {
    expect(storyShareFileName("2026-09")).toBe("lakshly-story-2026-09.png");
    expect(storyShareTitle("September 2026")).toBe("Lakshly · September 2026");
  });

  it("lays six percentage tiles in three rows on a 1080×1350 card", () => {
    const layout = shareCardLayout({ month: "2026-09", label: "September 2026" }, tiles);
    expect(layout.width).toBe(1080);
    expect(layout.height).toBe(1350);
    expect(layout.title).toBe("Lakshly · September 2026");
    expect(layout.footer).toBe("Made with Lakshly · amounts hidden");
    expect(layout.fileName).toBe("lakshly-story-2026-09.png");
    expect(layout.footerY).toBe(1258);
    expect(layout.tiles).toHaveLength(6);
    expect(layout.tiles[0]).toMatchObject({ x: 64, y: 148, width: 466, height: 132, value: "20%" });
    expect(layout.tiles[1]).toMatchObject({ x: 550, y: 148, width: 466 });
    expect(layout.tiles[2].y).toBe(300);
    expect(layout.tiles[4].y).toBe(452);
    for (const tile of layout.tiles) {
      expect(tile.x + tile.width).toBeLessThanOrEqual(1016);
      expect(tile.y + tile.height).toBeLessThan(layout.footerY);
      expect(tile.value).not.toMatch(/[₹$€]/);
    }
  });

  it("gives a trailing tile the full row", () => {
    const frames = shareTileFrames(5);
    expect(frames).toHaveLength(5);
    const first = frames[0];
    const last = frames[4];
    expect(first).toBeDefined();
    expect(last).toBeDefined();
    if (!first || !last) return;
    expect(last.width).toBeGreaterThan(first.width);
    expect(last.x).toBe(first.x);
    expect(last.width).toBe(952);
  });
});
