import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const scriptSrc = isProd
  ? "'self' 'unsafe-inline' https://challenges.cloudflare.com"
  : "'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com";

const cspHeader = `
  default-src 'self';
  script-src ${scriptSrc};
  worker-src 'self' blob:;
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https://*.googleusercontent.com https://challenges.cloudflare.com;
  media-src 'self' blob:;
  connect-src 'self' blob: https://*.supabase.co https://www.googleapis.com https://challenges.cloudflare.com;
  font-src 'self' data:;
  frame-src https://challenges.cloudflare.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`
  .replace(/\s{2,}/g, " ")
  .trim();

const nextConfig: NextConfig = {
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader,
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), browsing-topics=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/admin/guests",
        destination: "/admin/photos",
      },
      {
        source: "/admin/looks",
        destination: "/admin/look-lab",
      },
    ];
  },
};

export default nextConfig;
