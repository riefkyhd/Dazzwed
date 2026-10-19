import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EventRow } from "@/lib/event-server";

export const ACTIVE_EVENT_COOKIE = "dazzwed_active_event_id";

/**
 * Resolves the active event for admin dashboards and queries.
 * Resolution priority:
 * 1. Explicit searchParam override (?eventId=...)
 * 2. Active event cookie (dazzwed_active_event_id)
 * 3. Most recently created event with status = 'active'
 * 4. Most recently created event overall
 */
export async function getActiveAdminEvent(searchParamEventId?: string | null): Promise<EventRow | null> {
  const sb = supabaseAdmin();

  // 1. Explicit search param override
  if (searchParamEventId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchParamEventId)) {
    const { data } = await sb
      .from("events")
      .select("id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id,access_token,token_expires_at,token_duration_hours,status,package_tier,package_max_guests,package_max_shots_per_guest,dual_master_enabled,expires_at,created_at")
      .eq("id", searchParamEventId)
      .maybeSingle();
    if (data) return data as EventRow;
  }

  // 2. Cookie override
  try {
    const cookieStore = await cookies();
    const cookieEventId = cookieStore.get(ACTIVE_EVENT_COOKIE)?.value;
    if (cookieEventId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cookieEventId)) {
      const { data } = await sb
        .from("events")
        .select("id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id,access_token,token_expires_at,token_duration_hours,status,package_tier,package_max_guests,package_max_shots_per_guest,dual_master_enabled,expires_at,created_at")
        .eq("id", cookieEventId)
        .maybeSingle();
      if (data) return data as EventRow;
    }
  } catch {
    // cookies() might fail if called outside of request context
  }

  // 3. Fallback to most recent active event
  const { data: activeEvent } = await sb
    .from("events")
    .select("id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id,access_token,token_expires_at,token_duration_hours,status,package_tier,package_max_guests,package_max_shots_per_guest,dual_master_enabled,expires_at,created_at")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (activeEvent) return activeEvent as EventRow;

  // 4. Fallback to any most recent event
  const { data: fallbackEvent } = await sb
    .from("events")
    .select("id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id,access_token,token_expires_at,token_duration_hours,status,package_tier,package_max_guests,package_max_shots_per_guest,dual_master_enabled,expires_at,created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (fallbackEvent as EventRow | null) || null;
}

/**
 * Lists all events for the Event Switcher dropdown in the Admin Navbar
 */
export async function listAdminEvents(): Promise<EventRow[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("events")
    .select("id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id,access_token,token_expires_at,token_duration_hours,status,package_tier,package_max_guests,package_max_shots_per_guest,dual_master_enabled,expires_at,created_at")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data as EventRow[];
}
