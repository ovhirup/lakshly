"use client";
// Gmail statement results: per-row Import (review flow) plus selection and sequential bulk import.
import { useEffect, useMemo, useRef, useState } from "react";
import type { MergeReport, ParseResult } from "@lakshly/parsers";
import { useData } from "./DataState";
import { formatDate } from "@/lib/format";
import { parseFile } from "@/lib/import/client";
import { runBulkImport, senderKey, summaryText, type PasswordAnswer, type RowStatus } from "@/lib/gmail-bulk";
import type { FoundMessage } from "@/lib/gmail";

export const gmailRef = (id: string) => `gmail:${id}`;

/** Ids of Gmail messages already imported on this device (from the encrypted import log). */
export function importedGmailIds(imports: readonly { ref?: string }[] | undefined): Set<string> {
  return new Set((imports ?? []).flatMap((i) => (i.ref?.startsWith("gmail:") ? [i.ref.slice(6)] : [])));
}

function statusLabel(st: RowStatus): string {
  switch (st.s) {
    case "queued": return "Queued";
    case "importing": return "Importing…";
    case "needs-password": return st.incorrect ? "Wrong password" : "Needs password";
    case "imported": return `Imported · ${st.added} new`;
    case "skipped": return `Skipped · ${st.reason}`;
    case "failed": return `Failed · ${st.reason}`;
    default: return "";
  }
}

