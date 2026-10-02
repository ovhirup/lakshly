import type { NextConfig } from "next";
import { resolve } from "node:path";

// Static export: a fully client-side, local-first PWA. No server, no API routes.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  // Repo root, so the shared packages/parsers source can be compiled into the app.
  turbopack: { root: resolve(import.meta.dirname, "../..") },
  outputFileTracingRoot: resolve(import.meta.dirname, "../.."),
};

export default nextConfig;
