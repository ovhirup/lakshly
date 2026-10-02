import type { Metadata, Viewport } from "next";
import { AppStateProvider, themeScript } from "@/components/AppState";
import { Shell } from "@/components/Shell";
import { DataProvider } from "@/components/DataState";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lakshly: Every rupee on target.", template: "%s · Lakshly" },
  description: "Private-by-design personal finance. Local-first, synthetic demo data only.",
  applicationName: "Lakshly",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBF8F1" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1430" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppStateProvider>
          <DataProvider>
            <Shell>{children}</Shell>
          </DataProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
