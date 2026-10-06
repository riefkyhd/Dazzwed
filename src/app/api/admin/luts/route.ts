import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/supabase/auth";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/luts
 * Lists all available .cube LUT files in public/luts
 */
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
        name: fileName.replace(/\.cube$/, "").replace(/[-_]/g, " "),
      }));

    return NextResponse.json({ luts: cubeFiles });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

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

    // Sanitize filename: alphanumeric, dashes, dots, underscores
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, "-");
    const lutsDir = path.join(process.cwd(), "public", "luts");
    await fs.mkdir(lutsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    const filePath = path.join(lutsDir, safeName);
    await fs.writeFile(filePath, buffer);

    return NextResponse.json({
      ok: true,
      fileName: safeName,
      url: `/luts/${safeName}`,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
