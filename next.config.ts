import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Accept HMR / origin requests from any host (dev only).
  // Next uses micromatch where `*` doesn't cross dots, so an IPv4
  // address needs `*.*.*.*`. `**` covers everything else (hostnames,
  // *.local, etc.).
  allowedDevOrigins: ["**", "*", "*.*.*.*"],
};

export default nextConfig;
