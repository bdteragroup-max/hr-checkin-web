import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    serverActions: {
      bodySizeLimit: '15mb',
    },
  },
  serverExternalPackages: ['@prisma/client', 'prisma', '@sparticuz/chromium'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uvbnlqwcdzlygykbhwhv.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: '*.blob.core.windows.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'hmsstorage001.blob.core.windows.net',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.humansoft.co.th',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
