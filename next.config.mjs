// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Allow any Supabase project storage bucket
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: { turbo: { rules: {} } },
};

export default nextConfig;
