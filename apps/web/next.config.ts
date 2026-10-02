import type { NextConfig } from "next";

// Static export: a fully client-side, local-first PWA. No server, no API routes.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  poweredByHeader: false,
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
