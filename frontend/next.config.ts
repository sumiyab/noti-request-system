import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export: plain files in out/, no server at runtime. The app talks to API Gateway directly.
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
  env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '' },
};

export default nextConfig;
