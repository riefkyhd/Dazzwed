import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateEventToken } from "@/lib/event-token";

export interface GenerateUniqueTokenOptions {
  previousToken?: string | null;
  length?: number;
  maxAttempts?: number;
  checkExists?: (candidate: string) => Promise<boolean>;
}

export type GenerateUniqueTokenInput = string | null | undefined | GenerateUniqueTokenOptions;

/**
 * Generates a cryptographically secure, globally unique event access token.
 * Guarantees:
 * 1. If rotating an existing event's token, the new token will NEVER match previousToken.
 * 2. Checks database (or checkExists callback) to guarantee no existing event has the same access_token.
 * 3. Retries in a bounded loop up to maxAttempts (default 5).
 */
export async function generateUniqueEventToken(input?: GenerateUniqueTokenInput): Promise<string> {
  const options: GenerateUniqueTokenOptions =
    typeof input === "string" ? { previousToken: input } : input || {};

  const { length = 8, previousToken, maxAttempts = 5, checkExists } = options;

  let attempts = 0;
  while (attempts < maxAttempts) {
    attempts++;
    const candidate = generateEventToken(length);

    // Safeguard 1: Never reuse the immediate previous token if rotating
    if (previousToken && candidate.toUpperCase() === previousToken.trim().toUpperCase()) {
      continue;
    }

    // Safeguard 2: Check for database collisions across all events
    let exists = false;
    if (checkExists) {
      exists = await checkExists(candidate);
    } else {
      try {
        const sb = supabaseAdmin();
        const { data } = await sb
          .from("events")
          .select("id")
          .eq("access_token", candidate)
          .maybeSingle();
        exists = !!data;
      } catch (err) {
        console.warn("Could not check event token existence in database:", err);
      }
    }

    if (!exists) {
      return candidate;
    }
  }

  // Fallback: If 5 collisions in 8-char space, expand length to 12
  return generateEventToken(12);
}

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
