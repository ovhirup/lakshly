"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { MergeReport, ParseResult } from "@lakshly/parsers";
import { useAppState } from "@/components/AppState";
import { useData } from "@/components/DataState";
import { Icon } from "@/components/Icon";
import { Importer, importToast } from "@/components/Importer";
import { useSetup, writeFlags } from "@/components/SetupState";
import { Ring } from "@/components/SetupParts";
import { useTier } from "@/components/useTier";
import { Glass } from "@/components/ui";
import { formatINR, formatMonth, titleCase } from "@/lib/format";
import { googlePrefill, NAME_MAX, saveProfile, useProfile } from "@/lib/profile";
import { themes } from "@/lib/themes";
import { CATALOG } from "@/lib/sources.gen";
import type { Source, SourceKind } from "@/lib/setup-types";
import type { Category } from "@/lib/schema.gen";
import {
  attribute, detectProvider, EMAIL_RE, findSource, freshness, gmailQuery, gmailUrl, groupByKind, importTargets, normaliseEmail,
  outlookOpenUrl, outlookQuery, passwordHintText, searchCatalog, SKIP_REASONS, STEP_LABELS, STEPS,
  type Freshness, type Provider, type SkipReason, type StepId,
} from "@/lib/setup";
import { goalFacts, PRESET_FACTOR, roundBudget, suggestBudget, suggestGoal, VARIABLE_CATEGORIES, type Preset } from "@/lib/setup-suggest";
import "@/components/setup.css";
import { GMAIL_CONNECT } from "@/lib/edition";
import { GmailConnectCard, SignInWithGoogle, useGoogle } from "@/components/GoogleConnect";
import { anyStatementQuery, gmailStatementQuery } from "@/lib/gmail";

const today = () => new Date().toISOString().slice(0, 10);
const PROVIDER_LABEL: Record<Provider, string> = { gmail: "Gmail", outlook: "Outlook", icloud: "iCloud Mail", yahoo: "Yahoo Mail", other: "Custom domain" };

export default function SetupPage() {
  return <Suspense fallback={null}><Wizard /></Suspense>;
}

