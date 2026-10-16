import { NextResponse } from "next/server";
import { Readable } from "node:stream";
import { getAdminUser } from "@/lib/supabase/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getDriveClient, getOAuth2Client, resolveDriveTokens } from "@/lib/drive/client";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate admin
    const admin = await getAdminUser();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Missing photo identifier" }, { status: 400 });
    }

    const url = new URL(req.url);
    const size = url.searchParams.get("size") || "grid"; // 'grid' | 'lightbox' | 'original'
    const type = url.searchParams.get("type") || "filtered"; // 'filtered' | 'original'
    const isDownload = url.searchParams.get("download") === "1" || url.searchParams.get("download") === "true";

    // 2. Resolve target Google Drive fileId
    let targetDriveFileId: string | null = null;
    let filename = `photo-${id}.jpg`;

    if (UUID_REGEX.test(id)) {
      const sb = supabaseAdmin();
      const { data: photo } = await sb
        .from("photos")
        .select("id, shot_id, drive_file_id, original_drive_file_id, status")
        .or(`id.eq.${id},shot_id.eq.${id}`)
        .maybeSingle();

      if (!photo) {
        return NextResponse.json({ error: "Photo not found" }, { status: 404 });
      }

      if (type === "original") {
        targetDriveFileId = photo.original_drive_file_id || photo.drive_file_id;
        filename = `original-${photo.shot_id || id}.jpg`;
      } else {
        targetDriveFileId = photo.drive_file_id;
        filename = `photo-${photo.shot_id || id}.jpg`;
      }
    } else {
      // Treat directly as Drive fileId
      targetDriveFileId = id;
      filename = `drive-${id}.jpg`;
    }

    if (!targetDriveFileId) {
      return NextResponse.json({ error: "Drive file ID not found for this photo" }, { status: 404 });
    }

    // 3. Resolve Drive tokens & client
    const { refreshToken } = await resolveDriveTokens();
    if (!refreshToken) {
      return NextResponse.json({ error: "Google Drive is not linked" }, { status: 503 });
    }

    const drive = getDriveClient(refreshToken);

    // 4. If full original resolution or download is requested, stream full media directly
    if (size === "original" || isDownload) {
      const driveStreamRes = await drive.files.get(
        { fileId: targetDriveFileId, alt: "media" },
        { responseType: "stream" }
      );

      const headers = new Headers();
      headers.set("Content-Type", "image/jpeg");
      headers.set("Cache-Control", "private, max-age=31536000, immutable");
      if (isDownload) {
        headers.set("Content-Disposition", `attachment; filename="${filename}"`);
      }

      const webStream = Readable.toWeb(driveStreamRes.data as unknown as Readable);
      return new Response(webStream as unknown as ReadableStream, { headers });
    }

    // 5. Retina thumbnail proxying: Rewrite Google Drive thumbnail to =s800 or =s1600
    try {
      const meta = await drive.files.get({
        fileId: targetDriveFileId,
        fields: "id, name, mimeType, thumbnailLink",
      });

      const rawThumbnail = meta.data.thumbnailLink;
      if (rawThumbnail) {
        const targetDim = size === "lightbox" ? "=s1600" : "=s800";
        const resizedUrl = rawThumbnail.replace(/=s\d+$/, targetDim);

        // Fetch thumbnail from Google's high-speed CDN using OAuth token
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({ refresh_token: refreshToken });
        const tokenRes = await oauth2Client.getAccessToken();
        const authHeader: Record<string, string> = tokenRes.token ? { Authorization: `Bearer ${tokenRes.token}` } : {};

        const thumbFetch = await fetch(resizedUrl, { headers: authHeader });
        if (thumbFetch.ok && thumbFetch.body) {
          const headers = new Headers();
          headers.set("Content-Type", thumbFetch.headers.get("Content-Type") || "image/jpeg");
          headers.set("Cache-Control", "private, max-age=31536000, immutable");
          return new Response(thumbFetch.body, { headers });
        }
      }
    } catch (thumbErr) {
      console.warn("Retina thumbnail fetch fallback to direct media stream:", thumbErr);
    }

    // 6. Direct media stream fallback
    const fallbackStream = await drive.files.get(
      { fileId: targetDriveFileId, alt: "media" },
      { responseType: "stream" }
    );

    const headers = new Headers();
    headers.set("Content-Type", "image/jpeg");
    headers.set("Cache-Control", "private, max-age=31536000, immutable");
    const webStream = Readable.toWeb(fallbackStream.data as unknown as Readable);
    return new Response(webStream as unknown as ReadableStream, { headers });
  } catch (err: any) {
    const isNotFound =
      err?.status === 404 ||
      err?.code === 404 ||
      err?.response?.status === 404 ||
      (typeof err?.message === "string" && (err.message.includes("File not found") || err.message.includes("404")));

    if (isNotFound) {
      return NextResponse.json(
        { error: "File removed from Google Drive", code: "DRIVE_FILE_NOT_FOUND" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    console.error("Error in /api/admin/photos/[id]:", err);
    return NextResponse.json({ error: "Failed to stream photo" }, { status: 500 });
  }
}
