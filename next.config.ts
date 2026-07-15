import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@prisma/adapter-pg"],
  allowedDevOrigins: [
    "172.25.192.196",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
