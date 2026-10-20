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
  status: "active" | "paused" | "archived";
  package_tier: "pocket_roll" | "classic_35mm" | "grand_archive" | "owner_unlimited";
  package_max_guests: number | null;
  package_max_shots_per_guest: number;
  dual_master_enabled: boolean;
  client_id?: string | null;
  expires_at?: string | null;
  created_at?: string;
}

export async function getEventBySlug(slug: string): Promise<EventRow | null> {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) return null;
  const sb = supabaseAdmin();
  
  // Try extended schema
  const { data, error } = await sb
    .from("events")
    .select("id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id,access_token,token_expires_at,token_duration_hours,status,package_tier,package_max_guests,package_max_shots_per_guest,dual_master_enabled,client_id,expires_at,created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (!error && data) {
    return {
      ...(data as any),
      status: (data as any).status || ((data as any).manually_closed ? "archived" : "active"),
      package_tier: (data as any).package_tier || "owner_unlimited",
      package_max_guests: (data as any).package_max_guests ?? null,
      package_max_shots_per_guest: (data as any).package_max_shots_per_guest ?? 100,
      dual_master_enabled: (data as any).dual_master_enabled ?? true,
    } as EventRow;
  }

  // Fallback to base columns if migration 0011 columns are pending in DB
  const { data: baseData, error: baseError } = await sb
    .from("events")
    .select("id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id,access_token,token_expires_at,token_duration_hours")
    .eq("slug", slug)
    .maybeSingle();

  if (baseError) throw new Error(`getEventBySlug failed: ${baseError.message}`);
  if (!baseData) return null;

  return {
    ...(baseData as any),
    status: (baseData as any).manually_closed ? "archived" : "active",
    package_tier: "owner_unlimited",
    package_max_guests: null,
    package_max_shots_per_guest: 100,
    dual_master_enabled: true,
  } as EventRow;
}
