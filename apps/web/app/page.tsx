// Lakshly web: placeholder landing (Phase 0). SPDX-License-Identifier: AGPL-3.0-or-later
export default function Page() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center",
      background: "linear-gradient(135deg,#fbcfe8,#fed7aa,#fef08a)" }}>
      <section style={{ padding: 32, borderRadius: 28, backdropFilter: "blur(24px) saturate(160%)",
        background: "rgba(255,255,255,0.35)", border: "1px solid rgba(255,255,255,0.5)", textAlign: "center" }}>
        <h1>Lakshly</h1>
        <p>Every rupee on target.</p>
        <small>Demo data only</small>
      </section>
    </main>
  );
}
