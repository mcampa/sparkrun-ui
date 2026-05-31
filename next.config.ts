import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Accept HMR / origin requests from any host (dev only)
  allowedDevOrigins: ["*"],
};

export default nextConfig;
