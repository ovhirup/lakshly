import type { Metadata, Viewport } from "next";
import { AppStateProvider } from "@/components/AppState";
import { Shell } from "@/components/Shell";
import { DataProvider } from "@/components/DataState";
import { SetupProvider } from "@/components/SetupState";
import { themeBootScript } from "@/lib/themes";
import "./themes.gen.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Lakshly: Every rupee on target.", template: "%s · Lakshly" },
  description: "Private-by-design personal finance. Local-first, synthetic demo data only.",
  applicationName: "Lakshly",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#FBF8F1",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <AppStateProvider>
          <DataProvider>
            <SetupProvider>
              <Shell>{children}</Shell>
            </SetupProvider>
          </DataProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
