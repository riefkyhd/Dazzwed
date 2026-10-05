import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/supabase/auth";
import { deletePhoto } from "@/lib/drive/management";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  props: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;

  try {
    await deletePhoto(id);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to delete photo: ${msg}` }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  props: { params: Promise<{ id: string }> },
) {
  return DELETE(req, props);
}
