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

  // Security Check 1: Tenant Ownership Verification
  try {
    const { getAuthSession } = await import("@/lib/auth/session");
    const session = await getAuthSession();
    if (session && session.role === "client") {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      const { data: photo } = await supabaseAdmin()
        .from("photos")
        .select("id, event_id, events(client_id)")
        .eq("id", id)
        .maybeSingle();

      if (!photo || (photo as any)?.events?.client_id !== session.clientId) {
        return NextResponse.json({ error: "Access denied: photo belongs to another client" }, { status: 403 });
      }
    }
  } catch {}

  try {
    await unhidePhoto(id);
    return NextResponse.json({ ok: true, id, status: "confirmed" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to restore photo: ${msg}` }, { status: 500 });
  }
}
