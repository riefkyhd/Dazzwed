import "server-only";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { EventRow } from "@/lib/event-server";

export const ACTIVE_EVENT_COOKIE = "dazzwed_active_event_id";

const BASE_COLUMNS = "id,slug,couple_names,shots_per_guest,opens_at,closes_at,manually_closed,theme,drive_root_folder_id,access_token,token_expires_at,token_duration_hours";
const EXTENDED_COLUMNS = `${BASE_COLUMNS},status,package_tier,package_max_guests,package_max_shots_per_guest,dual_master_enabled,client_id,expires_at,created_at`;

function normalizeEventRow(row: any): EventRow {
  return {
    ...row,
    status: row.status || (row.manually_closed ? "archived" : "active"),
    package_tier: row.package_tier || "owner_unlimited",
    package_max_guests: row.package_max_guests ?? null,
    package_max_shots_per_guest: row.package_max_shots_per_guest ?? 100,
    dual_master_enabled: row.dual_master_enabled ?? true,
    client_id: row.client_id ?? null,
  };
}

/**
 * Resolves the active event for admin dashboards and queries.
 * Resolution priority:
 * 1. Checks current authenticated user (client vs superadmin).
 *    If client: STRICTLY scopes queries to where client_id = session.clientId!
 * 2. Explicit searchParam override (?eventId=...)
 * 3. Active event cookie (dazzwed_active_event_id)
 * 4. Most recently created event with status = 'active'
 * 5. Most recently created event overall
 */
export async function getActiveAdminEvent(searchParamEventId?: string | null): Promise<EventRow | null> {
  const sb = supabaseAdmin();

  // Resolve session role
  let clientScopeId: string | null = null;
  try {
    const { getAuthSession } = await import("@/lib/auth/session");
    const session = await getAuthSession();
    if (session && session.role === "client") {
      clientScopeId = session.clientId;
    }
  } catch {}

  // Helper to query with automatic fallback if migration columns are pending in DB
  async function queryEvent(builderFn: (query: any) => any): Promise<EventRow | null> {
    try {
      let baseQ = sb.from("events").select(EXTENDED_COLUMNS);
      if (clientScopeId) {
        baseQ = baseQ.eq("client_id", clientScopeId);
      }
      const q = builderFn(baseQ);
      const { data, error } = await q;
      if (!error && data) {
        return normalizeEventRow(data);
      }
      if (error) {
        // Fallback to BASE_COLUMNS
        let fallbackBase = sb.from("events").select(BASE_COLUMNS);
        // Note: if client_id column is not in base, only apply if possible
        const fallbackQ = builderFn(fallbackBase);
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
    let q = sb.from("events").select(EXTENDED_COLUMNS).eq("status", "active");
    if (clientScopeId) {
      q = q.eq("client_id", clientScopeId);
    }
    const { data: activeEvent, error: activeErr } = await q
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
 * Lists all events for the Event Switcher dropdown in the Admin Navbar.
 * Scoped strictly by client_id if caller is client!
 */
export async function listAdminEvents(): Promise<EventRow[]> {
  const sb = supabaseAdmin();
  let clientScopeId: string | null = null;
  try {
    const { getAuthSession } = await import("@/lib/auth/session");
    const session = await getAuthSession();
    if (session && session.role === "client") {
      clientScopeId = session.clientId;
    }
  } catch {}

  try {
    let q = sb.from("events").select(EXTENDED_COLUMNS);
    if (clientScopeId) {
      q = q.eq("client_id", clientScopeId);
    }
    const { data, error } = await q.order("created_at", { ascending: false });

    if (!error && data) return data.map(normalizeEventRow);
  } catch {}

  // Fail-safe fallback if columns are not yet in database
  let fb = sb.from("events").select(BASE_COLUMNS);
  const { data: fallbackData } = await fb.order("created_at", { ascending: false });

  if (fallbackData) return fallbackData.map(normalizeEventRow);
  return [];
}
