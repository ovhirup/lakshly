"use client";
import { useEffect, useRef } from "react";
import { catalog, sourceFor, type SetupState } from "@lakshly/shared";
import { FEEDBACK_EMAIL } from "@/lib/feedback-transport";
export function SetupConsent({ state, agree, close }: { state: SetupState; agree: () => void; close: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const list = state.sources.length ? state.sources.map(sourceFor) : catalog.sources;
  const senders = [...new Set(list.flatMap(source => [...source.senders.addresses, ...source.senders.domains]))];
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
      if (event.key !== "Tab") return;
      const nodes = [...(dialog.current?.querySelectorAll<HTMLElement>('button, a, summary, [tabindex="0"]') ?? [])];
      const first = nodes[0], last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("keydown", onKey, true); previous?.focus(); };
  }, [close]);
  return <div className="setup-scrim"><div ref={dialog} className="glass setup-consent setup-stack" role="dialog" aria-modal="true" aria-labelledby="setup-consent-title">
    <h2 id="setup-consent-title">Connect your money email (read-only)</h2>
    <p>Lakshly will search this mailbox only for emails from the financial senders listed below (banks, cards, investment and insurance companies, and subscriptions you picked).</p>
    <p><strong>What is read:</strong> matching emails and their PDF statements. <strong>Never read:</strong> any other email.</p>
    <p><strong>Why:</strong> to create your transactions, statements and holdings in Lakshly.</p>
    <p><strong>Where it goes:</strong> it stays on this device, encrypted. Lakshly&apos;s servers never receive your emails, passwords or sign-in tokens.</p>
    <p><strong>Kept for:</strong> a log of emails read, 90 days. Parsed data stays until you delete it.</p>
    <p><strong>Your choices:</strong> see every email read in the Read log. Disconnect anytime (Settings ▸ Setup &amp; data sources ▸ Disconnect), which is as easy as connecting. Delete all data anytime.</p>
    <p><strong>Questions or complaints:</strong> <a href={`mailto:${FEEDBACK_EMAIL}`}>{FEEDBACK_EMAIL}</a>; you can also approach the Data Protection Board of India.</p>
    <details><summary>Only these finance senders ({senders.length})</summary><ul className="setup-senders">{senders.map(sender => <li key={sender}>{sender}</li>)}</ul></details>
    <div className="row-actions"><button className="btn primary" onClick={agree}>Agree and connect</button><button className="btn ghost" onClick={close}>Not now</button></div>
  </div></div>;
}
