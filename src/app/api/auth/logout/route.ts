import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut().catch(() => {});
  } catch {}

  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {}

  const url = new URL("/admin/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut().catch(() => {});
  } catch {}

  try {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch {}

  const url = new URL("/admin/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
