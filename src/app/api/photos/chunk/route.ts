import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Proxy fallback endpoint for 2 MiB chunks when client-to-Google direct CORS is blocked.
 * Accepts sessionUri via header/query and proxies PUT request with exact Content-Range.
 */
export async function PUT(req: Request) {
  try {
    const sessionUri = req.headers.get("x-session-uri");
    const contentRange = req.headers.get("content-range");
    const contentType = req.headers.get("content-type") || "image/jpeg";

    if (!sessionUri || !contentRange) {
      return NextResponse.json({ error: "Missing x-session-uri or content-range header" }, { status: 400 });
    }

    // SSRF Guard: Strictly restrict sessionUri to official Google APIs upload domain
    try {
      const parsedUrl = new URL(sessionUri);
      if (
        parsedUrl.protocol !== "https:" ||
        parsedUrl.hostname !== "www.googleapis.com" ||
        !parsedUrl.pathname.startsWith("/upload/drive/v3/files")
      ) {
        return NextResponse.json({ error: "Invalid upload destination URI" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Malformed session URI" }, { status: 400 });
    }

    const chunkBuffer = await req.arrayBuffer();

    const driveRes = await fetch(sessionUri, {
      method: "PUT",
      headers: {
        "Content-Range": contentRange,
        "Content-Type": contentType,
        "Content-Length": String(chunkBuffer.byteLength),
      },
      body: chunkBuffer,
    });

    const responseStatus = driveRes.status;
    const responseHeaders = new Headers();
    const rangeHeader = driveRes.headers.get("range");
    if (rangeHeader) responseHeaders.set("range", rangeHeader);

    const bodyText = await driveRes.text();
    return new NextResponse(bodyText, {
      status: responseStatus,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Chunk proxy error:", err);
    return NextResponse.json({ error: "Proxy chunk upload failed" }, { status: 502 });
  }
}
