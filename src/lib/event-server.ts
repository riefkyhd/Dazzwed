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
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) return null;
  const { data, error } = await supabaseAdmin()
    .from("events")
    .select("id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`getEventBySlug failed: ${error.message}`);
  return data as EventRow | null;
}
