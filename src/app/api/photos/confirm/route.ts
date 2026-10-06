import { NextResponse } from "next/server";
import { z } from "zod";
import { getDriveClient, resolveDriveTokens } from "@/lib/drive/client";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      shotId?: string;
      driveFileId?: string;
      sizeBytes?: number;
      isOriginal?: boolean;
    } | null;

    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { shotId, driveFileId, sizeBytes, isOriginal = false } = body;
    const shotIdParsed = z.uuid().safeParse(shotId);
    const driveFileIdParsed = z.string().min(5).safeParse(driveFileId);

    if (!shotIdParsed.success || !driveFileIdParsed.success) {
      return NextResponse.json({ error: "Invalid shotId or driveFileId" }, { status: 400 });
    }

    const sb = supabaseAdmin();

    // Verify file exists in Google Drive
    const { refreshToken } = await resolveDriveTokens();
    const drive = getDriveClient(refreshToken || undefined);

    const fileMeta = await drive.files.get({
      fileId: driveFileIdParsed.data,
      fields: "id, name, size, trashed",
    });

    if (!fileMeta.data.id || fileMeta.data.trashed) {
      return NextResponse.json({ error: "Drive file not found or trashed" }, { status: 404 });
    }

    const actualSize = fileMeta.data.size ? parseInt(fileMeta.data.size, 10) : sizeBytes || 0;

    if (isOriginal) {
      // Update original_drive_file_id on the existing photo
      const { error: updateErr } = await sb
        .from("photos")
        .update({
          original_drive_file_id: fileMeta.data.id,
          updated_at: new Date().toISOString(),
        })
        .eq("shot_id", shotIdParsed.data);

      if (updateErr) {
        return NextResponse.json({ error: "Failed to link original photo in DB" }, { status: 500 });
      }
    } else {
      // Mark primary filtered photo confirmed in database
      const { error: updateErr } = await sb
        .from("photos")
        .update({
          status: "confirmed",
          drive_file_id: fileMeta.data.id,
          size_bytes: actualSize,
          updated_at: new Date().toISOString(),
        })
        .eq("shot_id", shotIdParsed.data);

      if (updateErr) {
        return NextResponse.json({ error: "Failed to confirm photo in DB" }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      status: "confirmed",
      driveFileId: fileMeta.data.id,
      sizeBytes: actualSize,
    });
  } catch (err) {
    console.error("Error in /api/photos/confirm:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
