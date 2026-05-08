import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Allow ioredis/bullmq to run in Node.js API routes (not Edge runtime)
  serverExternalPackages: ["ioredis", "bullmq"],
};

export default nextConfig;