function Wizard() {
  const router = useRouter();
  const params = useSearchParams();
  const { ready, state, dispatch, progress, items, resume, justCompleted, ackCompleted } = useSetup();
  const data = useData();
  const profile = useProfile();
  const [toast, setToast] = useState<string | null>(null);
  const continueRef = useRef<() => void>(() => undefined);
  const deepLinked = useRef(false);

  // First visit marks the wizard as seen, so it never auto-opens again.
  useEffect(() => { writeFlags({ seen: true }); }, []);

  // ?step= deep link (once, after the vault record is read).
  useEffect(() => {
    if (!ready || deepLinked.current) return;
    deepLinked.current = true;
    const want = params.get("step");
    if (want === "resume") dispatch({ type: "goTo", step: resume });
    else if (want && (STEPS as readonly string[]).includes(want)) dispatch({ type: "goTo", step: want as StepId });
    else if (state.at === "welcome" && resume !== "welcome") dispatch({ type: "goTo", step: resume });
  }, [ready, params, dispatch, resume, state.at]);

  // Keep the URL in step with the wizard without a navigation.
  useEffect(() => {
    if (!ready) return;
    const url = `/setup/?step=${state.at}`;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(null, "", url);
  }, [ready, state.at]);

  // One toast at a time; a timer only clears the message it showed.
  const toastId = useRef(0);
  const show = useCallback((t: string, ms: number) => {
    const id = ++toastId.current;
    setToast(t);
    setTimeout(() => { if (toastId.current === id) setToast(null); }, ms);
  }, []);

  useEffect(() => {
    if (!justCompleted) return;
    const name = profile.name.split(" ")[0];
    // Celebration toast for the one-time setup.completed event.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    show(`Lakshly is up and running${name ? `, ${name}` : ""} 🪷`, 7000);
    ackCompleted();
  }, [justCompleted, ackCompleted, profile.name, show]);

  const finishLater = useCallback(() => { writeFlags({ seen: true }); router.push("/"); }, [router]);
  const flash = useCallback((t: string) => show(t, 4500), [show]);

  // Enter = Continue, Esc = Finish later (unless a control inside handles the key).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.isComposing) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest("[data-keys-off]")) return;
      if (e.key === "Escape") { e.preventDefault(); finishLater(); }
      if (e.key === "Enter" && !e.shiftKey) {
        const tag = el?.tagName ?? "";
        if (["BUTTON", "A", "SELECT", "TEXTAREA", "SUMMARY"].includes(tag)) return;
        e.preventDefault();
        continueRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finishLater]);

  const at = state.at;
  const idx = STEPS.indexOf(at);

  if (!ready || !data.ready) {
    return <div className="setup"><p className="muted" role="status">Opening your on-device vault…</p></div>;
  }

  return (
    <div className="setup">
      <header className="setup-head">
        <div>
          <p className="eyebrow">Guided setup · free</p>
          <h1>Set up Lakshly</h1>
        </div>
        <div className="setup-head-actions">
          <span className="setup-count" aria-label={`${progress.done} of ${progress.total} done`}><Ring pct={progress.percent} size={34} /> {progress.done} of {progress.total}</span>
          <button className="btn ghost" onClick={finishLater}>Finish later</button>
        </div>
      </header>

      <div className="setup-body">
        <nav className="setup-rail glass" aria-label="Setup steps">
          <ol>
            {STEPS.map((s, i) => {
              const done = state.done.includes(s);
              const skipped = state.skipped.includes(s);
              return (
                <li key={s}>
                  <button className={`rail-step ${s === at ? "current" : ""} ${done ? "done" : ""} ${skipped ? "skipped" : ""}`}
                    aria-current={s === at ? "step" : undefined} onClick={() => dispatch({ type: "goTo", step: s })}>
                    <span className="rail-dot" aria-hidden="true">{done ? <Icon name="check" size={13} /> : skipped ? "–" : i + 1}</span>
                    <span>{STEP_LABELS[s]}<small>{done ? "Done" : skipped ? "Skipped" : s === at ? "In progress" : ""}</small></span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="tiny muted rail-note"><Icon name="shield" size={12} /> Everything stays on this device. Nothing is uploaded. <Link href="/import/#your-data">Delete all my data</Link></p>
        </nav>

        <section className="setup-step" aria-labelledby="step-title">
          <p className="tiny muted step-of">Step {idx + 1} of {STEPS.length}</p>
          {at === "welcome" && <Welcome continueRef={continueRef} />}
          {at === "email" && <EmailStep continueRef={continueRef} flash={flash} />}
          {at === "accounts" && <AccountsStep continueRef={continueRef} />}
          {at === "import" && <ImportStep continueRef={continueRef} flash={flash} />}
          {at === "plan" && <PlanStep continueRef={continueRef} flash={flash} />}
          {at === "done" && <DoneStep continueRef={continueRef} items={items} />}
        </section>
      </div>
      {toast && <Glass className="toast" as="div"><span role="status">{toast}</span></Glass>}
    </div>
  );
}

type StepProps = { continueRef: React.MutableRefObject<() => void> };

/** Back · Skip · Continue. Sticky at the bottom on narrow screens. */
function StepBar({ onContinue, continueLabel = "Continue", canContinue = true, skip = true, continueRef }: StepProps & {
  onContinue: () => void; continueLabel?: string; canContinue?: boolean; skip?: boolean;
}) {
  const { state, dispatch } = useSetup();
  useEffect(() => { continueRef.current = canContinue ? onContinue : () => undefined; });
  return (
    <div className="setup-bar glass">
      <button className="btn ghost" onClick={() => dispatch({ type: "back" })} disabled={state.at === "welcome"}>Back</button>
      <span className="grow" />
      {skip && <button className="btn ghost" onClick={() => dispatch({ type: "skip", step: state.at })}>Skip</button>}
      <button className="btn primary" onClick={onContinue} disabled={!canContinue}>{continueLabel}</button>
    </div>
  );
}

/* ───────────── 1 · Welcome ───────────── */

function Welcome({ continueRef }: StepProps) {
  const router = useRouter();
  const profile = useProfile();
  const { theme, setTheme } = useAppState();
  const { setSource } = useData();
  const { state, dispatch } = useSetup();
  const [name, setName] = useState(profile.name);
  const [touched, setTouched] = useState(false);
  // The profile loads from the encrypted vault after first paint: fill the field once it arrives, unless already typed in.
  const [seeded, setSeeded] = useState(profile.loaded);
  if (!seeded && profile.loaded) { setSeeded(true); if (!touched && !name) setName(profile.name); }
  const free = themes.filter((t) => !t.premium);
  const resolved = typeof document !== "undefined" && document.documentElement.dataset.appearance === "dark" ? "dark" : "light";

  function mine() {
    if (touched) saveProfile({ name });
    dispatch({ type: "start", mode: "mine" });
    setSource("mine");
    dispatch({ type: "complete", step: "welcome" });
  }
  function demo() {
    if (touched) saveProfile({ name });
    dispatch({ type: "start", mode: "demo" });
    setSource("demo");
    writeFlags({ seen: true, mode: "demo" });
    router.push("/");
  }

  return (
    <>
      <h2 id="step-title">Welcome to Lakshly <span aria-hidden="true">🪷</span></h2>
      <p className="muted lead">A few minutes to make it yours: your banks, a first statement and a budget that fits. You can stop any time and pick up where you left off.</p>

      {GMAIL_CONNECT && (
        <Glass className="card gsi-card">
          <div className="card-head"><h3>Sign in with Google <span className="muted tiny">(optional)</span></h3><span className="badge">Beta</span></div>
          <SignInWithGoogle onIdentity={(id) => { const n = googlePrefill(name, id.givenName, id.name); if (n) { setName(n); saveProfile({ name: n, nameSource: "google" }); } }} />
        </Glass>
      )}

      <div className="setup-grid">
        <Glass className="card">
          <label className="field">What should we call you? <span className="muted tiny">(optional)</span>
            <input type="text" value={name} onChange={(e) => { setTouched(true); setName(e.target.value.slice(0, NAME_MAX)); }}
              onBlur={() => { if (touched) saveProfile({ name }); }} maxLength={NAME_MAX} autoComplete="given-name" placeholder="Your name" data-testid="welcome-name" />
          </label>
          <p className="tiny muted">Shown on your profile card. Stays on this device, encrypted.</p>
          <label className="field">Currency
            <select value="INR" disabled aria-describedby="cur-note"><option value="INR">₹ Indian rupee (INR)</option></select>
          </label>
          <p className="tiny muted" id="cur-note">More currencies are on the way.</p>
        </Glass>

        <Glass className="card">
          <h3>Pick a look</h3>
          <div className="setup-themes" role="group" aria-label="Theme">
            {free.map((t) => {
              const sw = t.swatches[resolved];
              return (
                <button key={t.id} className="setup-theme" aria-pressed={theme === t.id} onClick={() => { setTheme(t.id); dispatch({ type: "theme" }); }}>
                  <span className="setup-theme-swatch" style={{ background: sw.bg, borderColor: sw.surface }}>
                    <i style={{ background: sw.gold }} /><i style={{ background: sw.accent }} /><i style={{ background: sw.income }} />
                  </span>
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>
          <p className="tiny muted">All three are free. Change it any time from the palette button.</p>
        </Glass>
      </div>

      <Glass className="card promise">
        <h3><Icon name="shield" size={16} /> Our privacy promise</h3>
        <ul>
          <li>Statements are opened in this browser tab. Nothing is uploaded, ever.</li>
          <li>No bank logins and no passwords stored. Statement passwords are used once, then forgotten.</li>
          <li>Your data is encrypted on this device and you can delete all of it in one tap.</li>
        </ul>
      </Glass>

      <div className="setup-choice">
        <button className={`choice-card glass ${state.mode === "mine" ? "on" : ""}`} onClick={mine} data-testid="choose-mine">
          <span className="choice-icon" aria-hidden="true"><Icon name="import" size={22} /></span>
          <strong>Set up with my data</strong>
          <span className="muted tiny">Import your own statements. About 5 minutes.</span>
        </button>
        <button className={`choice-card glass ${state.mode === "demo" ? "on" : ""}`} onClick={demo}>
          <span className="choice-icon" aria-hidden="true"><Icon name="sparkle" size={22} /></span>
          <strong>Explore with demo data</strong>
          <span className="muted tiny">Look around with made-up numbers first. Setup waits for you.</span>
        </button>
      </div>
      <StepBar continueRef={continueRef} onContinue={mine} continueLabel="Set up with my data" skip={false} />
    </>
  );
}

/* ───────────── 2 · Email ───────────── */

function EmailStep({ continueRef, flash }: StepProps & { flash: (t: string) => void }) {
  const { state, dispatch } = useSetup();
  const imported = useData().user?.imports.length ?? 0;
  const { limit } = useTier();
  const extra = limit("setup.extraEmails") ?? 10;
  const google = useGoogle();
  const [emails, setEmails] = useState<string[]>(state.emails.length ? state.emails : [GMAIL_CONNECT && google.identity ? google.identity.email : ""]);
  const primary = emails[0] ?? "";
  const provider = detectProvider(primary);
  const valid = emails.filter((e) => e.trim()).every((e) => EMAIL_RE.test(normaliseEmail(e)));
  const sample = findSource("hdfc-bank") ?? CATALOG.sources[0];

  function save() {
    dispatch({ type: "setEmails", emails, max: 1 + extra });
    dispatch({ type: "complete", step: "email" });
  }

  return (
    <>
      <h2 id="step-title">Where do your statements arrive?</h2>
      <p className="muted lead">Banks email statements every month. Download one and drop it here, or tell us which inbox and every account in the next steps gets a ready-made search that opens straight in your mail.</p>

      <ManualImportCard flash={flash} email={normaliseEmail(primary)} />

      <Glass className="card">
        <h3 className="email-card-title">Your statement inbox</h3>
        {emails.map((e, i) => {
          const p = detectProvider(e);
          return (
            <div className="email-row" key={i}>
              <label className="field grow">{i === 0 ? "Email address" : `Another address (${i} of ${extra})`}
                <input type="email" inputMode="email" autoComplete={i === 0 ? "email" : "off"} value={e} placeholder="you@example.com"
                  onChange={(ev) => setEmails(emails.map((x, j) => (j === i ? ev.target.value : x)))}
                  aria-invalid={!!e.trim() && !p} />
              </label>
              {p && <span className="badge provider-chip">{PROVIDER_LABEL[p]}</span>}
              {i > 0 && <button className="icon-btn" aria-label={`Remove address ${i + 1}`} onClick={() => setEmails(emails.filter((_, j) => j !== i))}>×</button>}
            </div>
          );
        })}
        {emails.length < 1 + extra && primary.trim() && (
          <button className="btn ghost small" onClick={() => setEmails([...emails, ""])}>+ Add another address</button>
        )}
        <p className="tiny muted">Stored encrypted on this device and only used to open the right inbox. Never sent anywhere.</p>
      </Glass>

      {GMAIL_CONNECT ? <GmailConnectCard email={normaliseEmail(primary)} picked={state.picked} /> : <Glass className="card connect-card">
        <div className="card-head"><h3>Automatic sync</h3><span className="badge">Coming soon</span></div>
        <p className="muted tiny">Read-only sync that fetches new statements by itself is in a limited beta (one mailbox will stay free). It needs a review by Google and Microsoft first, so on the web we use the guided search for now. It finds the same statements in about a minute.</p>
        <div className="row-actions">
          <button className="btn ghost" disabled aria-describedby="sync-note">Connect Gmail (read-only)</button>
          <button className="btn ghost" disabled aria-describedby="sync-note">Connect Outlook (read-only)</button>
        </div>
        <p className="tiny muted" id="sync-note">Limited beta. Use the guided search below.{provider && provider !== "gmail" && provider !== "outlook" ? ` ${PROVIDER_LABEL[provider]} and other IMAP mailboxes will connect from the Apple app. On the web, search your inbox using the subjects we show.` : ""}</p>
      </Glass>}

      <Glass className="card">
        <h3>How the search guide works</h3>
        <p className="muted tiny">For each bank or card you pick, we build a search like this one for {sample.name}:</p>
        <code className="query">{provider === "outlook" ? outlookQuery(sample, today(), "statements") : gmailQuery(sample, "statements")}</code>
        <p className="muted tiny">{provider === "outlook" ? "Copy it, open Outlook and paste it into the search box." : "One click opens it in Gmail for the right account. Download the PDF and drop it into Lakshly."}</p>
      </Glass>
      <StepBar continueRef={continueRef} onContinue={save} canContinue={valid && (!!primary.trim() || imported > 0)} />
    </>
  );
}

/* ───────────── Manual import: the main path (launch) ───────────── */

const CAS_HELPERS = [["cams-cas", "CAMS CAS"], ["kfintech-cas", "KFintech CAS"]] as const;

/** Gold primary drop/choose card. Guided Gmail searches are the helper underneath (the person opens them in Gmail). */
function ManualImportCard({ flash, email, onImported, perAccount }: {
  flash: (t: string) => void; email: string; perAccount?: boolean;
  onImported?: (r: ParseResult, report: MergeReport) => void;
}) {
  const { state, dispatch } = useSetup();
  const [copied, setCopied] = useState(false);
  const gmailOk = !email || ["gmail", "other"].includes(detectProvider(email) ?? "other");
  const cas = CAS_HELPERS.flatMap(([id, label]) => { const src = findSource(id); return src ? [{ src, label }] : []; });
  function done(r: ParseResult, report: MergeReport) {
    if (onImported) return onImported(r, report);
    flash(importToast(report));
    const a = attribute(r.adapter, state.picked, state.custom);
    const periodTo = r.meta.map((m) => m.periodTo).filter(Boolean).sort().pop();
    if (a.kind === "auto") dispatch({ type: "imported", id: a.sourceId, at: new Date().toISOString(), periodTo });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(gmailUrl(anyStatementQuery(), email)); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
  }
  return (
    <Glass className="card manual-card" as="section" aria-labelledby="manual-title" data-testid="manual-import">
      <div className="card-head"><h3 id="manual-title"><Icon name="import" size={16} /> Import statements yourself</h3><span className="badge status-imported">Recommended</span></div>
      <p className="muted tiny lead-tiny">Drop a bank or card statement PDF or CSV. Password-protected PDFs and CAMS / KFintech CAS work. Read on this device, never uploaded.</p>
      <Importer onImported={done} cta="Choose a statement file" prompt="Drop a statement PDF or CSV here" />
      <div className="manual-helper" role="note" aria-label="How to find your statements">
        <strong className="tiny">Need to find one? Use the guided search</strong>
        <ol className="tiny muted">
          <li>Open the search in {gmailOk ? "Gmail" : "your mail"}.</li>
          <li>Download the statement PDF.</li>
          <li>Drop it above.{perAccount ? " Each account below has its own search too." : ""}</li>
        </ol>
        {gmailOk && (
          <div className="row-actions">
            <a className="btn ghost small" href={gmailUrl(anyStatementQuery(), email)} target="_blank" rel="noopener noreferrer" data-testid="manual-search-all">Search Gmail for statements ↗</a>
            {cas.map(({ src, label }) => <a key={src.id} className="btn ghost small" href={gmailUrl(gmailStatementQuery(src), email)} target="_blank" rel="noopener noreferrer" aria-label={`Search Gmail for ${src.name} statements (opens Gmail)`}>{label} ↗</a>)}
            <button className="btn ghost small" onClick={() => void copy()}>{copied ? "Copied ✓" : "Copy search link"}</button>
          </div>
        )}
      </div>
    </Glass>
  );
}

/* ───────────── 3 · Accounts ───────────── */

function AccountsStep({ continueRef }: StepProps) {
  const { state, dispatch } = useSetup();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customKind, setCustomKind] = useState<SourceKind>("bank");
  const groups = groupByKind(searchCatalog(q));
  const wantsCas = state.picked.some((id) => findSource(id)?.suggestsCas) && !state.picked.includes("cams-cas");

  return (
    <>
      <h2 id="step-title">Which banks, cards and investments do you use?</h2>
      <p className="muted lead">Pick everything you have. It becomes your import checklist. No account numbers needed.</p>

      <div className="setup-search" data-keys-off>
        <input type="search" placeholder="Search banks, cards, apps…" aria-label="Search banks, cards and apps" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="tiny muted" aria-live="polite">{state.picked.length} picked</span>
      </div>

      {wantsCas && (
        <Glass className="card cas-tip">
          <p><strong>Tip:</strong> mutual funds bought through investment apps all appear in one CAS statement from CAMS / KFintech. Lakshly imports that fully.</p>
          <button className="btn primary small" onClick={() => dispatch({ type: "toggleSource", id: "cams-cas" })}>Add CAMS / KFintech CAS</button>
        </Glass>
      )}

      {groups.map((g) => (
        <div className="source-group" key={g.kind}>
          <h3>{g.label}</h3>
          <div className="source-chips">
            {g.sources.map((s) => {
              const on = state.picked.includes(s.id);
              return (
                <button key={s.id} className={`source-chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => dispatch({ type: "toggleSource", id: s.id })}>
                  {on && <Icon name="check" size={13} />}
                  <span>{s.name}</span>
                  {!s.importer.supported && <em className="tag">add manually</em>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!groups.length && <p className="muted">No match for “{q}”. Add it below and import its statements with the generic reader.</p>}

      <div className="source-group">
        <h3>Something else</h3>
        <div className="source-chips">
          {state.custom.map((c) => (
            <span key={c.id} className="source-chip on">
              <Icon name="check" size={13} /><span>{c.name}</span><em className="tag">{CATALOG.kinds[c.kind]}</em>
              <button className="icon-btn" aria-label={`Remove ${c.name}`} onClick={() => dispatch({ type: "removeCustom", id: c.id })}>×</button>
            </span>
          ))}
          {!adding && <button className="source-chip add" onClick={() => { setAdding(true); setCustomName(q); }}>+ Something else</button>}
        </div>
        {adding && (
          <form className="custom-form" data-keys-off onSubmit={(e) => { e.preventDefault(); dispatch({ type: "addCustom", name: customName, kind: customKind }); setCustomName(""); setAdding(false); }}>
            <label className="field grow">Name<input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} maxLength={40} autoFocus placeholder="e.g. My local co-op bank" /></label>
            <label className="field">Type
              <select value={customKind} onChange={(e) => setCustomKind(e.target.value as SourceKind)}>
                {(["bank", "card", "paylater", "invest", "insurance", "subscription"] as SourceKind[]).map((k) => <option key={k} value={k}>{CATALOG.kinds[k]}</option>)}
              </select>
            </label>
            <button className="btn primary" type="submit" disabled={!customName.trim()}>Add</button>
            <button className="btn ghost" type="button" onClick={() => setAdding(false)}>Cancel</button>
          </form>
        )}
      </div>
      <StepBar continueRef={continueRef} onContinue={() => dispatch({ type: "complete", step: "accounts" })} canContinue={state.picked.length > 0} />
    </>
  );
}

/* ───────────── 4 · Import ───────────── */

const STATUS_LABEL = { todo: "To do", imported: "Imported", skipped: "Skipped" } as const;

function ImportStep({ continueRef, flash }: StepProps & { flash: (t: string) => void }) {
  const { state, dispatch } = useSetup();
  const data = useData();
  const targets = importTargets(state);
  const [open, setOpen] = useState<string | null>(() => targets.find((t) => t.supported && state.progress[t.id]?.status !== "imported")?.id ?? null);
  const [ask, setAsk] = useState<{ candidates: string[]; periodTo?: string } | null>(null);
  const imported = data.user?.imports.length ?? 0;

  const periodOf = (r: ParseResult) => r.meta.map((m) => m.periodTo).filter(Boolean).sort().pop();
  function onGeneral(r: ParseResult, report: MergeReport) {
    flash(importToast(report));
    const a = attribute(r.adapter, state.picked, state.custom);
    if (a.kind === "auto") dispatch({ type: "imported", id: a.sourceId, at: new Date().toISOString(), periodTo: periodOf(r) });
    else setAsk({ candidates: a.candidates.length ? a.candidates : state.picked, periodTo: periodOf(r) });
  }
  const nameOf = (id: string) => targets.find((t) => t.id === id)?.name ?? id;

  return (
    <>
      <h2 id="step-title">Bring in your statements</h2>
      <p className="muted lead">One statement per account is enough to start. Drop it here; the ready-made searches help you find it. Everything is read on this device.</p>

      {ask && (
        <Glass className="card ask-card" as="div">
          <h3>Which account is this?</h3>
          <p className="muted tiny">This file uses the general reader, so we can&apos;t tell which bank it came from.</p>
          <div className="source-chips">
            {ask.candidates.map((id) => (
              <button key={id} className="source-chip" onClick={() => { dispatch({ type: "imported", id, at: new Date().toISOString(), periodTo: ask.periodTo }); setAsk(null); }}>{nameOf(id)}</button>
            ))}
            <button className="source-chip" onClick={() => setAsk(null)}>None of these</button>
          </div>
        </Glass>
      )}

      <ManualImportCard flash={flash} email={state.emails[0] ?? ""} onImported={onGeneral} perAccount={targets.length > 0} />

      {targets.length > 0 && <h3 className="import-list-title">Or go account by account</h3>}
      <div className="import-list">
        {targets.map((t) => {
          const p = state.progress[t.id];
          const status = p?.status ?? "todo";
          const isOpen = open === t.id;
          return (
            <Glass key={t.id} className={`card import-row ${isOpen ? "open" : ""}`} as="div">
              <button className="import-row-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : t.id)}>
                <span className={`status-dot ${t.supported ? status : "manual"}`} aria-hidden="true">{status === "imported" ? <Icon name="check" size={12} /> : null}</span>
                <span className="grow">
                  <strong>{t.name}</strong>
                  <small className="muted">{CATALOG.kinds[t.kind]}{p?.status === "skipped" && p.skipReason ? ` · ${SKIP_REASONS[p.skipReason]}` : ""}</small>
                </span>
                <span className={`badge status-${t.supported ? status : "manual"}`}>{t.supported ? STATUS_LABEL[status] : "Track by hand"}</span>
                <span className="chev" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
              </button>
              {isOpen && <HowTo targetId={t.id} source={t.source} supported={t.supported} emails={state.emails}
                onImported={(r, report) => { flash(importToast(report)); dispatch({ type: "imported", id: t.id, at: new Date().toISOString(), periodTo: periodOf(r) }); setOpen(targets.find((x) => x.supported && x.id !== t.id && state.progress[x.id]?.status !== "imported")?.id ?? null); }}
                onSkip={(reason) => { dispatch({ type: "skipSource", id: t.id, reason }); setOpen(null); }}
                onUnskip={status === "skipped" ? () => dispatch({ type: "unskipSource", id: t.id }) : undefined} />}
            </Glass>
          );
        })}
        {!targets.length && <p className="muted">You haven&apos;t picked any accounts yet. <button className="link" onClick={() => dispatch({ type: "goTo", step: "accounts" })}>Pick accounts</button></p>}
      </div>

      {GMAIL_CONNECT && <GmailConnectCard email={state.emails[0] ?? ""} picked={state.picked}
        onImported={(id, r, report) => { flash(importToast(report)); dispatch({ type: "imported", id, at: new Date().toISOString(), periodTo: periodOf(r) }); }} />}

      <StepBar continueRef={continueRef} onContinue={() => dispatch({ type: "complete", step: "import" })} canContinue={imported > 0}
        continueLabel={imported > 0 ? "Continue" : "Import one to continue"} />
    </>
  );
}

function HowTo({ targetId, source, supported, emails, onImported, onSkip, onUnskip }: {
  targetId: string; source?: Source; supported: boolean; emails: string[];
  onImported: (r: ParseResult, report: MergeReport) => void; onSkip: (r: SkipReason) => void; onUnskip?: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [skipping, setSkipping] = useState(false);
  const hints = source ? passwordHintText(source.passwordHints) : [];
  const addrs: (string | undefined)[] = emails.length ? emails : [undefined];
  async function copy(text: string, id: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 2500); } catch { setCopied(null); }
  }
  if (!supported) {
    return (
      <div className="howto">
        <p className="muted">{source?.importer.note ?? "There's no importer for this yet."}</p>
        {source && <p className="tiny muted">Where to find it: {source.download}</p>}
      </div>
    );
  }
  return (
    <div className="howto">
      {source && (
        <ol className="howto-steps">
          <li>
            <strong>Find it in your email</strong>
            {source.searches.filter((s) => s.attachment || source.searches.length === 1).map((s) => (
              <div className="search-block" key={s.id}>
                <span className="tiny muted">{s.label}</span>
                {addrs.map((email) => {
                  const p = email ? detectProvider(email) : null;
                  const showGmail = !p || p === "gmail" || p === "other";
                  const showOutlook = !p || p === "outlook" || p === "other";
                  const oq = outlookQuery(source, today(), s.id);
                  return (
                    <div className="search-links" key={email ?? "any"}>
                      {email && emails.length > 1 && <span className="tiny">{email}</span>}
                      {showGmail && <code className="query">{gmailQuery(source, s.id)}</code>}
                      <div className="row-actions">
                        {showGmail && <a className="btn ghost small" href={gmailUrl(gmailQuery(source, s.id), email)} target="_blank" rel="noopener noreferrer">Search Gmail ↗</a>}
                        {showGmail && <button className="btn ghost small" onClick={() => void copy(gmailUrl(gmailQuery(source, s.id), email), `g-${s.id}-${email}`)}>{copied === `g-${s.id}-${email}` ? "Copied ✓" : "Copy search link"}</button>}
                        {showOutlook && <button className="btn ghost small" onClick={() => void copy(oq, `o-${s.id}-${email}`)}>{copied === `o-${s.id}-${email}` ? "Copied ✓" : "Copy Outlook search"}</button>}
                        {showOutlook && <a className="btn ghost small" href={outlookOpenUrl(email)} target="_blank" rel="noopener noreferrer">Open Outlook ↗</a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <p className="tiny muted">No email? {source.download}</p>
          </li>
          {hints.length > 0 && (
            <li>
              <strong>The password is usually</strong>
              <ul className="pw-hints">{hints.map((h) => <li key={h}>{h}</li>)}</ul>
              <p className="tiny muted">Used once to open the file here, never stored.</p>
            </li>
          )}
          <li><strong>Drop it here</strong></li>
        </ol>
      )}
      <Importer sourceId={targetId} onImported={onImported} passwordHints={hints} prompt={`Drop the ${source?.name ?? ""} statement here`.replace("  ", " ")} />
      <div className="skip-row">
        {onUnskip ? <button className="btn ghost small" onClick={onUnskip}>Undo skip</button>
          : skipping ? (
            <div className="source-chips" role="group" aria-label="Why skip?">
              {(Object.keys(SKIP_REASONS) as SkipReason[]).map((r) => <button key={r} className="source-chip" onClick={() => onSkip(r)}>{SKIP_REASONS[r]}</button>)}
            </div>
          ) : <button className="btn ghost small" onClick={() => setSkipping(true)}>Skip this account</button>}
      </div>
    </div>
  );
}

/* ───────────── 5 · Plan ───────────── */

function PlanStep({ continueRef, flash }: StepProps & { flash: (t: string) => void }) {
  const { state, dispatch } = useSetup();
  const data = useData();
  const { limit } = useTier();
  const maxLines = limit("budgets.lines");
  const txns = data.user?.dataset.transactions ?? [];
  const accts = data.user?.dataset.accounts ?? [];
  const t = today();
  const month = t.slice(0, 7);
  const [preset, setPreset] = useState<Preset>("balanced");
  const base = suggestBudget(txns, t, { maxLines, preset: "comfortable" });
  const [lines, setLines] = useState(() => base.lines.map((l) => ({ category: l.category, limit: roundBudget(l.median || l.suggested, PRESET_FACTOR.balanced) })));
  const [goalState, setGoalState] = useState(() => state.goal ?? suggestGoal(goalFacts(txns, accts, t), t, new Date().toISOString()));
  const [saving, setSaving] = useState(false);
  const unused = VARIABLE_CATEGORIES.filter((c) => !lines.some((l) => l.category === c));
  const canAdd = maxLines === null || lines.length < maxLines;
  const total = lines.reduce((s, l) => s + l.limit, 0);

  function applyPreset(p: Preset) {
    setPreset(p);
    setLines(base.lines.map((l) => ({ category: l.category, limit: roundBudget(l.median || l.suggested, PRESET_FACTOR[p]) })));
  }
  const step = (v: number) => (v < 500000 ? 10000 : 50000);
  async function saveBudget() {
    setSaving(true);
    await data.saveBudgets(month, lines.filter((l) => l.limit > 0));
    dispatch({ type: "budgetSaved" });
    setSaving(false);
    flash(`Saved your ${formatMonth(month)} budget. It repeats each month until you change it.`);
  }
  async function next() {
    if (!state.budgetSaved && lines.length) await saveBudget();
    dispatch({ type: "complete", step: "plan" });
  }

  return (
    <>
      <h2 id="step-title">A plan that fits</h2>
      <p className="muted lead">
        {base.mode === "history"
          ? `Suggested from your spending in ${base.months.map((m) => formatMonth(m, true)).join(", ")}${base.confidence === "low" ? " (only a little history, so treat these as a starting point)" : ""}.`
          : "No complete month imported yet, so here's a simple starter budget. Adjust it to your life."}
      </p>

      <Glass className="card plan-card">
        <div className="card-head">
          <h3>Monthly budget · {formatMonth(month)}</h3>
          <div className="chips" role="group" aria-label="Budget style">
            {(["comfortable", "balanced", "ambitious"] as Preset[]).map((p) => (
              <button key={p} className={`chip ${preset === p ? "active" : ""}`} aria-pressed={preset === p} onClick={() => applyPreset(p)}>
                {titleCase(p)} · {PRESET_FACTOR[p]}%
              </button>
            ))}
          </div>
        </div>
        <ul className="budget-lines">
          {lines.map((l, i) => {
            const sug = base.lines.find((b) => b.category === l.category);
            return (
              <li key={l.category}>
                <span className="grow"><strong>{l.category === "emi" ? "EMI" : titleCase(l.category)}</strong>
                  {sug && sug.median > 0 && <small className="muted">Typical month {formatINR(sug.median)}</small>}</span>
                <div className="stepper" data-keys-off>
                  <button className="icon-btn" aria-label={`Lower ${l.category}`} onClick={() => setLines(lines.map((x, j) => (j === i ? { ...x, limit: Math.max(0, x.limit - step(x.limit - 1)) } : x)))}>−</button>
                  <output aria-live="polite">{formatINR(l.limit)}</output>
                  <button className="icon-btn" aria-label={`Raise ${l.category}`} onClick={() => setLines(lines.map((x, j) => (j === i ? { ...x, limit: x.limit + step(x.limit) } : x)))}>+</button>
                </div>
                <button className="icon-btn" aria-label={`Remove ${l.category}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button>
              </li>
            );
          })}
        </ul>
        <div className="card-head">
          {canAdd && unused.length > 0 ? (
            <select aria-label="Add a category" value="" onChange={(e) => { const c = e.target.value as Category; if (c) setLines([...lines, { category: c, limit: 200000 }]); }}>
              <option value="">+ Add a category</option>
              {unused.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </select>
          ) : <span className="tiny muted">{maxLines !== null ? `Up to ${maxLines} lines in one monthly budget.` : ""}</span>}
          <strong>Total {formatINR(total)}</strong>
        </div>
        <div className="row-actions">
          <button className="btn primary" onClick={() => void saveBudget()} disabled={saving || !lines.length}>{state.budgetSaved ? "Save changes" : "Save budget"}</button>
          {state.budgetSaved && <span className="tiny up"><Icon name="check" size={12} /> Saved</span>}
        </div>
      </Glass>

      <Glass className="card goal-card">
        <div className="card-head"><h3>A first goal</h3>{state.goal && <span className="badge">Created</span>}</div>
        <label className="field">Name<input type="text" value={goalState.name} maxLength={40} onChange={(e) => setGoalState({ ...goalState, name: e.target.value })} /></label>
        <p className="goal-maths">
          Target <strong>{formatINR(goalState.target)}</strong> · about <strong>{formatINR(goalState.monthly)}</strong> a month
          {goalState.due ? ` until ${goalState.due}` : " for a year"}.
        </p>
        <p className="tiny muted">{goalState.kind === "emergency3" ? "Three months of spending set aside makes surprises much less scary."
          : goalState.kind === "emergency6" ? "You're past three months of cover. Six is the next milestone."
            : goalState.kind === "annualPayment" ? "A yearly payment is coming up. Spreading it out keeps that month calm."
              : "Name anything you're saving for."}</p>
        <div className="row-actions">
          <button className="btn primary" onClick={() => { const g = { ...goalState, name: goalState.name.trim() || "My goal" }; void data.saveGoal(g); dispatch({ type: "goal", goal: g }); flash("Goal created 🎯"); }}>{state.goal ? "Update goal" : "Create goal"}</button>
          {!state.goal && <button className="btn ghost" onClick={() => dispatch({ type: "goal", goal: null })}>Not now</button>}
        </div>
      </Glass>
      <StepBar continueRef={continueRef} onContinue={() => void next()} continueLabel={state.budgetSaved ? "Continue" : "Save and continue"} canContinue={!saving} />
    </>
  );
}

/* ───────────── 6 · Done / health ───────────── */

const FRESH_LABEL: Record<Freshness, string> = { fresh: "Up to date", due: "New statement due", stale: "Out of date", todo: "Not imported" };

function DoneStep({ items }: StepProps & { items: ReturnType<typeof useSetup>["items"] }) {
  const { state, dispatch, progress, resume } = useSetup();
  const profile = useProfile();
  const { can } = useTier();
  const targets = importTargets(state).filter((t) => t.supported);
  const first = profile.name.split(" ")[0];
  const complete = !!state.completedAt;

  return (
    <>
      <div className="done-hero">
        <Ring pct={progress.percent} size={120} label />
        <div>
          <h2 id="step-title">{complete ? `Lakshly is up and running${first ? `, ${first}` : ""} 🪷` : progress.requiredDone ? "All the essentials are done" : "Nearly there"}</h2>
          <p className="muted">{progress.done} of {progress.total} done.{!progress.requiredDone ? " Finish the starred items to complete setup." : " Everything else is optional."}</p>
          <div className="row-actions">
            <Link className="btn primary" href="/">Go to Overview</Link>
            {resume !== "done" && <button className="btn ghost" onClick={() => dispatch({ type: "goTo", step: resume })}>Keep going</button>}
          </div>
        </div>
      </div>

      <Glass className="card">
        <h3>Checklist</h3>
        <ul className="checklist">
          {items.map((i) => (
            <li key={i.id} className={i.done ? "done" : ""}>
              <span className="check" aria-hidden="true">{i.done ? <Icon name="check" size={12} /> : null}</span>
              <span className="grow">{i.label}{i.required && <span className="req" title="Required to finish setup"> *</span>}</span>
              {!i.done && <button className="btn ghost small" onClick={() => dispatch({ type: "goTo", step: i.step })}>Go</button>}
            </li>
          ))}
        </ul>
        <p className="tiny muted">* Required to finish setup</p>
      </Glass>

      {can("setup.health") && targets.length > 0 && (
        <Glass className="card">
          <h3>Statement health</h3>
          <ul className="health">
            {targets.map((t) => {
              const f = t.source ? freshness(state.progress[t.id], t.source.cadence, today()) : state.progress[t.id]?.status === "imported" ? "fresh" : "todo";
              return (
                <li key={t.id}>
                  <span className="grow">{t.name}{state.progress[t.id]?.periodTo && <small className="muted"> · up to {state.progress[t.id]?.periodTo}</small>}</span>
                  <span className={`badge fresh-${f}`}>{state.progress[t.id]?.status === "skipped" ? "Skipped" : FRESH_LABEL[f]}</span>
                  {f !== "fresh" && state.progress[t.id]?.status !== "skipped" && <button className="btn ghost small" onClick={() => dispatch({ type: "goTo", step: "import" })}>Import</button>}
                </li>
              );
            })}
          </ul>
        </Glass>
      )}
    </>
  );
}
