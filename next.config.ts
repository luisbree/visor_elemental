
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Allow cross-origin requests from Firebase Studio development environment
  experimental: {
    allowedDevOrigins: [
      'https://*.cluster-ve345ymguzcd6qqzuko2qbxtfe.cloudworkstations.dev',
      'https://*.cloudworkstations.dev' // Keep the broader one as a fallback
    ],
  },
};

export default nextConfig;
