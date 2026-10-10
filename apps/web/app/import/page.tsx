"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Glass, PageHeader, } from "@/components/ui";
import { Importer, importToast } from "@/components/Importer";
import { Icon } from "@/components/Icon";
import { MergeOffers } from "@/components/MergeOffers";
import { useData } from "@/components/DataState";
import { useSetup } from "@/components/SetupState";
import { formatDate } from "@/lib/format";
import { sampleBankFile } from "@/lib/import/sample-statement";

function subscribeSampleQuery() {
  return () => {};
}

function readSampleQuery() {
  return new URLSearchParams(window.location.search).get("sample") === "1";
}

const SUPPORTED = [
  "Mutual fund CAS (CAMS / KFintech)", "HDFC Bank", "SBI", "ICICI Bank", "HDFC Bank credit card", "SBI Card", "Any other bank or card (generic)", "CSV exports",
];

export default function ImportPage() {
  const { source, setSource, user, deleteAll, ready } = useData();
  const [step, setStep] = useState("idle");
  const [toast, setToast] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [picked, setPicked] = useState<File | null>(null);
  const [justImported, setJustImported] = useState(false);
  const openSample = useSyncExternalStore(subscribeSampleQuery, readSampleQuery, () => false);
  const fromQuery = useMemo(() => (openSample ? sampleBankFile() : null), [openSample]);
  const sample = picked ?? fromQuery;

  const setup = useSetup();
  // Setup details (email, picked banks) live in the encrypted vault even before the first import.
  const hasSetupData = setup.ready && (setup.state.mode === "mine" || setup.state.emails.length > 0 || setup.state.picked.length > 0 || setup.state.custom.length > 0 || !!setup.state.goal);
  const counts = user ? { accounts: user.dataset.accounts.length, txns: user.dataset.transactions.length, files: user.imports.length } : null;

  return (
    <>
      <PageHeader title="Import" subtitle="Bank, credit-card and mutual fund (CAS) statements, read on this device">
        <span className="badge">Included in Free</span>
      </PageHeader>

      <Glass className="card device-banner">
        <span className="device-icon" aria-hidden="true"><Icon name="shield" size={22} /></span>
        <div>
          <h2>Stays on your device</h2>
          <p className="muted">Files are opened by a Web Worker in this tab. Nothing is uploaded and no network calls are made. Passwords are used once to unlock the PDF and are never stored. Your imported data is encrypted (AES-GCM) in this browser.</p>
        </div>
      </Glass>

      <div className={`grid import-grid ${step === "review" ? "reviewing" : ""}`}>
        <div className="import-main">
          {step !== "review" && (
            <Glass className="card">
              <div className="card-head"><h2>Practise first</h2><span className="badge">Fake numbers</span></div>
              <p className="muted">A salary, Swiggy and a grocery shop. You see the same review screen a real statement uses. These rows stay on this device.</p>
              <button className="btn ghost" type="button" data-testid="try-sample" onClick={() => { setJustImported(false); setPicked(sampleBankFile()); }}>Try a sample statement</button>
            </Glass>
          )}
          <Importer
            incoming={sample}
            onPhase={(next) => { setStep(next); if (next === "reading" || next === "review") setJustImported(false); }}
            onImported={(_r, report) => { setJustImported(true); setToast(importToast(report)); setTimeout(() => setToast(null), 5000); }}
          />
          {step === "idle" && <MergeOffers onMerged={(t) => { setToast(t); setTimeout(() => setToast(null), 5000); }} />}
          {justImported && step === "idle" && (
            <Glass className="card">
              <h2>Saved on this device</h2>
              <p className="muted">Open Overview to see the numbers. If one looks wrong, send a note. Nothing was uploaded.</p>
              <div className="row-actions">
                <Link className="btn primary" href="/">See Overview</Link>
                <Link className="btn ghost" href="/feedback/">Something looks wrong</Link>
              </div>
            </Glass>
          )}
        </div>

        <aside className="import-side">
          <Glass className="card">
            <div className="card-head"><h2 id="your-data">Your data</h2></div>
            <div className="chips" role="group" aria-label="Data shown in the app">
              <button className={`chip ${source === "demo" ? "active" : ""}`} aria-pressed={source === "demo"} onClick={() => setSource("demo")}>Demo data</button>
              <button className={`chip ${source === "mine" ? "active" : ""}`} aria-pressed={source === "mine"} onClick={() => setSource("mine")}>My data</button>
            </div>
            <p className="muted tiny side-note">
              {!ready ? "Unlocking vault…" : counts ? `${counts.accounts} accounts · ${counts.txns} transactions · ${counts.files} imports, encrypted on this device.` : hasSetupData ? "No imported data yet. Your setup details are encrypted on this device." : "No imported data yet."}
            </p>
            {(counts || hasSetupData) && (
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
            <div className="card-head"><h2>Find statements in your email</h2><span className="badge">Free</span></div>
            <p className="muted tiny">Guided setup builds ready-made Gmail and Outlook searches for each bank and card you use, so you can download statements in a couple of clicks. Automatic read-only sync of one mailbox will be free too when it ships (Apple first).</p>
            <Link className="btn ghost" href="/setup/?step=import">Open guided setup</Link>
          </Glass>

          {user && user.imports.length > 0 && (
            <Glass className="card">
              <div className="card-head"><h2>Recent imports</h2></div>
              {user.imports.slice(-5).reverse().map((i) => (
                <div className="row" key={i.at}><div className="grow"><div className="title">{i.file}</div><div className="sub">{formatDate(i.at.slice(0, 10))} · {i.added} added{i.duplicates ? ` · ${i.duplicates} duplicates skipped` : ""}</div></div></div>
              ))}
            </Glass>
          )}
        </aside>
      </div>
      {toast && <Glass className="toast" as="div"><span role="status">{toast}</span></Glass>}
    </>
  );
}

