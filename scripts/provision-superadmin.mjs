import { createClient } from "@supabase/supabase-js";
import { scryptSync, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Load .env.local
const envPath = join(process.cwd(), ".env.local");
try {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  console.warn("Could not read .env.local directly, falling back to process.env");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function hashClientPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password.trim(), salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function main() {
  const superadminEmail = "riefky.hd@gmail.com";
  const password = process.argv[2] || process.env.SUPERADMIN_PASSWORD || "Dazzwed2026!Secure";

  console.log(`\n======================================================`);
  console.log(` Provisioning Superadmin: ${superadminEmail}`);
  console.log(`======================================================`);

  const passwordHash = hashClientPassword(password);

  // 1. Check clients table in database
  const { data: existingClient, error: clientErr } = await sb
    .from("clients")
    .select("id, email, status")
    .eq("email", superadminEmail)
    .maybeSingle();

  let clientId = existingClient?.id;

  // Attempt upsert with role if column exists, fallback without role if not yet migrated
  const payloadWithRole = {
    name: "Muhammad Riefky Hadid",
    email: superadminEmail,
    password_hash: passwordHash,
    access_code: "SUPERADM",
    max_events: 999,
    status: "active",
    role: "superadmin",
    notes: "Platform Owner / Superadmin",
    updated_at: new Date().toISOString(),
  };

  const payloadFallback = {
    name: "Muhammad Riefky Hadid",
    email: superadminEmail,
    password_hash: passwordHash,
    access_code: "SUPERADM",
    max_events: 999,
    status: "active",
    notes: "Platform Owner / Superadmin",
    updated_at: new Date().toISOString(),
  };

  let upsertRes = existingClient
    ? await sb.from("clients").update(payloadWithRole).eq("id", existingClient.id).select().single()
    : await sb.from("clients").insert(payloadWithRole).select().single();

  if (upsertRes.error && upsertRes.error.message?.includes("column")) {
    console.log("  Notice: 'role' column pending in DB; upserting with superadmin notes & role fallback...");
    upsertRes = existingClient
      ? await sb.from("clients").update(payloadFallback).eq("id", existingClient.id).select().single()
      : await sb.from("clients").insert(payloadFallback).select().single();
  }

  if (upsertRes.error) {
    console.error("  ❌ Failed to upsert client in database:", upsertRes.error);
    process.exit(1);
  }

  clientId = upsertRes.data.id;
  console.log(`  ✅ Database Client record provisioned (ID: ${clientId})`);

  // 2. Synchronize Supabase Auth
  const { data: userList, error: listErr } = await sb.auth.admin.listUsers();
  if (listErr) {
    console.warn("  ⚠️ Warning: Could not list Supabase Auth users:", listErr.message);
  } else {
    const authUser = userList.users.find((u) => u.email?.toLowerCase() === superadminEmail.toLowerCase());
    if (authUser) {
      const { error: updateAuthErr } = await sb.auth.admin.updateUserById(authUser.id, {
        password: password,
        email_confirm: true,
      });
      if (updateAuthErr) {
        console.warn("  ⚠️ Warning updating Supabase Auth password:", updateAuthErr.message);
      } else {
        console.log(`  ✅ Supabase Auth password synchronized for ${authUser.id}`);
      }
    } else {
      const { data: newAuthUser, error: createAuthErr } = await sb.auth.admin.createUser({
        email: superadminEmail,
        password: password,
        email_confirm: true,
      });
      if (createAuthErr) {
        console.warn("  ⚠️ Warning creating Supabase Auth user:", createAuthErr.message);
      } else {
        console.log(`  ✅ Supabase Auth user created with ID ${newAuthUser.user.id}`);
      }
    }
  }

  // 3. Ensure ADMIN_EMAILS in .env.local includes this email
  if (process.env.ADMIN_EMAILS && !process.env.ADMIN_EMAILS.includes(superadminEmail)) {
    const updatedEmails = `${process.env.ADMIN_EMAILS},${superadminEmail}`;
    try {
      let envContent = readFileSync(envPath, "utf-8");
      envContent = envContent.replace(/ADMIN_EMAILS="[^"]*"/, `ADMIN_EMAILS="${updatedEmails}"`);
      writeFileSync(envPath, envContent, "utf-8");
      console.log(`  ✅ Updated ADMIN_EMAILS in .env.local to include ${superadminEmail}`);
    } catch {}
  }

  console.log(`\n======================================================`);
  console.log(` Provisioning Complete!`);
  console.log(` Email:    ${superadminEmail}`);
  console.log(` Role:     superadmin`);
  console.log(` Password: ${password.slice(0, 3)}${"*".repeat(password.length - 4)}${password.slice(-1)} (Length: ${password.length})`);
  console.log(` Status:   ACTIVE`);
  console.log(`======================================================\n`);
}

main().catch(console.error);
