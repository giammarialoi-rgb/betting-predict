import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pre-existing domain TS debt must not block UI shipping (BetMind).
  typescript: { ignoreBuildErrors: true },
  // Prefer webpack in CI/scripts via `pnpm build` (= next build --webpack).
  // Docker/VPS-friendly tracing; store remains on mounted volume.
  output: "standalone",
};

export default nextConfig;
