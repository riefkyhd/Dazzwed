import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/supabase/auth";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/luts
 * Lists all available .cube LUT files in public/luts
 */
const LUT_FRIENDLY_NAMES: Record<string, string> = {
  "warm-portrait-400.cube": "Warm Portrait 400 (Pastel Warmth & Flattering Skin)",
  "tungsten-800t.cube": "Tungsten 800T (Night Tungsten & Red Halation Glow)",
  "cinema-250d.cube": "Cinema 250D (Soft Cinema Tone & Muted Highlights)",
  "mono-street-400.cube": "Mono Street 400 (High-Contrast Monochrome B&W)",
  "super-8mm-vintage.cube": "Super 8mm Vintage (Retro 1970s Home Movie)",
  "vivid-100.cube": "Vivid 100 (Vivid Landscape & Ultra-Fine Grain)",
  "rangefinder-35.cube": "Rangefinder 35 (Classic 35mm Rangefinder Warmth)",
  "classic-neg-400.cube": "Classic Neg 400 (Deep Teal Foliage & Crimson)",
  "golden-200.cube": "Golden 200 (Warm Sunny Wedding Nostalgia)",
};

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lutsDir = path.join(process.cwd(), "public", "luts");
  try {
    await fs.mkdir(lutsDir, { recursive: true });
    const files = await fs.readdir(lutsDir);
    const cubeFiles = files
      .filter((f) => f.endsWith(".cube"))
      .map((fileName) => ({
        fileName,
        url: `/luts/${fileName}`,
        name: LUT_FRIENDLY_NAMES[fileName] || fileName.replace(/\.cube$/, "").replace(/[-_]/g, " "),
      }));

    return NextResponse.json({ luts: cubeFiles });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

const MAX_LUT_SIZE = 2 * 1024 * 1024; // 2 MB
const PROTECTED_STOCK_PRESETS = new Set(Object.keys(LUT_FRIENDLY_NAMES));

/**
 * POST /api/admin/luts
 * Accepts a multipart/form-data upload of a .cube file and saves it to public/luts
 */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".cube")) {
      return NextResponse.json({ error: "Only .cube LUT files are accepted" }, { status: 400 });
    }

    // 1. Enforce strict 2 MB payload size limit before processing
    if (file.size > MAX_LUT_SIZE) {
      return NextResponse.json({ error: "File exceeds 2 MB limit" }, { status: 413 });
    }

    // Sanitize filename: alphanumeric, dashes, dots, underscores
    const rawSafeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");

    // 2. Prevent overwriting built-in stock system presets
    if (PROTECTED_STOCK_PRESETS.has(rawSafeName)) {
      return NextResponse.json({ error: "Cannot overwrite system stock LUT preset" }, { status: 403 });
    }

    // 3. Namespace tenant custom uploads
    const { getAuthSession } = await import("@/lib/auth/session");
    const session = await getAuthSession();

    let finalFileName = rawSafeName;
    if (session && session.role === "client") {
      const clientPrefix = `client-${session.clientId.slice(0, 8)}-`;
      if (!rawSafeName.startsWith(clientPrefix)) {
        finalFileName = `${clientPrefix}${rawSafeName}`;
      }
    }

    // 4. Content validation: ensure valid text, no null bytes, and valid LUT headers
    const text = await file.text();
    if (text.includes("\0")) {
      return NextResponse.json({ error: "Invalid LUT file: binary content detected" }, { status: 400 });
    }

    const upperText = text.toUpperCase();
    if (!upperText.includes("LUT_3D_SIZE") && !upperText.includes("LUT_1D_SIZE")) {
      return NextResponse.json({ error: "Invalid LUT file: missing LUT_3D_SIZE or LUT_1D_SIZE declaration" }, { status: 400 });
    }

    const lutsDir = path.join(process.cwd(), "public", "luts");
    await fs.mkdir(lutsDir, { recursive: true });

    const buffer = Buffer.from(text, "utf8");
    const filePath = path.join(lutsDir, finalFileName);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      ok: true,
      fileName: finalFileName,
      url: `/luts/${finalFileName}`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
