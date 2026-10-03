"use client";
import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { CATEGORIES, type Category, type ParseResult, type MergeReport } from "@lakshly/parsers";
import { Glass, PageHeader, PremiumBadge, Stat } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { useAppState } from "@/components/AppState";
import { useData } from "@/components/DataState";
import { formatDate, formatMoney, titleCase } from "@/lib/format";
import { parseFile } from "@/lib/import/client";
import "@/app/import/import.css";

type Phase =
  | { step: "idle" }
  | { step: "reading"; file: File }
  | { step: "password"; file: File; incorrect: boolean }
  | { step: "review"; file: File; result: ParseResult }
  | { step: "error"; file?: File; message: string };

const SUPPORTED = [
  "Mutual fund CAS (CAMS / KFintech)", "Depository CAS (CDSL / NSDL)", "HDFC Bank", "SBI", "ICICI Bank", "HDFC Bank credit card", "SBI Card", "Any other bank or card (generic)", "CSV exports",
];

export function Importer({ onImported, compact = false }: {
  onImported?: (report: MergeReport, result: ParseResult, importId: string) => void;
  compact?: boolean;
}) {
  const [retries, setRetries] = useState(0);
  const { source, setSource, user, saveImport, deleteAll, ready } = useData();
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [password, setPassword] = useState("");
  const [drag, setDrag] = useState(false);
  const [edits, setEdits] = useState<Record<string, Category>>({});
  const [skip, setSkip] = useState<Record<string, boolean>>({});
  const [showAll, setShowAll] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const run = useCallback(async (file: File, pw?: string) => {
    setPhase({ step: "reading", file });
    setEdits({}); setSkip({}); setShowAll(false);
    const out = await parseFile(file, pw);
    setPassword(""); // used once, never kept
    if (out.kind === "password") { if (out.incorrect) setRetries(n => n + 1); setPhase({ step: "password", file, incorrect: out.incorrect }); }
    else if (out.kind === "error") setPhase({ step: "error", file, message: out.message });
    else setPhase({ step: "review", file, result: out.result });
  }, []);

  useEffect(() => {
    if (!compact) return;
    const onDropFile = (event: Event) => {
      const file = (event as CustomEvent<File>).detail;
      if (file instanceof File) { setRetries(0); void run(file); }
    };
    window.addEventListener("lk-setup-import", onDropFile);
    return () => window.removeEventListener("lk-setup-import", onDropFile);
  }, [compact, run]);

  function onFiles(files: FileList | null) {
    const f = files?.[0];
    if (f) { setRetries(0); void run(f); }
  }

  async function confirm(result: ParseResult, fileName: string) {
    setSaving(true);
    const transactions = result.transactions
      .filter((t) => !skip[t.id])
      .map((t) => (edits[t.id] && edits[t.id] !== t.category ? { ...t, category: edits[t.id], categorisedBy: "user" as const } : t));
    const savedResult = { ...result, transactions };
    let report: MergeReport & { importId: string };
    try { report = await saveImport(savedResult, fileName); }
    catch { setSaving(false); setToast("Couldn't save to the encrypted vault. Please try again."); return; }
    setSaving(false);
    onImported?.(report, savedResult, report.importId);
    setSource("mine");
    setPhase({ step: "idle" });
    setToast(`Imported ${report.added} new transaction${report.added === 1 ? "" : "s"}${report.duplicates ? `, skipped ${report.duplicates} already imported` : ""}. Thank you for trusting Lakshly 💛`);
    setTimeout(() => setToast(null), 5000);
  }

  const counts = user ? { accounts: user.dataset.accounts.length, txns: user.dataset.transactions.length, files: user.imports.length } : null;

  return (
    <>
      {!compact && <PageHeader title="Import" subtitle="Bank, credit-card and mutual fund (CAS) statements, read on this device">
        <span className="badge">Included in Free</span>
      </PageHeader>}

      <Glass className="card device-banner">
        <span className="device-icon" aria-hidden="true"><Icon name="shield" size={22} /></span>
        <div>
          <h2>Stays on your device</h2>
          <p className="muted">Files are opened by a Web Worker in this tab. Nothing is uploaded and no network calls are made. Passwords are used once to unlock the PDF and are never stored. Your imported data is encrypted (AES-GCM) in this browser.</p>
        </div>
      </Glass>

      <div onDragOver={compact ? e => e.preventDefault() : undefined}
        onDrop={compact ? e => { if (!e.defaultPrevented) { e.preventDefault(); onFiles(e.dataTransfer.files); } } : undefined}
        className={`grid ${compact ? "import-compact" : "import-grid"} ${phase.step === "review" ? "reviewing" : ""}`}>
        <div className="import-main">
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
                <strong>{phase.step === "reading" ? `Reading ${phase.file.name} on-device…` : "Drop a statement PDF or CSV here"}</strong>
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
                <label className="field">Statement password
                  <input type="password" autoComplete="off" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={phase.incorrect} />
                </label>
                {phase.incorrect && <p className="down tiny" role="alert">That password didn&apos;t work. The email that carried the statement says which format to use. Please try again.</p>}
                {retries >= 3 && <p className="muted tiny">Check the source&apos;s password hint above, or try a different file.</p>}
                <div className="row-actions">
                  <button className="btn primary" type="submit" disabled={!password}>Unlock on this device</button>
                  <button className="btn ghost" type="button" onClick={() => { setPassword(""); setPhase({ step: "idle" }); }}>{retries >= 3 ? "Try a different file" : "Cancel"}</button>
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
        </div>

        {!compact && <aside className="import-side">
          <Glass className="card">
            <div className="card-head"><h2>Your data</h2></div>
            <div className="chips" role="group" aria-label="Data shown in the app">
              <button className={`chip ${source === "demo" ? "active" : ""}`} aria-pressed={source === "demo"} onClick={() => setSource("demo")}>Demo data</button>
              <button className={`chip ${source === "mine" ? "active" : ""}`} aria-pressed={source === "mine"} onClick={() => setSource("mine")}>My data</button>
            </div>
            <p className="muted tiny side-note">
              {!ready ? "Unlocking vault…" : counts ? `${counts.accounts} accounts · ${counts.txns} transactions · ${counts.files} imports, encrypted on this device.` : "No imported data yet."}
            </p>
            {counts && (
              confirmDelete ? (
                <div className="danger-zone" role="alertdialog" aria-label="Confirm delete">
                  <p className="tiny">Delete all imported data and the encryption key from this browser? This can&apos;t be undone.</p>
                  <div className="row-actions">
                    <button className="btn danger" onClick={() => { void deleteAll().then(() => { setConfirmDelete(false); setToast("All your data was deleted from this device."); setTimeout(() => setToast(null), 4000); }); }}>Delete everything</button>
                    <button className="btn ghost" onClick={() => setConfirmDelete(false)}>Keep</button>
                  </div>
                </div>
              ) : <button className="btn ghost danger-text" onClick={() => setConfirmDelete(true)}>Delete all my data</button>
            )}
          </Glass>

          <Glass className="card">
            <div className="card-head"><h2>Supported</h2></div>
            <ul className="supported">{SUPPORTED.map((s) => <li key={s}><Icon name="shield" size={13} /> {s}</li>)}</ul>
            <p className="muted tiny">Scanned (image-only) PDFs need OCR and aren&apos;t supported yet. <Link href="/feedback/">Request your bank</Link> and we&apos;ll add its layout.</p>
          </Glass>

          <Glass className="card">
            <div className="card-head"><h2>Auto-import</h2><PremiumBadge small /></div>
            <p className="muted tiny">Premium will add on-device Gmail/Outlook statement import and scheduled refresh. Statement and CAS import stay free.</p>
          </Glass>

          {user && user.imports.length > 0 && (
            <Glass className="card">
              <div className="card-head"><h2>Recent imports</h2></div>
              {user.imports.slice(-5).reverse().map((i) => (
                <div className="row" key={i.at}><div className="grow"><div className="title">{i.file}</div><div className="sub">{formatDate(i.at.slice(0, 10))} · {i.added} added{i.duplicates ? ` · ${i.duplicates} duplicates skipped` : ""}</div></div></div>
              ))}
            </Glass>
          )}
        </aside>}
      </div>
      {toast && <Glass className="toast" as="div"><span role="status">{toast}</span></Glass>}
    </>
  );
}

