"use client";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { catalog, checklist, detectMailProvider, freshness, freshnessNextDate, sourceFor, stepOrder, attribute,
  type MailProvider, type SetupAction, type SetupSource, type SetupState, type SetupStep } from "@lakshly/shared";
import { useData } from "./DataState";
import { useAppState } from "./AppState";
import { Glass, PageHeader } from "./ui";
import { Importer } from "./Importer";
import { SetupSearch, SourceGuide } from "./SetupSearch";
import { SetupConsent } from "./SetupConsent";
import { SetupRing } from "./SetupProgress";
import { SetupPlan } from "./SetupPlan";
import { themes } from "@/lib/themes";
import { can, limit } from "@/lib/entitlements";
import { localToday } from "@/lib/setup-storage";
import { attributionAction } from "@/lib/setup-import";
import { formatDate } from "@/lib/format";
import "@/app/setup/setup.css";

export const STEP_TITLES: Record<SetupStep, string> = { welcome: "Get Lakshly up and running", email: "Connect your money email", accounts: "Pick your accounts", import: "Sync and import", plan: "First budget + Laksh goal", done: "Up and running" };
const LABELS: Record<string, string> = { profile: "Say hello", myData: "Use your own data", email: "Connect your money email", sources: "Pick your accounts", firstImport: "Import a bank or card statement", investments: "Add your investments (CAS)", allSources: "Every account handled", budget: "Set a first budget", goal: "Create a Laksh goal" };
const CHECK_STEPS: Record<string, SetupStep> = { profile: "welcome", myData: "welcome", email: "email", sources: "accounts", firstImport: "import", investments: "import", allSources: "import", budget: "plan", goal: "plan" };
const STATUS: Record<SetupSource["status"], string> = { todo: "○ To do", searching: "⌕ Looking in mail…", waiting: "⚿ Needs a password", imported: "✓ Imported", skipped: "− Skipped", error: "⚠ Needs a look" };
const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PROVIDERS: { id: MailProvider; name: string }[] = [{ id: "google", name: "Google" }, { id: "microsoft", name: "Microsoft" }, { id: "icloud", name: "iCloud" }, { id: "yahoo", name: "Yahoo" }, { id: "zoho", name: "Zoho" }, { id: "other", name: "Other" }];
const currencies = ["INR", ...Intl.supportedValuesOf("currency").filter(c => c !== "INR")];


