/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Put Turbopack config at the TOP LEVEL, not under `experimental`
  turbopack: {
    // Point to this project so the right package-lock is used
    root: __dirname,
  },
};

export default nextConfig;
