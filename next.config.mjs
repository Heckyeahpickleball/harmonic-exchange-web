/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'czgcbiysnpdeewqdyvdp.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: { turbo: { rules: {} } },
};
export default nextConfig;
