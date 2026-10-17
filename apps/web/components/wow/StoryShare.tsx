"use client";
import { useRef } from "react";
import { useAppState } from "@/components/AppState";
import { Icon } from "@/components/Icon";
import { useTier } from "@/components/useTier";
import { Glass, PremiumBadge } from "@/components/ui";
import { IS_BETA } from "@/lib/edition";
import {
  SHARE_FOOTER,
  SHARE_FOOTER_SIZE,
  SHARE_LABEL_SIZE,
  SHARE_TILE_PAD,
  SHARE_TILE_RADIUS,
  SHARE_TILE_TEXT_GAP,
  SHARE_TITLE_SIZE,
  SHARE_VALUE_SIZE,
  shareCardLayout,
  shareTiles,
  storyShareFileName,
  storyShareTitle,
  type MonthlyStory,
} from "@/lib/wow/story";
import "../wow.css";

const FONT = "-apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";

function channels(color: string): [number, number, number] | null {
  const text = color.trim();
  const long = /^#([0-9a-f]{6})$/i.exec(text);
  if (long) {
    const body = long[1];
    return [parseInt(body.slice(0, 2), 16), parseInt(body.slice(2, 4), 16), parseInt(body.slice(4, 6), 16)];
  }
  const short = /^#([0-9a-f]{3})$/i.exec(text);
  if (short) {
    const body = short[1];
    return [
      parseInt(body[0] + body[0], 16),
      parseInt(body[1] + body[1], 16),
      parseInt(body[2] + body[2], 16),
    ];
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i.exec(text);
  if (!rgb) return null;
  return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

/** Blends `tint` over `base` by `amount` (0–1). Used so lotus and gold sit on the card background. */
function mixColor(base: string, tint: string, amount: number): string {
  const from = channels(base);
  const to = channels(tint);
  if (!from || !to) return base || tint;
  const blend = (start: number, end: number) => Math.round(start + (end - start) * amount);
  return `rgb(${blend(from[0], to[0])}, ${blend(from[1], to[1])}, ${blend(from[2], to[2])})`;
}

function fillRound(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const curve = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, curve);
  ctx.fill();
}

function paintShare(preview: HTMLElement, story: MonthlyStory): HTMLCanvasElement | null {
  const layout = shareCardLayout(story, shareTiles(story));
  const canvas = document.createElement("canvas");
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const style = getComputedStyle(preview);
  const bg = style.getPropertyValue("--lk-bg").trim();
  const lotus = style.getPropertyValue("--lk-lotus").trim();
  const gold = style.getPropertyValue("--lk-gold").trim();
  const titleNode = preview.querySelector(".wow-share-title");
  const footNode = preview.querySelector(".wow-share-foot");
  const tileNode = preview.querySelector(".wow-share-tile");
  const ink = titleNode ? getComputedStyle(titleNode).color : style.color;
  const quiet = footNode ? getComputedStyle(footNode).color : style.color;
  const tileFill = tileNode ? getComputedStyle(tileNode).backgroundColor : style.backgroundColor;
  const start = bg || ink;

  const wash = ctx.createLinearGradient(0, 0, layout.width, layout.height);
  wash.addColorStop(0, start);
  wash.addColorStop(0.5, lotus ? mixColor(start, lotus, 0.72) : start);
  wash.addColorStop(1, gold ? mixColor(start, gold, 0.55) : start);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, layout.width, layout.height);

  for (const tile of layout.tiles) {
    ctx.fillStyle = tileFill;
    fillRound(ctx, tile.x, tile.y, tile.width, tile.height, SHARE_TILE_RADIUS);
    const max = Math.max(0, tile.width - SHARE_TILE_PAD * 2);
    ctx.textBaseline = "top";
    ctx.fillStyle = quiet;
    ctx.font = `600 ${SHARE_LABEL_SIZE}px ${FONT}`;
    ctx.fillText(tile.label, tile.x + SHARE_TILE_PAD, tile.y + SHARE_TILE_PAD, max);
    ctx.fillStyle = ink;
    ctx.font = `700 ${SHARE_VALUE_SIZE}px ${FONT}`;
    ctx.fillText(
      tile.value,
      tile.x + SHARE_TILE_PAD,
      tile.y + SHARE_TILE_PAD + SHARE_LABEL_SIZE + SHARE_TILE_TEXT_GAP,
      max,
    );
  }

  ctx.textBaseline = "top";
  ctx.fillStyle = ink;
  ctx.font = `700 ${SHARE_TITLE_SIZE}px ${FONT}`;
  ctx.fillText(layout.title, layout.padding, layout.titleY, layout.width - layout.padding * 2);
  ctx.fillStyle = quiet;
  ctx.font = `600 ${SHARE_FOOTER_SIZE}px ${FONT}`;
  ctx.fillText(layout.footer, layout.padding, layout.footerY, layout.width - layout.padding * 2);
  return canvas;
}

function fileFromPng(dataUrl: string, name: string): File {
  const encoded = dataUrl.split(",")[1] ?? "";
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new File([bytes], name, { type: "image/png" });
}

function saveFile(dataUrl: string, name: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function canShareFile(file: File): boolean {
  if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

async function downloadStory(preview: HTMLElement | null, story: MonthlyStory) {
  if (!preview) return;
  const canvas = paintShare(preview, story);
  if (!canvas) return;
  const name = storyShareFileName(story.month);
  const dataUrl = canvas.toDataURL("image/png");
  const file = fileFromPng(dataUrl, name);
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: storyShareTitle(story.label) });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  saveFile(dataUrl, name);
}

/** Premium draws the share card. Free keeps the locked card. */
export function StoryShareSection({ story }: { story: MonthlyStory }) {
  const { can } = useTier();
  const { setPlan } = useAppState();
  const previewRef = useRef<HTMLDivElement>(null);
  const tiles = shareTiles(story);

  if (!can("wow.storyShare")) {
    return (
      <Glass className="card wow-locked" data-testid="wow-storyShare-card" data-month={story.month}>
        <div className="wow-locked-top">
          <div className="wow-lock" aria-hidden="true"><Icon name="lock" size={18} /></div>
          <div>
            <h2>Share your story</h2>
            <p className="muted">Pick any past month and share a story card. The image shows percentages only, never amounts.</p>
          </div>
        </div>
        <PremiumBadge small />
        {IS_BETA
          ? <button type="button" className="btn primary" data-testid="wow-storyShare-preview" onClick={() => setPlan("premium")}>Preview Premium (demo)</button>
          : <p className="tiny muted">Payments aren’t live yet.</p>}
      </Glass>
    );
  }

  return (
    <Glass className="card wow-share" data-testid="wow-storyShare-card" data-month={story.month}>
      <h2>Share your story</h2>
      <div className="wow-share-card" ref={previewRef} data-testid="wow-storyShare-image">
        <p className="wow-share-title">{storyShareTitle(story.label)}</p>
        <div className="wow-share-grid">
          {tiles.map((tile) => (
            <div className="wow-share-tile" key={tile.label}>
              <span>{tile.label}</span>
              <strong>{tile.value}</strong>
            </div>
          ))}
        </div>
        <p className="wow-share-foot">{SHARE_FOOTER}</p>
      </div>
      <button
        type="button"
        className="btn primary"
        data-testid="wow-storyShare-download"
        onClick={() => { void downloadStory(previewRef.current, story); }}
      >
        Download image
      </button>
    </Glass>
  );
}
