import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle so the Docker runtime image only
  // needs node + .next/standalone, not the full node_modules.
  output: "standalone",
  // Accept HMR / origin requests from any host (dev only).
  // Next uses micromatch where `*` doesn't cross dots, so an IPv4
  // address needs `*.*.*.*`. `**` covers everything else (hostnames,
  // *.local, etc.).
  allowedDevOrigins: ["**", "*", "*.*.*.*"],
  // The UI uses next/image once, with an SVG. Disabling the optimizer
  // skips bundling `sharp`, which has platform-specific native binaries
  // — important so the npm package works cross-platform via npx.
  images: { unoptimized: true },
  // Belt-and-braces: keep sharp and its libvips natives out of the
  // standalone trace so the published bundle stays portable.
  outputFileTracingExcludes: {
    "*": ["**/node_modules/sharp/**", "**/node_modules/@img/**"],
  },
};

export default nextConfig;
