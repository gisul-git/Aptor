/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // Stub Node built-ins for browser bundles (e.g. face-api.js references 'fs' in unused Node code path)
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    
    // Exclude face-api and agora-rtc-sdk-ng from SSR to avoid Node.js dependencies
    if (isServer) {
      config.externals = config.externals || [];
      // Use a function to properly externalize these modules
      const originalExternals = config.externals;
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : [originalExternals]),
        ({ request }, callback) => {
          if (request === '@vladmandic/face-api' || request === 'agora-rtc-sdk-ng') {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    
    return config;
  },
  // Proxy API requests to backend server (exclude NextAuth routes)
  async rewrites() {
    // Try to get API Gateway URL from environment
    // Priority: API_GATEWAY_URL (server-side, runtime) > NEXT_PUBLIC_API_URL (build-time)
    // Default: Use service name for Azure Container Apps, fallback to localhost:80 for local development
    // NOTE: API Gateway runs on port 80, NOT port 3000 (Next.js runs on 3000, Gateway on 80)
    const apiUrl = process.env.API_GATEWAY_URL || 
                   process.env.NEXT_PUBLIC_API_URL || 
                   (process.env.NODE_ENV === 'production' 
                     ? 'http://api-gateway:80'  // Azure Container Apps service name
                     : 'http://localhost:80');  // API Gateway on port 80 for local development
    
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
