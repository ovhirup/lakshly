const P: Record<string, string> = {
  overview: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  spend: "M21 7H3V5h18v2zm0 4H3v8h18v-8zm-4 5h-3v-2h3v2z",
  budget: "M12 2a10 10 0 1 0 10 10h-10V2zm2 0v8h8a10 10 0 0 0-8-8z",
  debt: "M4 20h16v-2H4v2zm2-4h3V9H6v7zm5 0h3V9h-3v7zm5 0h3V9h-3v7zM12 2 2 7h20L12 2z",
  credit: "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm-1 4h20v3H2V9z",
  invest: "M3 17l6-6 4 4 8-8v4h2V3h-8v2h4l-6 6-4-4-8 8z",
  rewards: "M12 2l3 6 6 .9-4.5 4.3 1 6.3L12 16.6 6.5 19.5l1-6.3L3 8.9 9 8z",
  history: "M13 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-2.05-4.95L15 10h7V3l-2.64 2.64A8.96 8.96 0 0 0 13 3zm-1 5v5l4 2 .8-1.6-2.8-1.4V8h-2z",
  feedback: "M4 4h16v12H7l-3 3V4zm4 5v2h8V9H8z",
  lock: "M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h1zm2 0h6V7a3 3 0 0 0-6 0v3z",
  sun: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5h0v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M4.9 19.1 7 17m10-10 2.1-2.1",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  sparkle: "M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z",
  import: "M12 3v10.2l3.6-3.6L17 11l-5 5-5-5 1.4-1.4 3.6 3.6V3h2zM5 18h14v2H5v-2z",
  shield: "M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5l8-3zm-1.2 13.6 5.7-5.7-1.4-1.4-4.3 4.3-2.1-2.1-1.4 1.4 3.5 3.5z",
  heart: "M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z",
};

export function Icon({ name, size = 20, stroke = false }: { name: keyof typeof P | string; size?: number; stroke?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"
      fill={stroke ? "none" : "currentColor"} stroke={stroke ? "currentColor" : "none"} strokeWidth={2} strokeLinecap="round">
      <path d={P[name] ?? P.sparkle} />
    </svg>
  );
}
