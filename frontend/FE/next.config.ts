import type { NextConfig } from "next";
import dns from "dns";

dns.setDefaultResultOrder("ipv4first");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Allow ioredis/bullmq to run in Node.js API routes (not Edge runtime)
  serverExternalPackages: ["ioredis", "bullmq"],
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