export function SetupWizard({ state }: { state: SetupState }) {
  const d = useData();
  const app = useAppState();
  const router = useRouter();
  const today = d.ephemeral ? "2026-10-03" : localToday();
  const own = { ...(d.user?.dataset ?? { transactions: [], accounts: [], budgets: [] }), goals: d.goals };
  const progress = checklist(state, own, "web", today);
  const [health] = useState(progress.percent === 100);
  const [step, setStep] = useState<SetupStep>(() => {
    const q = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("step");
    return stepOrder.includes(q as SetupStep) ? q as SetupStep : health ? "done" : state.currentStep;
  });
  const [announcement, setAnnouncement] = useState("");
  const [toast, setToast] = useState("");
  const [consent, setConsent] = useState(false);
  const [beta, setBeta] = useState(false);
  const [profileName, setProfileName] = useState(state.profile.name);
  const [profileCurrency, setProfileCurrency] = useState(state.profile.currency);
  const [email, setEmail] = useState(state.email.primary);
  const [provider, setProvider] = useState<MailProvider>(state.email.pickerProvider ?? detectMailProvider(state.email.primary));
  const [extra, setExtra] = useState("");
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const seenCompletion = useRef(state.completedAt);
  const focus = useRef<HTMLDivElement>(null);
  const closeConsent = useCallback(() => setConsent(false), []);
  const index = stepOrder.indexOf(step);
  const currency = (d.user?.dataset.accounts ?? []).every(a => a.currency === state.profile.currency) ? state.profile.currency : "INR";
  const validEmail = !email.trim() || VALID_EMAIL.test(email.trim());
  const notify = useCallback((message: string) => { setAnnouncement(message); setToast(message); }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!state.completedAt || seenCompletion.current === state.completedAt) return;
    seenCompletion.current = state.completedAt;
    const timer = setTimeout(() => {
      notify(`Lakshly is up and running, ${state.profile.name.trim() || "there"} 🪷`);
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) setCelebrate(true);
    }, 0);
    const end = setTimeout(() => setCelebrate(false), 3000);
    return () => { clearTimeout(timer); clearTimeout(end); };
  }, [state.completedAt, state.profile.name, notify]);
  const dispatchSetup = d.dispatchSetup;
  useEffect(() => {
    focus.current?.focus();
    void dispatchSetup({ type: "goTo", step }).catch(() => notify("Couldn't save the current setup step."));
  }, [step, dispatchSetup, notify]);

  async function act(action: SetupAction): Promise<boolean> {
    try { await d.dispatchSetup({ ...action, currentStep: action.type === "goTo" ? undefined : step }); return true; }
    catch { notify("Couldn't save to the encrypted vault. Please try again."); return false; }
  }
  async function navigate(next: SetupStep, done = false) {
    if (!await act({ type: "goTo", step: next, done, from: step })) return;
    setStep(next);
    const url = new URL(window.location.href); url.searchParams.set("step", next);
    window.history.replaceState(null, "", url.pathname + url.search);
    setAnnouncement(`Step ${stepOrder.indexOf(next) + 1} of 6, ${STEP_TITLES[next]}`);
  }
  async function finishLater() { if (await act({ type: "finishLater" })) router.push("/"); }
  async function saveEmail() {
    if (email.trim() && !VALID_EMAIL.test(email.trim())) { notify("Enter a complete email address, or skip this step."); return false; }
    return act({ type: "setEmail", email, pickerProvider: provider, provider: provider === "google" ? "gmail" : provider === "microsoft" ? "outlook" : "other" });
  }
  async function next() {
    if (busy || consent) return;
    setBusy(true);
    try {
      if (step === "welcome") { if (!await act({ type: "chooseMode", mode: "mine" })) return; }
      if (step === "email" && !await saveEmail()) return;
      if (step === "done") { router.push("/"); return; }
      await navigate(stepOrder[index + 1], true);
    } finally { setBusy(false); }
  }
  async function skip() {
    if (step === "email") await act({ type: "skipEmail" });
    if (await act({ type: "skipStep", step })) {
      if (step === "done") router.push("/");
      else await navigate(stepOrder[index + 1]);
    }
  }
  const pickedInvestments = state.sources.filter(p => sourceFor(p).kinds.includes("investment"));
  const pendingImport = d.user?.imports.find(entry => !state.sources.some(s => s.importIds?.includes(entry.id)));
  const attribution = pendingImport ? attribute(pendingImport.adapter, state.sources) : null;
  const candidates = attribution?.ask.length ? attribution.ask : state.sources.map(s => s.catalogId);
  const manualSources = state.sources.length ? state.sources.map(sourceFor) : catalog.sources.filter(s => ["hdfc-bank", "hdfc-card", "cams-cas"].includes(s.id));
  const totalEmails = (state.email.primary ? 1 : 0) + (state.email.extra?.length ?? 0);
  if (!can("setup.wizard", app.plan)) return <PageHeader title="Setup unavailable" />;
  return <>
    <div ref={focus} tabIndex={-1} className="setup-wizard" inert={consent || undefined}
      onKeyDown={e => {
        e.stopPropagation(); // Suspend single-key navigation while this surface is focused.
        if (e.defaultPrevented || document.querySelector('[role="dialog"]')) return;
        if (e.key === "Escape") { e.preventDefault(); void finishLater(); }
        if (e.key === "Enter" && !(e.target instanceof HTMLElement && e.target.closest("button,a,summary,textarea,select,form"))) { e.preventDefault(); void next(); }
      }}
      onDragOver={e => { if (step === "import") e.preventDefault(); }}
      onDrop={e => { if (step === "import" && !e.defaultPrevented) { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) window.dispatchEvent(new CustomEvent("lk-setup-import", { detail: file })); } }}>
      <div className="setup-top"><span className="badge">Included in Free</span><div className="row-actions"><button className="btn ghost" aria-pressed={app.privacy} onClick={() => app.setPrivacy(!app.privacy)}>{app.privacy ? "Show amounts" : "Hide amounts"}</button><button className="btn ghost" onClick={() => void finishLater()}>Finish later</button></div></div>
      <div className="setup-layout">
        <nav className="setup-rail" aria-label="Setup steps">{stepOrder.map((id, i) => <button key={id} className={`setup-rail-step ${step === id ? "active" : ""}`} aria-current={step === id ? "step" : undefined} onClick={() => void navigate(id)}><span>{state.stepsDone.includes(id) ? "✓" : state.stepsSkipped.includes(id) ? "−" : i + 1}</span><div>{id === "welcome" ? "Welcome" : id === "done" ? "Done" : STEP_TITLES[id]}</div></button>)}<p className="tiny muted">On your device. At your pace.</p></nav>
        <div className="setup-content setup-stack">
          <p className="tiny muted">Step {index + 1} of 6, {STEP_TITLES[step]}</p>
          <PageHeader title={step === "done" && health ? "Data sources health" : STEP_TITLES[step]} subtitle={step === "welcome" ? "Your own data, a first budget and a first goal. About five minutes, at your pace." : undefined} />
          {d.storageError && <p role="alert">{d.storageError}</p>}
          {step === "welcome" && <>
            <Glass className="card setup-stack">
              <div className="setup-fields"><label className="field">What should we call you? <span className="tiny muted">Optional · on this device only</span><input maxLength={40} value={profileName} placeholder="Your name" onChange={e => { setProfileName(e.target.value); void act({ type: "setProfile", profile: { name: e.target.value } }); }} /></label>
                <label className="field">Currency<input aria-label="Currency, search ISO codes" list="setup-currencies" maxLength={3} value={profileCurrency} onBlur={() => { if (!currencies.includes(profileCurrency)) setProfileCurrency(state.profile.currency); }} onChange={e => { const value = e.target.value.toUpperCase(); setProfileCurrency(value); if (currencies.includes(value)) void act({ type: "setProfile", profile: { currency: value } }); }} /><datalist id="setup-currencies">{currencies.map(code => <option key={code} value={code} />)}</datalist></label></div>
              {state.profile.currency !== "INR" && <p className="muted">Statement importers are built for Indian banks today; you can still add data by CSV.</p>}
              <div><h2>Make it yours</h2><div className="setup-swatches">{themes.filter(t => !t.premium).map(theme => <button className={`setup-swatch ${app.theme === theme.id ? "active" : ""}`} key={theme.id} aria-pressed={app.theme === theme.id} onClick={() => app.setTheme(theme.id)}><span style={{ background: theme.swatches[app.resolved].bg, color: theme.swatches[app.resolved].gold }}>🪷</span>{theme.name}</button>)}</div></div>
            </Glass>
            <Glass className="card setup-stack setup-promise"><h2>Private by design</h2><p>Your money data stays on this device. No bank logins. If you connect your email, Lakshly reads only finance emails, read-only, on this device. No Lakshly servers ever see your data.</p><p>Statements are read here and stored encrypted (AES-GCM in this browser).</p><p>We never store statement passwords.</p><Link href="/setup/?step=welcome#privacy" prefetch={false}>How Lakshly keeps data private</Link><details id="privacy"><summary>Privacy notice</summary><p>Files are parsed on this device. Parsed data is encrypted in this browser until you delete it from Import. Search links open your mail provider outside Lakshly. Automatic sync is not switched on in this build.</p></details></Glass>
            <div className="setup-choices"><button className="btn primary" onClick={() => void next()}>Set up with my data</button><button className="btn ghost" onClick={() => void act({ type: "chooseMode", mode: "demo" }).then(ok => { if (ok) router.push("/"); })}>Explore with demo data</button></div>
          </>}
          {step === "email" && <>
            <Glass className="card setup-stack">
              <label className="field">Which email do your bank alerts, statements and receipts go to?<input type="email" autoComplete="off" value={email} aria-invalid={!validEmail} onChange={e => { setEmail(e.target.value); setProvider(detectMailProvider(e.target.value)); }} onBlur={() => { if (validEmail) void saveEmail(); }} /></label>
              {!validEmail && <p role="alert" className="tiny">Enter a complete email address, like demo.user@example.com.</p>}
              <p className="muted tiny">Stored only on this device, encrypted.</p>
              <label className="field">Provider<select value={provider} onChange={e => setProvider(e.target.value as MailProvider)}>{PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              {state.mode === "demo" ? <button className="btn primary" onClick={() => void act({ type: "chooseMode", mode: "mine" })}>Use your own data first</button> : provider === "google" || provider === "microsoft" ? <button className="btn primary" disabled={!email.trim() || !validEmail} onClick={() => void saveEmail().then(ok => { if (ok) setConsent(true); })}>Connect {provider === "google" ? "Gmail" : "Outlook"} (read-only)</button> : <p className="muted">Connect this mailbox in the Lakshly Mac or iPhone app, or import by hand.</p>}
              {beta && <div className="setup-beta" role="status">Automatic sync is in a closed beta and isn&apos;t switched on in this build yet. Your email is saved on this device for one-tap searches below.</div>}
              <button className="btn ghost" onClick={() => void saveEmail().then(ok => { if (ok) notify("Your address is saved. Use the searches below, then download the PDF attachment."); })}>I&apos;d rather import by hand</button>
              <div className="setup-stack">{state.email.extra?.map(address => <div className="card-head" key={address}><span>{address}</span><button className="btn ghost" aria-label={`Remove saved address ${address}`} onClick={() => void act({ type: "removeEmail", email: address })}>Remove</button></div>)}
                {can("setup.extraEmails", app.plan) && totalEmails < limit("setup.extraEmails", app.plan) && <div className="setup-fields"><label className="field">Another address for manual searches<input type="email" autoComplete="off" value={extra} onChange={e => setExtra(e.target.value)} /></label><button className="btn ghost" disabled={!VALID_EMAIL.test(extra.trim())} onClick={() => void act({ type: "addEmail", email: extra }).then(ok => { if (ok) setExtra(""); })}>Save another address</button></div>}
                <p className="tiny muted">Up to {limit("setup.extraEmails", app.plan)} addresses for one-tap manual searches.</p></div>
              <button className="btn ghost" onClick={() => void act({ type: "skipEmail" }).then(ok => { if (ok) void navigate("accounts"); })}>Skip: I don&apos;t use email for this</button>
            </Glass>
            <Glass className="card setup-stack"><h2>Prefer not to connect? Find the emails yourself</h2>{!state.sources.length && <p className="muted">Here are a few common searches. Pick your accounts next to tailor this guide.</p>}{manualSources.map(source => <details key={source.id}><summary>{source.name}</summary><SetupSearch source={source} state={state} notify={notify} /></details>)}</Glass>
          </>}
          {step === "accounts" && <>
            <label className="field">Find an institution<input type="search" value={search} placeholder="Search names and aliases" onChange={e => setSearch(e.target.value)} /></label>
            {pickedInvestments.length > 0 && !state.sources.some(p => sourceFor(p).kinds.includes("cas")) && <Glass className="card setup-stack"><p>Your {pickedInvestments.map(p => sourceFor(p).name).join(" and ")} funds are in your CAS: add it?</p><button className="btn ghost" onClick={() => void act({ type: "toggleSource", catalogId: "cams-cas" })}>Add a CAMS / KFintech CAS</button></Glass>}
            {catalog.kindOrder.map(kind => {
              const rows = catalog.sources.filter(source => source.kinds.includes(kind) && [source.name, ...source.aliases].join(" ").toLowerCase().includes(search.toLowerCase()));
              if (!rows.length) return null;
              return <Glass key={kind} className="card setup-stack"><h2>{catalog.kinds[kind as keyof typeof catalog.kinds]}</h2><div className="setup-source-grid">{rows.map(source => { const selected = state.sources.some(p => p.catalogId === source.id); return <button className={`setup-source ${selected ? "active" : ""}`} key={source.id} aria-pressed={selected} onClick={() => void act({ type: "toggleSource", catalogId: source.id })}><span aria-hidden="true">{selected ? "✓" : "+"}</span><span>{source.name}{!source.importer.supported && <small className="muted">add manually</small>}</span></button>; })}</div></Glass>;
            })}
            {state.sources.filter(s => s.custom).map(s => <button key={s.catalogId} className="btn ghost" aria-pressed="true" onClick={() => void act({ type: "toggleSource", catalogId: s.catalogId })}>✓ {s.custom!.name} · remove</button>)}
            <button className="btn ghost" onClick={() => setShowCustom(!showCustom)}>+ Something else</button>
            {showCustom && <Glass className="card setup-stack"><label className="field">Institution name<input maxLength={80} value={customName} onChange={e => setCustomName(e.target.value)} /></label><label className="field">Sender domain (optional)<input value={customDomain} placeholder="bank.example" onChange={e => setCustomDomain(e.target.value)} /></label><button className="btn primary" disabled={!customName.trim() || (!!customDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(customDomain))} onClick={() => void act({ type: "addCustomSource", name: customName.trim(), domain: customDomain || undefined }).then(ok => { if (ok) { setShowCustom(false); setCustomName(""); setCustomDomain(""); } })}>Add source</button></Glass>}
          </>}
          {step === "import" && <>
            <p className="muted">Drop a PDF or CSV anywhere on this page. Files are read here; nothing is uploaded.</p>
            {state.sources.length === 0 && <Glass className="card setup-stack"><p>Pick your accounts for tailored download steps and password hints, or import a file below.</p><button className="btn ghost" onClick={() => void navigate("accounts")}>Pick accounts</button></Glass>}
            {state.sources.map(picked => { const source = sourceFor(picked); return <Glass key={picked.catalogId} className="card setup-stack"><div className="card-head"><h2>{source.name}</h2><span className={`setup-status ${picked.status}`}>{STATUS[picked.status]}</span></div>{picked.lastDataDate && <p className="tiny muted">Up to {formatDate(picked.lastDataDate)} · {(state.imports ?? []).filter(i => picked.importIds?.includes(i.id)).reduce((sum, i) => sum + i.added, 0)} transactions</p>}{picked.skipReason && <p className="tiny muted">{picked.skipReason}</p>}<details><summary>How to get it</summary><SourceGuide picked={picked} state={state} notify={notify} /></details><div className="setup-fields"><label className="field">Skip reason<select value={picked.status === "skipped" ? picked.skipReason ?? "not-now-ok" : ""} onChange={e => { if (e.target.value) void act({ type: "setSourceStatus", catalogId: picked.catalogId, status: "skipped", reason: e.target.value }); }}><option value="">Skip this source…</option><option value="via-card">Charges come via my card</option><option value="manual">Track manually</option><option value="no-account">I don&apos;t have this account</option><option value="not-now-ok">Not now</option></select></label>{picked.status === "skipped" && <button className="btn ghost" onClick={() => void act({ type: "setSourceStatus", catalogId: picked.catalogId, status: "todo" })}>Try again</button>}</div></Glass>; })}
            {pendingImport && d.user && <Glass className="card setup-stack"><h2>Which account is this?</h2><p className="muted">{pendingImport.file} · {pendingImport.adapter}. Pick a source to remember it for this account.</p>{candidates.map(id => <button key={id} className="btn ghost" onClick={() => void act(attributionAction(d.user!, pendingImport, id)).then(ok => { if (ok) notify(`Imported ${pendingImport.added} transactions from ${sourceFor(state.sources.find(s => s.catalogId === id) ?? id).name}.`); })}>{sourceFor(state.sources.find(s => s.catalogId === id) ?? id).name}</button>)}{!candidates.length && <button className="btn ghost" onClick={() => void navigate("accounts")}>Pick a source first</button>}</Glass>}
            <Importer compact onImported={(report, result) => notify(`Imported ${report.added} new transactions${report.duplicates ? `, ${report.duplicates} already had` : ""}. ${result.adapterLabel}.`)} />
          </>}
          {step === "plan" && <>{currency !== state.profile.currency && <p className="muted">Amounts stay in INR because the imported accounts are not all in {state.profile.currency}. There is no currency conversion.</p>}<SetupPlan today={today} currency={currency} notify={notify} /></>}
          {step === "done" && <>
            <Glass className="card setup-stack setup-done"><SetupRing {...progress} /><h2>{progress.upAndRunning ? `Lakshly is up and running, ${state.profile.name.trim() || "there"} 🪷` : "A little more, at your pace"}</h2><p className="muted">{progress.done} of {progress.applicable} complete. Every step is yours to skip or come back to.</p><div className="setup-checklist">{progress.items.map(item => <button className="setup-check" key={item.id} aria-label={`${LABELS[item.id]}, ${item.done ? "done" : "not done"}${item.required ? ", required" : ""}`} onClick={() => void navigate(CHECK_STEPS[item.id] ?? "done")}><span aria-hidden="true">{item.done ? "✓" : "○"}</span><span>{LABELS[item.id]}{item.required && <small className="muted">Required</small>}</span><span aria-hidden="true">›</span></button>)}</div><div className="row-actions"><Link className="btn primary" href="/" prefetch={false}>Go to Overview</Link><button className="btn ghost" onClick={() => { const item = progress.items.find(i => !i.done); if (item) void navigate(CHECK_STEPS[item.id] ?? "import"); else notify("Everything is set. Your sources health is below."); }}>Keep going</button></div></Glass>
            {can("setup.health", app.plan) && state.sources.map(picked => { const status = freshness(picked, catalog, today), nextDate = freshnessNextDate(picked), source = sourceFor(picked); return <Glass key={picked.catalogId} className="card setup-stack"><div className="card-head"><h2>{source.name}</h2><span className={`setup-status ${status}`}>{status === "fresh" ? "✓ Fresh" : status === "stale" ? "⚠ Stale" : status === "due" ? "◷ Due" : status === "skipped" ? "− Skipped" : "○ To do"}</span></div>{nextDate && <p className="muted">Statement due ~{formatDate(nextDate).replace(/ \d{4}$/, "")} · search mail</p>}<details><summary>Search mail / how to get it</summary><SourceGuide picked={picked} state={state} notify={notify} /></details></Glass>; })}
          </>}
          <div className="setup-bar glass"><button className="btn ghost" disabled={index === 0 || busy} onClick={() => void navigate(stepOrder[index - 1])}>Back</button><button className="btn ghost" disabled={busy} onClick={() => void skip()}>Skip</button><button className="btn primary" disabled={busy || (step === "email" && !validEmail)} onClick={() => void next()}>{step === "done" ? "Go to Overview" : "Continue"}</button></div>
        </div>
      </div>
    </div>
    {consent && <SetupConsent state={state} close={closeConsent} agree={() => { setConsent(false); setBeta(true); notify("Your email is saved for manual searches. Automatic sync is not switched on in this build."); }} />}
    <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
    {toast && <Glass className="toast"><span role="status">{toast}</span></Glass>}
    {celebrate && <div className="setup-confetti" aria-hidden="true">{Array.from({ length: 16 }, (_, i) => <i key={i} style={{ "--i": i } as CSSProperties} />)}</div>}
  </>;
}
