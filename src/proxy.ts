import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Generate a cryptographically random 128-bit nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isProd = process.env.NODE_ENV === "production";

  // In production, drop 'unsafe-eval' and enforce nonce-based script loading
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'unsafe-inline' https://challenges.cloudflare.com`
    : `'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com`;

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

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("x-nonce", nonce);

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static, _next/image
     * - static files (images, audio, .cube)
     */
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|cube)).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
