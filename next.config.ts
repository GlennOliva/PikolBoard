import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.4"],

  // Keep your other existing settings here.
  cacheComponents: true,
};

export default nextConfig;