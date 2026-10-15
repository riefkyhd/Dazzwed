import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface EventRow {
  id: string;
  slug: string;
  couple_names: string;
  shots_per_guest: number;
  opens_at: string | null;
  closes_at: string | null;
  manually_closed: boolean;
  theme: unknown;
  drive_root_folder_id: string | null;
  access_token: string;
  token_expires_at: string | null;
  token_duration_hours: number;
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) return null;
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id,access_token,token_expires_at,token_duration_hours")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(`getEventBySlug failed: ${error.message}`);
  return data as EventRow | null;
}
