import type { NextConfig } from "next";
import dns from "dns";
import os from "os";

dns.setDefaultResultOrder("ipv4first");

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // Allow ioredis/bullmq to run in Node.js API routes (not Edge runtime)
  serverExternalPackages: ["ioredis", "bullmq"],
  typescript: {
    ignoreBuildErrors: true,
  },
  allowedDevOrigins: ["localhost", "127.0.0.1", ...getLocalIpAddresses()],
};

export default nextConfig;
