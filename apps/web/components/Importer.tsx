"use client";
// The statement importer (drop → unlock → review → confirm), shared by /import and the setup wizard.
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, type Category, type MergeReport, type ParseResult } from "@lakshly/parsers";
import { Glass, Stat } from "./ui";
import { Icon } from "./Icon";
import { useData } from "./DataState";
import { formatDate, formatINR, titleCase } from "@/lib/format";
import { parseFile } from "@/lib/import/client";
import { confirmImportLabel, importCounts } from "@/lib/import/review";
import { MASK, moneyMasked } from "@/lib/privacy";
import "@/app/import/import.css";

type Phase =
  | { step: "idle" }
  | { step: "reading"; file: File }
  | { step: "password"; file: File; incorrect: boolean }
  | { step: "review"; file: File; result: ParseResult }
  | { step: "error"; file?: File; message: string };

export function importToast(report: MergeReport): string {
  return `Imported ${report.added} new transaction${report.added === 1 ? "" : "s"}${report.duplicates ? `, skipped ${report.duplicates} already imported` : ""}. Thank you for trusting Lakshly 💛`;
}

export function Importer({ onImported, onPhase, sourceId, prompt = "Drop a statement PDF or CSV here", passwordHints }: {
  onImported?: (r: ParseResult, report: MergeReport, fileName: string) => void;
  onPhase?: (step: Phase["step"]) => void;
  /** Setup source this import belongs to (recorded in the import log). */
  sourceId?: string;
  prompt?: string;
  /** Format hints for this source's password (never values). */
  passwordHints?: string[];
}) {
  const { setSource, saveImport } = useData();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [password, setPassword] = useState("");
  const [drag, setDrag] = useState(false);
  const [edits, setEdits] = useState<Record<string, Category>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { onPhase?.(phase.step); }, [phase.step, onPhase]);

  async function run(file: File, pw?: string) {
    setPhase({ step: "reading", file });
    setEdits({}); setSkip({}); setShowAll(false);
    const out = await parseFile(file, pw);
    setPassword(""); // used once, never kept
    if (out.kind === "password") setPhase({ step: "password", file, incorrect: out.incorrect });
    else if (out.kind === "error") setPhase({ step: "error", file, message: out.message });
    else setPhase({ step: "review", file, result: out.result });
  }

  function onFiles(files: FileList | null) {
    const f = files?.[0];
    if (f) void run(f);
  }

  async function confirm(result: ParseResult, fileName: string) {
    setSaving(true);
    const transactions = result.transactions
      .filter((t) => !skip[t.id])
      .map((t) => (edits[t.id] && edits[t.id] !== t.category ? { ...t, category: edits[t.id], categorisedBy: "user" as const } : t));
    const final = { ...result, transactions };
    const report = await saveImport(final, fileName, sourceId);
    setSaving(false);
    setSource("mine");
    setPhase({ step: "idle" });
    onImported?.(final, report, fileName);
  }

  return (
    <>
          {phase.step !== "review" && (
            <Glass className={`card dropzone ${drag ? "drag" : ""}`}>
              <div
                className="drop-target"
                role="button"
                tabIndex={0}
                aria-label="Choose a statement file to import"
                onClick={() => input.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); onFiles(e.dataTransfer.files); }}
              >
                <span className="drop-icon" aria-hidden="true"><Icon name="import" size={30} /></span>
                <strong>{phase.step === "reading" ? `Reading ${phase.file.name} on-device…` : prompt}</strong>
                <span className="muted tiny">{phase.step === "reading" ? "Extracting text and detecting the layout" : "or click to browse · PDF (password-protected is fine), CSV"}</span>
                {phase.step === "reading" && <span className="spinner" aria-hidden="true" />}
              </div>
              <input ref={input} type="file" accept=".pdf,.csv,.tsv,application/pdf,text/csv" hidden data-testid="file-input"
                onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
            </Glass>
          )}

          {phase.step === "password" && (
            <Glass className="card password-card">
              <form onSubmit={(e) => { e.preventDefault(); if (password) void run(phase.file, password); }}>
                <div className="card-head"><h2><Icon name="lock" size={18} /> {phase.file.name} is password-protected</h2></div>
                <p className="muted">Banks usually lock statements with something like your customer ID or date of birth; a CAS is usually locked with your PAN. Lakshly uses it once to open the file here and never stores it.</p>
                {passwordHints && passwordHints.length > 0 && <ul className="pw-hints tiny muted">{passwordHints.map((h) => <li key={h}>{h}</li>)}</ul>}
                <label className="field">Statement password
                  <input type="password" autoComplete="off" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={phase.incorrect} />
                </label>
                {phase.incorrect && <p className="down tiny" role="alert">That password didn&apos;t work. Please try again.</p>}
                <div className="row-actions">
                  <button className="btn primary" type="submit" disabled={!password}>Unlock on this device</button>
                  <button className="btn ghost" type="button" onClick={() => { setPassword(""); setPhase({ step: "idle" }); }}>Cancel</button>
                </div>
              </form>
            </Glass>
          )}

          {phase.step === "error" && (
            <Glass className="card"><p className="down" role="alert">{phase.message}</p><button className="btn ghost" onClick={() => setPhase({ step: "idle" })}>Try another file</button></Glass>
          )}

          {phase.step === "review" && (
            <Review
              result={phase.result}
              fileName={phase.file.name}
              edits={edits}
              skip={skip}
              showAll={showAll}
              saving={saving}
              onEdit={(id, c) => setEdits({ ...edits, [id]: c })}
              onSkip={(id, v) => setSkip({ ...skip, [id]: v })}
              onShowAll={() => setShowAll(true)}
              onCancel={() => setPhase({ step: "idle" })}
              onConfirm={() => void confirm(phase.result, phase.file.name)}
            />
          )}
    </>
  );
}

