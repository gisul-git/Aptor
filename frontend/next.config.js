/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Proxy API requests to backend server (exclude NextAuth routes)
  async rewrites() {
    // Try to get API Gateway URL from environment
    // Priority: API_GATEWAY_URL (server-side, runtime) > NEXT_PUBLIC_API_URL (build-time)
    const apiUrl = process.env.API_GATEWAY_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80';
    
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`, // API Gateway
        },
      {
        source: '/api/v2/:path*',
        destination: `${apiUrl}/api/v2/:path*`, // API Gateway
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
