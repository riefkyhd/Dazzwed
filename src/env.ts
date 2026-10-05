import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

const serverSchema = publicSchema
  .extend({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
    // Obtained via /admin/connect-drive (Phase 3); optional until connected.
    GOOGLE_REFRESH_TOKEN: z.string().min(1).optional(),
    DRIVE_ROOT_FOLDER_ID: z.string().min(1).optional(),
    ADMIN_EMAILS: z
      .string()
      .min(1)
      .transform((s) =>
        s
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.email()).min(1)),
    CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
    TURNSTILE_ENABLED: bool.optional().default(false),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1).optional(),
    TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  })
  .superRefine((env, ctx) => {
    if (env.TURNSTILE_ENABLED) {
      for (const k of ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] as const) {
        if (!env[k]) {
          ctx.addIssue({ code: "custom", path: [k], message: `${k} is required when TURNSTILE_ENABLED=true` });
        }
      }
    }
  });

export type ServerEnv = z.infer<typeof serverSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  // Treat empty strings (e.g. blank lines in .env) as unset.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, v]) => v !== ""));
  const result = serverSchema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${lines.join("\n")}`);
  }
  return result.data;
}

let cached: ServerEnv | undefined;
/** Server-only. Never import from client components. Validated once, lazily. */
export function serverEnv(): ServerEnv {
  return (cached ??= parseServerEnv(process.env));
}
