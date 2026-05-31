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
};

export default nextConfig;
