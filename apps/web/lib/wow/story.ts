// Pure monthly story. Amounts are paise. No React.
// Share text is percentages and counts only. Card bills, transfers and income are not spend.
import type { Budget, Category, Transaction } from "../schema.gen";
import {
  effectiveNwv, monthlyRatio, NWV_BY_CATEGORY, weekMonday,
  type ReviewState, type ReviewTxn, type WorthMonth,
} from "../review";

export interface StoryCategory {
  name: string;
  paise: number;
  sharePct: number;
}

export interface StoryWant {
  merchant: string;
  paise: number;
  sharePct: number;
}

/** One month, told in percentages. Amounts stay in paise and never go on a share image. */
export interface MonthlyStory {
  month: string;
  label: string;
  /** True when `month` is the month of the review clock passed into `buildStory`. */
  partial: boolean;
  spendPaise: number;
  incomePaise: number;
  /** `(income - spend) / income × 100`. Null when the month has no income. */
  savingsRate: number | null;
  /** Spend versus the previous calendar month. Null when that month has no spend. */
  spendChangePct: number | null;
  topCategory: StoryCategory;
  /** Biggest merchant whose effective Need/Want/Vice is want or vice. Share is of total spend. */
  topWant: StoryWant | null;
  /** Want + vice spend / spend × 100. */
  wantsSharePct: number;
  budgetsKept: number;
  budgetsTotal: number;
  worth: WorthMonth;
  reviewXP: number;
  win: string;
}

export interface StorySlide {
  id: string;
  label: string;
  headline: string;
  detail: string;
}

