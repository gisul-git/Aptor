/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Stub Node built-ins for browser bundles (e.g. face-api.js references 'fs' in unused Node code path)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
  // Proxy API requests to backend server (exclude NextAuth routes)
  async rewrites() {
    // Try to get API Gateway URL from environment
    // Priority: API_GATEWAY_URL (server-side, runtime) > NEXT_PUBLIC_API_URL (build-time)
    // Default: Use service name for Azure Container Apps, fallback to 127.0.0.1 (IPv4) for localhost
    const apiUrl = process.env.API_GATEWAY_URL || 
                   process.env.NEXT_PUBLIC_API_URL || 
                   (process.env.NODE_ENV === 'production' 
                     ? 'http://api-gateway:80'  // Azure Container Apps service name
                     : 'http://127.0.0.1:80');  // IPv4 localhost for local development
    
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`, 
        },
      {
        source: '/api/v2/:path*',
        destination: `${apiUrl}/api/v2/:path*`, 
      },
    ];
  },
  // Ensure static files in public/ are served with correct MIME types
  async headers() {
    return [
      {
        source: '/mediapipe/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
          // MIME types will be handled by Next.js automatically based on file extension
        ],
      },
    ];
  },
};

module.exports = nextConfig;
