/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

// Tidewell never loads third-party scripts: every external API call happens
// server-side in the sync job, so the browser only ever talks to 'self'.
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // OAuth "connect" buttons redirect the browser to Microsoft / Google / GitHub.
  "form-action 'self' https://login.microsoftonline.com https://accounts.google.com https://github.com",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  async headers() {
    if (!isProd) return [];
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
