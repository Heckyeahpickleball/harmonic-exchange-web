/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // silence the “multiple lockfiles” warning locally
    turbopack: {
      root: __dirname,
    },
  },
  // (optional) tighten headers or images domains later
};

export default nextConfig;
