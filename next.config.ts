import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
  serverExternalPackages: ['@prisma/client', 'prisma'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uvbnlqwcdzlygykbhwhv.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
