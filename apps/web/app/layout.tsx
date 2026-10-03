import type { Metadata, Viewport } from "next";
import { AppStateProvider } from "@/components/AppState";
import { Shell } from "@/components/Shell";
import { DataProvider } from "@/components/DataState";
import { SetupProvider } from "@/components/SetupState";
import { themeBootScript } from "@/lib/themes";
import { privacyBootScript } from "@/lib/privacy";
import { PrivacyProvider } from "@/components/Privacy";
import { GameProvider } from "@/components/Game";
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
        <script dangerouslySetInnerHTML={{ __html: privacyBootScript }} />
      </head>
      <body>
        <AppStateProvider>
          <PrivacyProvider>
            <DataProvider>
              <SetupProvider>
                <GameProvider><Shell>{children}</Shell></GameProvider>
              </SetupProvider>
            </DataProvider>
          </PrivacyProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