export interface ShareTile {
  label: string;
  value: string;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** Card bill payments are transfers by category, or read as one from the description or merchant. */
const CARD_BILL = /\b(transfer|trf|cc\s*bill|card\s*bill|card\s*payment|payment\s*received|autopay\s*thank|bbps|own\s+account|to\s+self)\b/i;

/**
 * `month` is `yyyy-MM`. `now` is the review clock (pinned demo evening, or the real clock).
 * Rows used for Worth-it and Need/Want/Vice default to `txns`.
 */
export function buildStory(
  txns: readonly Transaction[],
  review: ReviewState,
  month: string,
  budgets: readonly Budget[] = [],
  now: Date = new Date(),
  reviewTxns?: readonly ReviewTxn[],
): MonthlyStory {
  const ratedRows = reviewTxns ?? txns;
  const spendByMonth = new Map<string, number>();
  const categorySpend = new Map<string, number>();
  const monthSpendRows: Transaction[] = [];
  let income = 0;

  for (const txn of txns) {
    const bucket = txn.date.slice(0, 7);
    const cardBill = isCardBill(txn);
    if (isIncome(txn, cardBill) && bucket === month) income += txn.amount;
    if (!isSpend(txn, cardBill)) continue;
    const paise = -txn.amount;
    spendByMonth.set(bucket, (spendByMonth.get(bucket) ?? 0) + paise);
    if (bucket === month) {
      categorySpend.set(txn.category, (categorySpend.get(txn.category) ?? 0) + paise);
      monthSpendRows.push(txn);
    }
  }

  const spend = spendByMonth.get(month) ?? 0;
  const previous = previousMonth(month);
  const previousSpend = previous ? spendByMonth.get(previous) ?? 0 : 0;
  const spendChangePct = previousSpend > 0 ? ((spend - previousSpend) / previousSpend) * 100 : null;
  const savingsRate = income > 0 ? ((income - spend) / income) * 100 : null;

  let top: { name: string; paise: number } | null = null;
  for (const [name, paise] of categorySpend) {
    if (!top || paise > top.paise || (paise === top.paise && name < top.name)) top = { name, paise };
  }
  const topCategory: StoryCategory = top
    ? { name: top.name, paise: top.paise, sharePct: share(top.paise, spend) }
    : { name: "", paise: 0, sharePct: 0 };

  const topWant = biggestWant(monthSpendRows, spend, review, ratedRows);
  const wantPaise = wantViceSpend(monthSpendRows, review, ratedRows);
  const monthBudgets = budgets.filter((budget) => budget.month === month);
  let budgetsKept = 0;
  for (const budget of monthBudgets) {
    if ((categorySpend.get(budget.category) ?? 0) <= budget.limit) budgetsKept += 1;
  }

  const story: MonthlyStory = {
    month,
    label: monthLabel(month),
    partial: month === monthId(now),
    spendPaise: spend,
    incomePaise: income,
    savingsRate,
    spendChangePct,
    topCategory,
    topWant,
    wantsSharePct: share(wantPaise, spend),
    budgetsKept,
    budgetsTotal: monthBudgets.length,
    worth: monthlyRatio(ratedRows, review, month),
    reviewXP: reviewXp(review, month),
    win: "",
  };
  return { ...story, win: winLine(story, previous) };
}

export function storySlides(story: MonthlyStory): StorySlide[] {
  const name = monthName(story.month);
  const intro = `Your ${name}` + (story.partial ? " (so far)" : "");
  const wantHeadline = story.topWant?.merchant ?? "No want stood out";
  const wantDetail = `Wants share ${formatNumber(story.wantsSharePct)}%`;
  const savingsHeadline = story.savingsRate === null
    ? "No income this month"
    : `Saved ${formatNumber(story.savingsRate)}% of income`;
  const worthHeadline = story.worth.rated >= 5 && story.worth.ratio !== null
    ? `${formatNumber(story.worth.ratio * 100)}% worth it`
    : "Rate a few Wants in Review to see this";
  const categoryDetail = story.topCategory.paise > 0
    ? `${formatNumber(story.topCategory.sharePct)}% of spend`
    : "No spend in this month";
  return [
    slide("intro", "Intro", intro, story.label),
    slide("win", "Win", story.win, ""),
    slide("category", "Top category", story.topCategory.name, categoryDetail),
    slide("want", "Top want", wantHeadline, wantDetail),
    slide("budgets", "Budgets", `Kept ${story.budgetsKept} of ${story.budgetsTotal}`, ""),
    slide("savings", "Savings", savingsHeadline, ""),
    slide("worth", "Worth it", worthHeadline, ""),
    slide("xp", "Review XP", `+${story.reviewXP}`, ""),
    slide("outro", "Share", `Share your ${name}`, "The image shows percentages only, never amounts."),
  ];
}

/** Percentages and counts only. Amounts never appear here. */
export function shareTiles(story: MonthlyStory): ShareTile[] {
  const savings = story.savingsRate === null ? "\u2014" : formatPercent(story.savingsRate);
  const change = story.spendChangePct === null ? "\u2014" : formatPercent(story.spendChangePct, true);
  const worth = story.worth.rated >= 5 && story.worth.ratio !== null
    ? formatPercent(story.worth.ratio * 100)
    : "\u2014";
  const rows: ShareTile[] = [
    { label: "Savings rate", value: savings },
    { label: "Wants share", value: formatPercent(story.wantsSharePct) },
    { label: "Spend vs last month", value: change },
    { label: "Budgets kept", value: `${story.budgetsKept}/${story.budgetsTotal}` },
    { label: "Worth it", value: worth },
    { label: "Review XP", value: `+${story.reviewXP}` },
  ];
  return rows.map((row) => ({ label: shareSafe(row.label), value: shareSafe(row.value) }));
}

/** Strips ₹/$/€ amounts (commas and decimals included) so a share image cannot leak money. */
export function shareSafe(text: string): string {
  return text.replace(/[−+\-]?\s*[₹$€]\s*[0-9][0-9,]*(?:\.[0-9]+)?/g, "");
}

function isCardBill(txn: Transaction): boolean {
  if (txn.category === "transfers") return true;
  return CARD_BILL.test(`${txn.description} ${txn.merchant ?? ""}`);
}

function isSpend(txn: Transaction, cardBill: boolean): boolean {
  return txn.amount < 0 && txn.category !== "investments" && !cardBill;
}

function isIncome(txn: Transaction, cardBill: boolean): boolean {
  return txn.amount > 0 && txn.category === "income" && !cardBill;
}

function share(part: number, total: number): number {
  if (total <= 0) return 0;
  return (part / total) * 100;
}

function biggestWant(
  rows: readonly Transaction[],
  spend: number,
  review: ReviewState,
  reviewTxns: readonly ReviewTxn[],
): StoryWant | null {
  const byId = new Map<string, ReviewTxn>();
  for (const row of reviewTxns) if (!byId.has(row.id)) byId.set(row.id, row);
  const buckets = new Map<string, { name: string; paise: number; order: number }>();
  let order = 0;
  for (const txn of rows) {
    const reviewTxn = byId.get(txn.id) ?? txn;
    if (!isWantOrVice(reviewTxn, txn.category, review)) continue;
    const name = displayMerchant(txn);
    const slug = name.trim().toLowerCase();
    const existing = buckets.get(slug);
    if (existing) existing.paise += -txn.amount;
    else {
      buckets.set(slug, { name, paise: -txn.amount, order });
      order += 1;
    }
  }
  let top: { name: string; paise: number; order: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!top || bucket.paise > top.paise || (bucket.paise === top.paise && bucket.order < top.order)) top = bucket;
  }
  if (!top) return null;
  return { merchant: top.name, paise: top.paise, sharePct: share(top.paise, spend) };
}

