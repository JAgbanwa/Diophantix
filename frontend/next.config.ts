import type { NextConfig } from "next";

const FLASK = process.env.FLASK_INTERNAL_URL ?? "http://127.0.0.1:5001";

const noStoreHeaders = [
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const proofLabSecurityHeaders = [
  { key: "Content-Security-Policy", value: `default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self' data: https://cdn.jsdelivr.net; form-action 'self'; frame-ancestors 'none'; img-src 'self' data: blob:; object-src 'none'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; upgrade-insecure-requests` },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/app", headers: noStoreHeaders },
      { source: "/prooflab", headers: [...noStoreHeaders, ...proofLabSecurityHeaders] },
      { source: "/api/prooflab", headers: noStoreHeaders },
    ];
  },
  async rewrites() {
    return {
      afterFiles: [
        { source: "/proxy-app", destination: `${FLASK}/app` },
      ],
      // Fallback rewrites run only after Next.js pages, route handlers, and
      // public assets. This keeps /api/prooflab native while preserving Flask.
      fallback: [
        { source: "/api/:path*", destination: `${FLASK}/api/:path*` },
        { source: "/static/:path*", destination: `${FLASK}/static/:path*` },
      ],
    };
  },
};

export default nextConfig;
