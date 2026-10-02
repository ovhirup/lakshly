import type { Adapter, ParseResult, TextDoc } from "./types.ts";
import { cas } from "./adapters/cas.ts";
import { hdfcBank, iciciBank, sbiBank } from "./adapters/banks.ts";
import { hdfcCard, sbiCard } from "./adapters/cards.ts";
import { genericBank, genericCard } from "./adapters/generic.ts";

/** Specific adapters first; generic fallbacks last. Add a bank by appending an Adapter here. */
const adapters: Adapter[] = [cas, hdfcBank, sbiBank, iciciBank, hdfcCard, sbiCard];
const fallbacks: Adapter[] = [genericCard, genericBank];

/** Minimum score for a specific (bank-branded) adapter to win over the generic fallback. */
export const SPECIFIC_THRESHOLD = 0.6;

export function registerAdapter(a: Adapter): void {
  if (!adapters.some((x) => x.id === a.id)) adapters.push(a);
}

export function listAdapters(): Pick<Adapter, "id" | "label" | "kind" | "institution">[] {
  return [...adapters, ...fallbacks].map(({ id, label, kind, institution }) => ({ id, label, kind, institution }));
}

export function rankAdapters(doc: TextDoc): { adapter: Adapter; score: number }[] {
  return [...adapters, ...fallbacks].map((adapter) => ({ adapter, score: adapter.detect(doc) })).sort((a, b) => b.score - a.score);
}

/** Detect the layout and parse. `forceAdapter` lets the UI override detection. */
export function parseDocument(doc: TextDoc, forceAdapter?: string): ParseResult {
  const ranked = rankAdapters(doc);
  let pick = forceAdapter ? ranked.find((r) => r.adapter.id === forceAdapter) : undefined;
  if (!pick) {
    const best = ranked.find((r) => adapters.includes(r.adapter));
    pick = best && best.score >= SPECIFIC_THRESHOLD ? best : ranked.find((r) => fallbacks.includes(r.adapter))!;
  }
  const body = pick.adapter.parse(doc);
  return { adapter: pick.adapter.id, adapterLabel: pick.adapter.label, kind: pick.adapter.kind, confidence: Math.round(pick.score * 100) / 100, ...body };
}