function wantViceSpend(
  rows: readonly Transaction[],
  review: ReviewState,
  reviewTxns: readonly ReviewTxn[],
): number {
  const byId = new Map<string, ReviewTxn>();
  for (const row of reviewTxns) if (!byId.has(row.id)) byId.set(row.id, row);
  let sum = 0;
  for (const txn of rows) {
    const reviewTxn = byId.get(txn.id) ?? txn;
    if (isWantOrVice(reviewTxn, txn.category, review)) sum += -txn.amount;
  }
  return sum;
}

function isWantOrVice(row: ReviewTxn, fallbackCategory: Category, review: ReviewState): boolean {
  const nwv = effectiveNwv(row, review) ?? NWV_BY_CATEGORY[row.category] ?? NWV_BY_CATEGORY[fallbackCategory];
  return nwv === "want" || nwv === "vice";
}

function displayMerchant(txn: Transaction): string {
  const merchant = txn.merchant?.trim();
  if (merchant) return merchant;
  return txn.description;
}

function reviewXp(review: ReviewState, month: string): number {
  let sum = 0;
  for (const [weekId, gained] of Object.entries(review.weekXP)) {
    if (typeof gained !== "number" || !Number.isFinite(gained)) continue;
    if (weekMonday(weekId).startsWith(month)) sum += gained;
  }
  return sum;
}

function winLine(story: MonthlyStory, previous: string | null): string {
  if (story.budgetsKept === story.budgetsTotal && story.budgetsTotal > 0) return "Every budget kept 🎯";
  const change = story.spendChangePct;
  if (change !== null && (change <= -5 || Math.abs(change + 5) < 0.000001)) {
    return `Spent ${formatNumber(Math.abs(change))}% less than ${monthName(previous ?? "")} 📉`;
  }
  const rate = story.savingsRate;
  if (rate !== null && (rate >= 20 || Math.abs(rate - 20) < 0.000001)) {
    return `Saved ${formatNumber(rate)}% of income 💪`;
  }
  if (story.budgetsKept > 0) return `Kept ${story.budgetsKept} of ${story.budgetsTotal} budgets ✅`;
  return "You showed up and looked. That counts ✍️";
}

function slide(id: string, label: string, headline: string, detail: string): StorySlide {
  return { id, label, headline: shareSafe(headline), detail: shareSafe(detail) };
}

function formatNumber(value: number): string {
  const rounded = Math.round(Math.abs(value) * 10) / 10;
  if (rounded === Math.round(rounded)) return String(Math.trunc(rounded));
  return rounded.toFixed(1);
}

function formatPercent(value: number, signed = false): string {
  const body = formatNumber(value);
  if (body === "0") return "0%";
  if (signed) return `${value > 0 ? "+" : "-"}${body}%`;
  return `${value < 0 ? "-" : ""}${body}%`;
}

/** The calendar month before `yyyy-MM`. Null when the id is not a month. */
function previousMonth(month: string): string | null {
  const parts = month.split("-").map(Number);
  if (parts.length !== 2 || !Number.isInteger(parts[0]) || !Number.isInteger(parts[1])) return null;
  if (parts[1] < 1 || parts[1] > 12) return null;
  const year = parts[1] === 1 ? parts[0] - 1 : parts[0];
  const monthIndex = parts[1] === 1 ? 12 : parts[1] - 1;
  if (year <= 0) return null;
  return `${String(year).padStart(4, "0")}-${String(monthIndex).padStart(2, "0")}`;
}

