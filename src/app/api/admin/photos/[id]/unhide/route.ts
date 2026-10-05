import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/supabase/auth";
import { unhidePhoto } from "@/lib/drive/management";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;

  try {
    await unhidePhoto(id);
    return NextResponse.json({ ok: true, id, status: "confirmed" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to restore photo: ${msg}` }, { status: 500 });
  }
}