function Review({ result, fileName, edits, skip, showAll, saving, onEdit, onSkip, onShowAll, onCancel, onConfirm }: {
  result: ParseResult; fileName: string; edits: Record<string, Category>; skip: Record<string, boolean>; showAll: boolean; saving: boolean;
  onEdit: (id: string, c: Category) => void; onSkip: (id: string, v: boolean) => void; onShowAll: () => void; onCancel: () => void; onConfirm: () => void;
}) {
  const meta = result.meta[0];
  const included = result.transactions.filter((t) => !skip[t.id]);
  const rows = showAll ? result.transactions : result.transactions.slice(0, 25);
  const acc = result.accounts[0];
  const inflow = included.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const outflow = included.filter((t) => t.amount < 0).reduce((s, t) => s - t.amount, 0);
  return (
    <Glass className="card review">
      <div className="card-head">
        <div>
          <h2>Review {fileName}</h2>
          <p className="muted tiny">Detected: <strong>{result.adapterLabel}</strong> · {Math.round(result.confidence * 100)}% match · {result.accounts.length} account{result.accounts.length === 1 ? "" : "s"}</p>
        </div>
        <span className="badge on-device"><Icon name="shield" size={12} /> Parsed on-device</span>
      </div>

      <div className="grid g4 review-stats">
        {result.kind === "card" && meta ? (<>
          <Stat label="Total due" value={meta.totalDue !== undefined ? formatINR(meta.totalDue) : "—"} />
          <Stat label="Minimum due" value={meta.minDue !== undefined ? formatINR(meta.minDue) : "—"} />
          <Stat label="Due date" value={meta.dueDate ? formatDate(meta.dueDate) : "—"} />
          <Stat label="Card" value={acc?.mask ? `•• ${acc.mask}` : "—"} />
        </>) : result.kind === "cas" ? (<>
          <Stat label="Schemes" value={String(result.holdings.length)} />
          <Stat label="Market value" value={formatINR(result.holdings.reduce((s, h) => s + h.marketValue, 0))} />
          <Stat label="Invested" value={formatINR(result.holdings.reduce((s, h) => s + h.costValue, 0))} />
          <Stat label="SIPs found" value={String(result.sips.length)} />
        </>) : (<>
          <Stat label="Money in" value={formatINR(inflow)} tone="up" />
          <Stat label="Money out" value={formatINR(outflow)} tone="down" />
          <Stat label="Closing balance" value={acc ? formatINR(acc.balance) : "—"} />
          <Stat label="Account" value={acc?.mask ? `•• ${acc.mask}` : "—"} />
        </>)}
      </div>

      {result.warnings.length > 0 && <ul className="warnings">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

      {result.kind === "cas" && (
        <div className="table-wrap">
          <table className="review-table">
            <thead><tr><th>Scheme</th><th>Folio</th><th className="num">Units</th><th className="num">NAV</th><th className="num">Value</th></tr></thead>
            <tbody>{result.holdings.map((h) => (
              <tr key={h.accountId}><td>{h.scheme}<div className="muted tiny">{h.amc} · {h.registrar}</div></td><td>•• {h.folioMask}</td><td className="num">{h.units.toFixed(3)}</td><td className="num">{moneyMasked() ? MASK : `₹${h.nav.toFixed(2)}`}</td><td className="num">{formatINR(h.marketValue)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {result.transactions.length > 0 && <div className="table-wrap">
        <table className="review-table">
          <thead><tr><th aria-label="Include" /><th className="col-date">Date</th><th>Description</th><th>Category</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className={skip[t.id] ? "skipped" : ""}>
                <td><input type="checkbox" checked={!skip[t.id]} onChange={(e) => onSkip(t.id, !e.target.checked)} aria-label={`Include ${t.description}`} /></td>
                <td className="nowrap col-date">{formatDate(t.date)}</td>
                <td><div className="desc">{t.merchant ?? t.description}</div><div className="muted tiny desc raw">{t.description}</div><div className="muted tiny m-date">{formatDate(t.date)}</div></td>
                <td>
                  <select value={edits[t.id] ?? t.category} onChange={(e) => onEdit(t.id, e.target.value as Category)} aria-label={`Category for ${t.description}`}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c === "emi" ? "EMI" : titleCase(c)}</option>)}
                  </select>
                </td>
                <td className={`num ${t.amount > 0 ? "up" : ""}`}>{formatINR(t.amount, { signed: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
      {!showAll && result.transactions.length > rows.length && <button className="btn ghost" onClick={onShowAll}>Show all {result.transactions.length} rows</button>}

      <div className="review-actions">
        <p className="muted tiny">Already-imported rows are skipped automatically, so re-importing a statement is safe.</p>
        <div className="row-actions">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={saving || (!included.length && !result.accounts.length)} onClick={onConfirm}>
            {saving ? "Encrypting…" : confirmImportLabel(importCounts(result, skip))}
          </button>
        </div>
      </div>
    </Glass>
  );
}
