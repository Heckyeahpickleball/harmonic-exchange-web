// next.config.mjs

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // Supabase: modern path
      {
        protocol: 'https',
        hostname: 'czgcbiysnpdeewqdyvdp.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Supabase: legacy/alternate path
      {
        protocol: 'https',
        hostname: 'czgcbiysnpdeewqdyvdp.supabase.co',
        pathname: '/object/public/**',
      },
      // Common external avatar hosts
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'platform-lookaside.fbsbx.com', pathname: '/**' },
      { protocol: 'https', hostname: 'pbs.twimg.com', pathname: '/**' },
      { protocol: 'https', hostname: 's.gravatar.com', pathname: '/**' },
    ],
  },

  // Silence deprecation warnings + keep CI smooth on Vercel
  turbopack: {},
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
