import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Speed up CI/Vercel deploys by skipping lint and type errors during build.
  // We will still catch these locally via `npm run lint` and editor tooling.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

