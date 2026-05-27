import type { NextConfig } from "next";

const FLASK = process.env.FLASK_INTERNAL_URL ?? "http://127.0.0.1:5001";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/app",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Proxy the full Flask app page
      {
        source: "/proxy-app",
        destination: `${FLASK}/app`,
      },
      // Proxy all API calls
      {
        source: "/api/:path*",
        destination: `${FLASK}/api/:path*`,
      },
      // Proxy Flask static assets (css/js already versioned)
      {
        source: "/static/:path*",
        destination: `${FLASK}/static/:path*`,
      },
    ];
  },
};

export default nextConfig;
