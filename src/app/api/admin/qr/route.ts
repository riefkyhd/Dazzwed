import { NextResponse } from "next/server";
import { generateQrSvg } from "@/lib/qr";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || "our-wedding";
  const format = searchParams.get("format") || "png"; // png | svg

  // Determine origin
  const origin = searchParams.get("origin") || new URL(req.url).origin;
  const guestUrl = `${origin}/e/${slug}`;

  if (format === "svg") {
    const svg = await generateQrSvg(guestUrl);
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `attachment; filename="qr-${slug}.svg"`,
      },
    });
  }

  // PNG binary buffer
  const buffer = await QRCode.toBuffer(guestUrl, {
    width: 1024,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="qr-${slug}.png"`,
    },
  });
}