function monthId(now: Date): string {
  const year = now.getFullYear();
  const month = Math.min(12, Math.max(1, now.getMonth() + 1));
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function monthParts(month: string): { year: number; month: number } | null {
  const bits = month.split("-").map(Number);
  if (bits.length !== 2 || !Number.isInteger(bits[0]) || !Number.isInteger(bits[1])) return null;
  if (bits[1] < 1 || bits[1] > 12) return null;
  return { year: bits[0], month: bits[1] };
}

function monthLabel(month: string): string {
  const parts = monthParts(month);
  if (!parts) return month;
  return `${MONTHS[parts.month - 1]} ${parts.year}`;
}

function monthName(month: string): string {
  const parts = monthParts(month);
  if (!parts) return month;
  return MONTHS[parts.month - 1];
}

/**
 * Which months a tier may open. `months` is chronological; the last entry is the latest.
 * Free opens the latest month only. Story share (Premium) opens every month in the list.
 */
export function openStoryMonths(months: readonly string[], share: boolean): string[] {
  const latest = months[months.length - 1];
  if (latest === undefined) return [];
  if (share) return [...months];
  return [latest];
}

/** True when `month` is in the list and this tier may open it. */
export function storyMonthOpen(month: string, months: readonly string[], share: boolean): boolean {
  return openStoryMonths(months, share).includes(month);
}

/** 1080×1350 share card. Two tiles a row. A trailing tile takes the whole row. */
export const SHARE_CARD_WIDTH = 1080;
export const SHARE_CARD_HEIGHT = 1350;
export const SHARE_CARD_PAD = 64;
export const SHARE_TITLE_SIZE = 56;
export const SHARE_FOOTER_SIZE = 28;
export const SHARE_LABEL_SIZE = 22;
export const SHARE_VALUE_SIZE = 40;
export const SHARE_TILE_PAD = 24;
export const SHARE_TILE_RADIUS = 28;
export const SHARE_TILE_GAP = 20;
export const SHARE_TILE_HEIGHT = 132;
export const SHARE_SECTION_GAP = 28;
export const SHARE_TILE_TEXT_GAP = 8;
export const SHARE_FOOTER = "Made with Lakshly · amounts hidden";

export interface ShareTileFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ShareCardLayout {
  width: number;
  height: number;
  padding: number;
  title: string;
  titleY: number;
  footer: string;
  footerY: number;
  fileName: string;
  tiles: Array<ShareTile & ShareTileFrame>;
}

/** `lakshly-story-yyyy-mm.png` from a `yyyy-MM` month id. */
export function storyShareFileName(month: string): string {
  return `lakshly-story-${month}.png`;
}

/** Card title. `label` is already "Month YYYY". */
export function storyShareTitle(label: string): string {
  return `Lakshly · ${label}`;
}

/** Places `count` tiles under the title and above the footer. */
export function shareTileFrames(count: number): ShareTileFrame[] {
  if (count <= 0) return [];
  const rows = Math.ceil(count / 2);
  const inner = SHARE_CARD_WIDTH - SHARE_CARD_PAD * 2;
  const column = (inner - SHARE_TILE_GAP) / 2;
  const tilesTop = SHARE_CARD_PAD + SHARE_TITLE_SIZE + SHARE_SECTION_GAP;
  const footerY = SHARE_CARD_HEIGHT - SHARE_CARD_PAD - SHARE_FOOTER_SIZE;
  const room = footerY - SHARE_SECTION_GAP - tilesTop;
  const natural = rows * SHARE_TILE_HEIGHT + (rows - 1) * SHARE_TILE_GAP;
  const fit = natural > room && natural > 0 ? room / natural : 1;
  const tileHeight = SHARE_TILE_HEIGHT * fit;
  const gap = SHARE_TILE_GAP * fit;
  const oddLast = count % 2 === 1;
  const frames: ShareTileFrame[] = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / 2);
    const side = index % 2;
    const full = oddLast && row === rows - 1;
    frames.push({
      x: SHARE_CARD_PAD + (full ? 0 : side * (column + SHARE_TILE_GAP)),
      y: tilesTop + row * (tileHeight + gap),
      width: full ? inner : column,
      height: tileHeight,
    });
  }
  return frames;
}

/** Title, footer, file name and tile boxes for one month. Values stay percentage strings. */
export function shareCardLayout(
  story: Pick<MonthlyStory, "month" | "label">,
  tiles: readonly ShareTile[],
): ShareCardLayout {
  const frames = shareTileFrames(tiles.length);
  const placed: Array<ShareTile & ShareTileFrame> = [];
  for (let index = 0; index < tiles.length; index += 1) {
    const tile = tiles[index];
    const frame = frames[index];
    if (!tile || !frame) continue;
    placed.push({
      label: tile.label,
      value: tile.value,
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
    });
  }
  return {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    padding: SHARE_CARD_PAD,
    title: storyShareTitle(story.label),
    titleY: SHARE_CARD_PAD,
    footer: SHARE_FOOTER,
    footerY: SHARE_CARD_HEIGHT - SHARE_CARD_PAD - SHARE_FOOTER_SIZE,
    fileName: storyShareFileName(story.month),
    tiles: placed,
  };
}
