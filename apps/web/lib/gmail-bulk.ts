// Bulk import of Gmail statement attachments: sequential, through the normal on-device parse + save pipeline.
// Passwords are used for one parse; "use the same password for the rest from this sender" lives in a Map that
// exists only for the duration of one run (memory only, never stored, gone when the run ends).
import type { FoundMessage } from "./gmail";

export type ParseOutcome<R> = { kind: "result"; result: R } | { kind: "password"; incorrect: boolean } | { kind: "error"; message: string };

export type RowStatus =
  | { s: "ready" }
  | { s: "queued" }
  | { s: "importing" }
  | { s: "needs-password"; incorrect: boolean }
  | { s: "imported"; added: number; duplicates: number }
  | { s: "skipped"; reason: string }
  | { s: "failed"; reason: string };

export interface PasswordAnswer { password: string; remember: boolean }

export interface BulkDeps<R> {
  fetchFile: (m: FoundMessage) => Promise<File | null>;
  parse: (file: File, password?: string) => Promise<ParseOutcome<R>>;
  save: (result: R, file: File, m: FoundMessage) => Promise<{ added: number; duplicates: number }>;
  /** Resolves with a password, or null to skip this statement. */
  askPassword: (m: FoundMessage, incorrect: boolean) => Promise<PasswordAnswer | null>;
  onStatus: (id: string, status: RowStatus) => void;
  /** Return true to stop before the next row. */
  cancelled?: () => boolean;
}

export interface BulkSummary { imported: number; failed: number; skipped: number; added: number; duplicates: number }

/** Key for "same password for the rest from this sender": the sender address. */
export const senderKey = (m: FoundMessage) => m.from.toLowerCase();

export function summaryText(s: BulkSummary): string {
  const parts = [`Imported ${s.imported} statement${s.imported === 1 ? "" : "s"} (${s.added} new transaction${s.added === 1 ? "" : "s"}${s.duplicates ? `, ${s.duplicates} already there` : ""})`];
  if (s.skipped) parts.push(`${s.skipped} skipped`);
  if (s.failed) parts.push(`${s.failed} failed`);
  return parts.join(" · ");
}

export async function runBulkImport<R>(rows: readonly FoundMessage[], deps: BulkDeps<R>): Promise<BulkSummary> {
  const sum: BulkSummary = { imported: 0, failed: 0, skipped: 0, added: 0, duplicates: 0 };
  const remembered = new Map<string, string>(); // this run only
  rows.forEach((m) => deps.onStatus(m.id, { s: "queued" }));
  try {
    for (const m of rows) {
      if (deps.cancelled?.()) { deps.onStatus(m.id, { s: "skipped", reason: "Stopped" }); sum.skipped++; continue; }
      deps.onStatus(m.id, { s: "importing" });
      try {
        const file = await deps.fetchFile(m);
        if (!file) { deps.onStatus(m.id, { s: "failed", reason: "No PDF or CSV statement attached" }); sum.failed++; continue; }
        const key = senderKey(m);
        const saved = remembered.get(key);
        let out = await deps.parse(file, saved);
        let skipped = false;
        while (out.kind === "password") {
          const incorrect = out.incorrect;
          deps.onStatus(m.id, { s: "needs-password", incorrect });
          const ans = await deps.askPassword(m, incorrect);
          if (!ans) { skipped = true; break; }
          deps.onStatus(m.id, { s: "importing" });
          out = await deps.parse(file, ans.password);
          if (out.kind !== "password" && ans.remember) remembered.set(key, ans.password);
        }
        if (skipped) { deps.onStatus(m.id, { s: "skipped", reason: "No password entered" }); sum.skipped++; continue; }
        if (out.kind === "error") { deps.onStatus(m.id, { s: "failed", reason: out.message }); sum.failed++; continue; }
        if (out.kind !== "result") continue;
        const r = await deps.save(out.result, file, m);
        deps.onStatus(m.id, { s: "imported", added: r.added, duplicates: r.duplicates });
        sum.imported++; sum.added += r.added; sum.duplicates += r.duplicates;
      } catch (e) {
        deps.onStatus(m.id, { s: "failed", reason: (e as Error).message || "Couldn't import this statement" }); sum.failed++;
      }
    }
  } finally {
    remembered.clear();
  }
  return sum;
}