export function GmailResults({ found, disabled, nameOf, passwordHintsFor, fetchFile, onImportOne, onImported }: {
  found: FoundMessage[];
  disabled?: boolean;
  nameOf: (sourceId: string) => string;
  passwordHintsFor: (sourceId: string) => string[] | undefined;
  fetchFile: (m: FoundMessage) => Promise<File | null>;
  /** Per-row Import: opens the normal review flow for one statement. */
  onImportOne: (m: FoundMessage) => void;
  onImported?: (sourceId: string, r: ParseResult, report: MergeReport) => void;
}) {
  const { user, saveImport, setSource } = useData();
  const doneIds = useMemo(() => importedGmailIds(user?.imports), [user]);
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const isDone = (m: FoundMessage) => status[m.id]?.s === "imported" || [m.id, ...(m.dupIds ?? [])].some((id) => doneIds.has(id));
  const [selected, setSelected] = useState<Set<string>>(() => new Set(found.filter((m) => !isDone(m)).map((m) => m.id)));
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [ask, setAsk] = useState<{ id: string; incorrect: boolean } | null>(null);
  const [pw, setPw] = useState("");
  const [remember, setRemember] = useState(false);
  const resolver = useRef<((a: PasswordAnswer | null) => void) | null>(null);
  const stop = useRef(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Rows imported elsewhere (per-row Import) drop out of the selection because only not-imported rows are selectable.
  const selectable = found.filter((m) => !isDone(m));
  const chosen = selectable.filter((m) => selected.has(m.id));
  const allOn = selectable.length > 0 && chosen.length === selectable.length;
  useEffect(() => { if (selectAllRef.current) selectAllRef.current.indeterminate = chosen.length > 0 && !allOn; }, [chosen.length, allOn]);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function bulk(rows: FoundMessage[]) {
    if (!rows.length || running) return;
    setRunning(true); setSummary(null); stop.current = false;
    const sum = await runBulkImport<ParseResult>(rows, {
      fetchFile,
      parse: (file, password) => parseFile(file, password),
      save: async (r, file, m) => {
        const report = await saveImport(r, file.name, m.sourceId, gmailRef(m.id));
        setSource("mine");
        onImported?.(m.sourceId, r, report);
        return report;
      },
      askPassword: (m, incorrect) => new Promise<PasswordAnswer | null>((resolve) => {
        resolver.current = resolve; setPw(""); setAsk({ id: m.id, incorrect });
      }),
      onStatus: (id, st) => {
        setStatus((s) => ({ ...s, [id]: st }));
        if (st.s === "imported") setSelected((s) => { const n = new Set(s); n.delete(id); return n; });
      },
      cancelled: () => stop.current,
    });
    setRunning(false); setAsk(null);
    setSummary(summaryText(sum));
  }

  function answer(a: PasswordAnswer | null) {
    const r = resolver.current; resolver.current = null;
    setAsk(null); setPw(""); // the password leaves component state immediately
    r?.(a);
  }

  const askRow = ask ? found.find((m) => m.id === ask.id) : undefined;
  const sameSender = askRow ? found.filter((m) => senderKey(m) === senderKey(askRow) && m.id !== askRow.id && status[m.id]?.s === "queued").length : 0;

  return (
    <div className="gm-results" data-testid="gmail-results">
      <div className="gm-toolbar">
        <label className="gm-check gm-selectall">
          <input ref={selectAllRef} type="checkbox" checked={allOn} disabled={running || !selectable.length}
            onChange={() => setSelected(allOn ? new Set() : new Set(selectable.map((m) => m.id)))} aria-label="Select all statements not yet imported" />
          <span>Select all</span>
        </label>
        <span className="tiny muted gm-count" aria-live="polite">{chosen.length} of {selectable.length} selected</span>
        <div className="gm-bulk">
          <button className="btn primary small" disabled={disabled || running || !chosen.length} onClick={() => void bulk(chosen)} data-testid="gmail-import-selected">Import selected ({chosen.length})</button>
          <button className="btn ghost small" disabled={disabled || running || !selectable.length} onClick={() => void bulk(selectable)} data-testid="gmail-import-all">Import all ({selectable.length})</button>
          {running && <button className="btn ghost small" onClick={() => { stop.current = true; }}>Stop after this one</button>}
        </div>
      </div>
      <ul className="found-list gm-list" aria-label="Statement emails found">
        {found.map((m) => {
          const done = isDone(m);
          const st: RowStatus = status[m.id] ?? (done ? { s: "imported", added: 0, duplicates: 0 } : { s: "ready" });
          const att = m.attachments?.[0];
          const subjectId = `gm-subj-${m.id}`;
          return (
            <li key={m.id} className={`gm-row st-${st.s}`} data-testid="gmail-row">
              <input type="checkbox" className="gm-row-check" checked={!done && selected.has(m.id)} disabled={running || done}
                onChange={() => toggle(m.id)} aria-labelledby={subjectId} />
              <span className="grow">
                <strong id={subjectId}>{m.subject || "(no subject)"}</strong>
                <small className="muted">
                  {formatDate(m.date)} · {nameOf(m.sourceId)} · {m.from}
                  {att && <> · <span className="gm-file">{att.name}</span></>}
                  {(m.copies ?? 1) > 1 && <span className="gm-copies" title="Identical statement emails; the newest is kept"> · {m.copies} copies</span>}
                </small>
                {(st.s !== "ready") && (
                  <span className={`badge small gm-status st-${st.s}`} role={st.s === "failed" ? "alert" : undefined}>
                    {st.s === "imported" && !status[m.id] ? "Imported" : statusLabel(st)}
                  </span>
                )}
                {ask?.id === m.id && (
                  <form className="gm-pw" onSubmit={(e) => { e.preventDefault(); if (pw) answer({ password: pw, remember }); }} aria-label={`Password for ${m.subject}`}>
                    <label className="field">Statement password
                      <input type="password" autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} autoFocus value={pw}
                        onChange={(e) => setPw(e.target.value)} aria-invalid={ask.incorrect} data-testid="gm-pw-input" />
                    </label>
                    {(passwordHintsFor(m.sourceId) ?? []).length > 0 && <>
                      <p className="pw-hints-label" id={`pwh-${m.id}`}>Usually one of these:</p>
                      <ul className="pw-hints" aria-labelledby={`pwh-${m.id}`}>{passwordHintsFor(m.sourceId)!.map((h) => <li key={h}>{h}</li>)}</ul>
                    </>}
                    {ask.incorrect && <p className="down tiny" role="alert">That password didn&apos;t work. Passwords are case-sensitive; check Caps Lock and try again.</p>}
                    <label className="gm-check tiny">
                      <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                      <span>Use the same password for the rest from {m.from}{sameSender ? ` (${sameSender} more)` : ""}. Kept in memory for this import only, never stored.</span>
                    </label>
                    <div className="row-actions">
                      <button className="btn primary small" type="submit" disabled={!pw}>Unlock on this device</button>
                      <button className="btn ghost small" type="button" onClick={() => answer(null)}>Skip this one</button>
                    </div>
                  </form>
                )}
              </span>
              <button className="btn ghost small gm-one" disabled={disabled || running} onClick={() => onImportOne(m)}
                aria-label={`${done ? "Import again" : "Import"}: ${m.subject}`}>{done ? "Import again" : "Import"}</button>
            </li>
          );
        })}
      </ul>
      {summary && <p className="tiny gm-summary" role="status" data-testid="gmail-summary">{summary}</p>}
    </div>
  );
}
