import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy: the page may only load code, styles, fonts and data from
// this server. 'unsafe-inline' scripts are needed for Next.js bootstrapping and the
// theme script that runs before first paint; 'unsafe-eval' only in development (hot reload).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },                      // no clickjacking via iframes
  { key: "X-Content-Type-Options", value: "nosniff" },            // no MIME-type guessing
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // HSTS only matters over HTTPS; browsers ignore it on plain http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,               // don't advertise the framework
  // Native DuckDB bindings must be loaded by Node at runtime, not bundled.
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API responses are never cached by browsers or proxies.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
