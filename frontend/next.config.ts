import type { NextConfig } from "next";

const FLASK = process.env.FLASK_INTERNAL_URL ?? "http://127.0.0.1:5001";

const noStoreHeaders = [
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/app", headers: noStoreHeaders },
      { source: "/prooflab", headers: noStoreHeaders },
      { source: "/api/prooflab", headers: noStoreHeaders },
    ];
  },
  async rewrites() {
    return [
      // Proxy the full Flask app page
      {
        source: "/proxy-app",
        destination: `${FLASK}/app`,
      },
      // Native Next.js route handlers (including /api/prooflab) take priority.
      // All remaining API calls are proxied to the existing Flask backend.
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
