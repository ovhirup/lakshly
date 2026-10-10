"use client";
// Offer to merge two saved accounts that look like the same one (e.g. a CSV and a PDF of one bank account).
import { useState } from "react";
import { useData } from "@/components/DataState";
import { Glass } from "@/components/ui";

export function MergeOffers({ onMerged }: { onMerged?: (text: string) => void }) {
  const { mergeOffers, mergeAccounts, dismissMergeOffer, source } = useData();
  const [busy, setBusy] = useState<string | null>(null);
  if (source !== "mine" || !mergeOffers.length) return null;
  return (
    <Glass className="card merge-offers" as="div" data-testid="merge-offers">
      <h3>Same account twice?</h3>
      <ul className="merge-list">
        {mergeOffers.map((o) => {
          const k = `${o.dropId}>${o.keepId}`;
          return (
            <li key={k}>
              <p className="tiny"><b>{o.dropName}</b> and <b>{o.keepName}</b> look like the same account{o.overlap ? ` (${o.overlap} matching transactions)` : ""}. Merging keeps one account and removes the doubled transactions.</p>
              <div className="row-actions">
                <button className="btn primary small" disabled={!!busy} onClick={() => { setBusy(k); void mergeAccounts(o.dropId, o.keepId).then((n) => { setBusy(null); onMerged?.(`Merged into ${o.keepName}${n ? `, removed ${n} duplicate transaction${n === 1 ? "" : "s"}` : ""}.`); }); }} data-testid="merge-accept">{busy === k ? "Merging…" : "Merge accounts"}</button>
                <button className="btn ghost small" disabled={!!busy} onClick={() => dismissMergeOffer(o.dropId, o.keepId)}>Keep separate</button>
              </div>
            </li>
          );
        })}
      </ul>
    </Glass>
  );
}
