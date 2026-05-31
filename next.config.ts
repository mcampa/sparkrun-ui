import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow LAN clients to reach the dev server without HMR / origin
  // warnings. Add any other LAN hosts you serve from here.
  allowedDevOrigins: [
    "192.168.0.40",
    "192.168.0.96",
    "*.local",
  ],
};

export default nextConfig;
