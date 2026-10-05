import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL("/admin/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}

export async function GET(req: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const url = new URL("/admin/login", req.url);
  return NextResponse.redirect(url, { status: 303 });
}
