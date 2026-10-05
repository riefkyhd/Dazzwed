import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "./server";
import { serverEnv } from "@/env";

/**
 * Checks whether the specified email address is authorized in ADMIN_EMAILS.
 */
export function isEmailAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const env = serverEnv();
  return env.ADMIN_EMAILS.includes(normalized);
}

/**
 * Retrieves the currently authenticated Supabase user from request cookies
 * and verifies that their email is present in the admin allowlist.
 * Returns the User object if authorized, or null otherwise.
 */
export async function getAdminUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user || !user.email) {
      return null;
    }

    if (!isEmailAdmin(user.email)) {
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

/**
 * Ensures the requesting user is authenticated as an allowlisted admin.
 * If not authenticated or not authorized, redirects to the login page.
 */
export async function requireAdmin(redirectTo = "/admin/login"): Promise<User> {
  const user = await getAdminUser();
  if (!user) {
    redirect(redirectTo);
  }
  return user;
}
