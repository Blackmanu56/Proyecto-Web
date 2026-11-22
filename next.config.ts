import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-aa3a753d242c4c41a86a0dfb2dc02a28.r2.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
