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
  // Reduce client bundle size by stripping console.* in production.
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  // Smaller client bundles during analyze by avoiding source maps in prod.
  productionBrowserSourceMaps: false,
  // Enable optimized package imports for common libraries to reduce bundle size.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "react",
      "react-dom",
      "motion",
    ],
  },
  // Configure image domains for external images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;

