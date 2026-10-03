"use client";
import { useRef, useState } from "react";
import { catalog, gmailQuery, gmailUrl, outlookQuery, outlookOpenUrl, plainSearch, sourceFor, type Source, type Search, type SetupSource, type SetupState } from "@lakshly/shared";
import { useData } from "./DataState";
import { can } from "@/lib/entitlements";
import { useAppState } from "./AppState";
export function SetupSearch({ source, state, notify }: { source: Source; state: SetupState; notify: (message: string) => void }) {
  const [fallback, setFallback] = useState<string | null>(null);
  const copyField = useRef<HTMLInputElement>(null);
  const d = useData();
  const { plan } = useAppState();
  const addresses = [state.email.primary, ...(state.email.extra ?? [])].filter(Boolean);
  if (!addresses.length) addresses.push("");
  async function copy(query: string, outlook = false) {
    try { await navigator.clipboard.writeText(query); notify(outlook ? "Search copied. Paste it into Outlook's search bar." : "Search copied."); }
    catch { setFallback(query); notify("Select the search below and copy it with your keyboard."); }
  }
  function searched() {
    if (state.sources.some(s => s.catalogId === source.id)) void d.dispatchSetup({ type: "searchTapped", catalogId: source.id }).catch(() => notify("Couldn't save the search status."));
  }
  if (!can("setup.emailGuide", plan)) return null;
  return <div className="setup-stack setup-search">
    {source.searches.map((search: Search) => <div key={search.id} className="setup-stack">
      <strong>{search.label}</strong>
      {addresses.map(email => <div className="setup-stack" key={email}>
        {addresses.length > 1 && <span className="tiny muted">{email}</span>}
        <div className="row-actions">
          <a className="btn ghost" href={gmailUrl(email, gmailQuery(source, search))} target="_blank" rel="noopener noreferrer" aria-label={`Search Gmail for ${source.name} ${search.label.toLowerCase()}, opens your browser`} onClick={searched}>Search Gmail</a>
          <a className="btn ghost" href={outlookOpenUrl(email)} target="_blank" rel="noopener noreferrer" aria-label={`Copy search for ${source.name} ${search.label.toLowerCase()} and open Outlook inbox`} onClick={() => { void copy(outlookQuery(source, search), true); searched(); }}>Search Outlook</a>
          <button className="btn ghost" aria-label={`Copy search for ${source.name} ${search.label.toLowerCase()}`} onClick={() => void copy(state.email.provider === "gmail" ? gmailQuery(source, search) : state.email.provider === "outlook" ? outlookQuery(source, search) : plainSearch(source, search))}>Copy search</button>
        </div>
      </div>)}
      <details><summary>Exact search</summary><code>{state.email.provider === "outlook" ? outlookQuery(source, search) : state.email.provider === "other" ? plainSearch(source, search) : gmailQuery(source, search)}</code></details>
    </div>)}
    {fallback !== null && <label className="field">Copy this search<input ref={copyField} readOnly value={fallback} onFocus={e => e.currentTarget.select()} /><button className="btn ghost" onClick={() => { copyField.current?.focus(); copyField.current?.select(); }}>Select search</button></label>}
  </div>;
}
export function SourceGuide({ picked, state, notify }: { picked: SetupSource; state: SetupState; notify: (message: string) => void }) {
  const source = sourceFor(picked);
  const hints = source.passwordHints.map(key => catalog.passwordHintFormats[key as keyof typeof catalog.passwordHintFormats]);
  return <div className="setup-stack setup-guide">
    <SetupSearch source={source} state={state} notify={notify} />
    {source.download && <p>{source.download}</p>}
    {source.importer.note && <p className="muted">{source.importer.note}</p>}
    {source.kinds.includes("subscription") && <p className="muted">Your charges already come in through your bank/card statement. Receipt import is coming.</p>}
    {hints.length > 0 && <div className="setup-hint"><p>Statements from {source.name} are usually protected with one of:</p><ul>{hints.map(hint => <li key={hint}>{hint}</li>)}</ul><p>The email that carried the statement says which. Lakshly asks for it once, on this device, and never saves it.</p></div>}
    <details><summary>Export guides</summary><div className="setup-stack">
      <p className="muted">Download the PDF attachment for this build. Email files (.eml and .mbox) are not supported yet.</p>
      {(["gmail", "outlook", "appleMail"] as const).map(provider => <div key={provider}><h3>{provider === "appleMail" ? "Apple Mail" : provider === "gmail" ? "Gmail" : "Outlook"}</h3>{Object.values(catalog.guides[provider]).map(text => <p key={text}>{text}</p>)}</div>)}
    </div></details>
  </div>;
}