function Review({ result, fileName, edits, skip, showAll, saving, onEdit, onSkip, onShowAll, onCancel, onConfirm }: {
  result: ParseResult; fileName: string; edits: Record<string, Category>; skip: Record<string, boolean>; showAll: boolean; saving: boolean;
  onEdit: (id: string, c: Category) => void; onSkip: (id: string, v: boolean) => void; onShowAll: () => void; onCancel: () => void; onConfirm: () => void;
}) {
  const { privacy } = useAppState();
  const money = (amount: number, opts: { signed?: boolean } = {}) => formatMoney(amount, { ...opts, privacy });
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
          <Stat label="Total due" value={meta.totalDue !== undefined ? money(meta.totalDue) : "—"} />
          <Stat label="Minimum due" value={meta.minDue !== undefined ? money(meta.minDue) : "—"} />
          <Stat label="Due date" value={meta.dueDate ? formatDate(meta.dueDate) : "—"} />
          <Stat label="Card" value={acc?.mask ? `•• ${acc.mask}` : "—"} />
        </>) : result.kind === "cas" ? (<>
          <Stat label="Schemes" value={String(result.holdings.length)} />
          <Stat label="Market value" value={money(result.holdings.reduce((s, h) => s + h.marketValue, 0))} />
          <Stat label="Invested" value={money(result.holdings.reduce((s, h) => s + h.costValue, 0))} />
          <Stat label="SIPs found" value={String(result.sips.length)} />
        </>) : (<>
          <Stat label="Money in" value={money(inflow)} tone="up" />
          <Stat label="Money out" value={money(outflow)} tone="down" />
          <Stat label="Closing balance" value={acc ? money(acc.balance) : "—"} />
          <Stat label="Account" value={acc?.mask ? `•• ${acc.mask}` : "—"} />
        </>)}
      </div>

      {result.warnings.length > 0 && <ul className="warnings">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}

      {result.kind === "cas" && (
        <div className="table-wrap">
          <table className="review-table">
            <thead><tr><th>Scheme</th><th>Folio</th><th className="num">Units</th><th className="num">NAV</th><th className="num">Value</th></tr></thead>
            <tbody>{result.holdings.map((h) => (
              <tr key={h.accountId}><td>{h.scheme}<div className="muted tiny">{h.amc} · {h.registrar}</div></td><td>•• {h.folioMask}</td><td className="num">{privacy ? "••••" : h.units.toFixed(3)}</td><td className="num">{money(Math.round(h.nav * 100))}</td><td className="num">{money(h.marketValue)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div className="table-wrap">
        <table className="review-table">
          <thead><tr><th aria-label="Include" /><th className="col-date">Date</th><th>Description</th><th>Category</th><th className="num">Amount</th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className={skip[t.id] ? "skipped" : ""}>
                <td><input type="checkbox" checked={!skip[t.id]} onChange={(e) => onSkip(t.id, !e.target.checked)} aria-label={`Include transaction on ${formatDate(t.date)}`} /></td>
                <td className="nowrap col-date">{formatDate(t.date)}</td>
                <td><div className="desc">{privacy ? "Transaction" : (t.merchant ?? t.description)}</div><div className="muted tiny desc raw">{privacy ? "Hidden in privacy mode" : t.description}</div><div className="muted tiny m-date">{formatDate(t.date)}</div></td>
                <td>
                  <select value={edits[t.id] ?? t.category} onChange={(e) => onEdit(t.id, e.target.value as Category)} aria-label={`Category for transaction on ${formatDate(t.date)}`}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c === "emi" ? "EMI" : titleCase(c)}</option>)}
                  </select>
                </td>
                <td className={`num ${t.amount > 0 ? "up" : ""}`}>{money(t.amount, { signed: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!showAll && result.transactions.length > rows.length && <button className="btn ghost" onClick={onShowAll}>Show all {result.transactions.length} rows</button>}

      <div className="review-actions">
        <p className="muted tiny">Already-imported rows are skipped automatically, so re-importing a statement is safe.</p>
        <div className="row-actions">
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn primary" disabled={saving || (!included.length && !result.accounts.length)} onClick={onConfirm}>
            {saving ? "Encrypting…" : `Confirm import (${included.length})`}
          </button>
        </div>
      </div>
    </Glass>
  );
}
