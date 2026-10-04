import type { Metadata } from "next";

export const metadata: Metadata = { title: "Island motions" };

export default function IslandLayout({ children }: { children: React.ReactNode }) {
  return children;
}
