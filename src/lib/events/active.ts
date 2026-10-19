import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EventRow } from "@/lib/event-server";

export const ACTIVE_EVENT_COOKIE = "dazzwed_active_event_id";

const BASE_COLUMNS = "id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id,access_token,token_expires_at,token_duration_hours";
const EXTENDED_COLUMNS = `${BASE_COLUMNS},status,package_tier,package_max_guests,package_max_shots_per_guest,dual_master_enabled,expires_at,created_at`;

function normalizeEventRow(row: any): EventRow {
  return {
    ...row,
    status: row.status || (row.manually_closed ? "archived" : "active"),
    package_tier: row.package_tier || "owner_unlimited",
    package_max_guests: row.package_max_guests ?? null,
    package_max_shots_per_guest: row.package_max_shots_per_guest ?? 100,
    dual_master_enabled: row.dual_master_enabled ?? true,
  };
}

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

  // Helper to query with automatic fallback if migration 0011 columns are pending in DB
  async function queryEvent(builderFn: (query: any) => any): Promise<EventRow | null> {
    try {
      const q = builderFn(sb.from("events").select(EXTENDED_COLUMNS));
      const { data, error } = await q;
      if (!error && data) {
        return normalizeEventRow(data);
      }
      if (error) {
        // Fallback to BASE_COLUMNS in case status/package_tier migration hasn't been executed on Supabase yet
        const fallbackQ = builderFn(sb.from("events").select(BASE_COLUMNS));
        const { data: fallbackData } = await fallbackQ;
        if (fallbackData) {
          return normalizeEventRow(fallbackData);
        }
      }
    } catch {
      // Fallback
    }
    return null;
  }

  // 1. Explicit search param override
  if (searchParamEventId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(searchParamEventId)) {
    const res = await queryEvent((q) => q.eq("id", searchParamEventId).maybeSingle());
    if (res) return res;
  }

  // 2. Cookie override
  try {
    const cookieStore = await cookies();
    const cookieEventId = cookieStore.get(ACTIVE_EVENT_COOKIE)?.value;
    if (cookieEventId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cookieEventId)) {
      const res = await queryEvent((q) => q.eq("id", cookieEventId).maybeSingle());
      if (res) return res;
    }
  } catch {
    // cookies() might fail if called outside of request context
  }

  // 3. Fallback to most recent active event (if status column exists)
  try {
    const { data: activeEvent, error: activeErr } = await sb
      .from("events")
      .select(EXTENDED_COLUMNS)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeErr && activeEvent) return normalizeEventRow(activeEvent);
  } catch {
    // Ignore error if status column does not exist
  }

  // 4. Fallback to any most recent event
  const anyEvent = await queryEvent((q) => q.order("created_at", { ascending: false }).limit(1).maybeSingle());
  return anyEvent;
}

/**
 * Lists all events for the Event Switcher dropdown in the Admin Navbar
 */
export async function listAdminEvents(): Promise<EventRow[]> {
  const sb = supabaseAdmin();
  try {
    const { data, error } = await sb
      .from("events")
      .select(EXTENDED_COLUMNS)
      .order("created_at", { ascending: false });

    if (!error && data) return data.map(normalizeEventRow);
  } catch {}

  // Fail-safe fallback if 0011 columns are not yet in database
  const { data: fallbackData } = await sb
    .from("events")
    .select(BASE_COLUMNS)
    .order("created_at", { ascending: false });

  if (fallbackData) return fallbackData.map(normalizeEventRow);
  return [];
}
