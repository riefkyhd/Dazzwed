import { z } from "zod";

export type EventStatus = "open" | "before" | "after" | "off";

export interface EventWindow {
  opens_at: string | null;
  closes_at: string | null;
  manually_closed: boolean;
}

export function eventStatus(ev: EventWindow, now: Date = new Date()): EventStatus {
  if (ev.manually_closed) return "off";
  if (ev.opens_at && now < new Date(ev.opens_at)) return "before";
  if (ev.closes_at && now >= new Date(ev.closes_at)) return "after";
  return "open";
}

const hex = z.string().regex(/^#[0-9a-fA-F]{3,8}$/);
export const themeSchema = z
  .object({
    bg: hex,
    surface: hex,
    fg: hex,
    muted: hex,
    accent: hex,
    accentFg: hex,
  })
  .partial();
export type Theme = z.infer<typeof themeSchema>;

/** Only validated hex colours ever reach inline CSS. */
export function themeToCssVars(raw: unknown): Record<string, string> {
  const parsed = themeSchema.safeParse(raw);
  if (!parsed.success) return {};
  const t = parsed.data;
  const out: Record<string, string> = {};
  if (t.bg) out["--bg"] = t.bg;
  if (t.surface) out["--surface"] = t.surface;
  if (t.fg) out["--fg"] = t.fg;
  if (t.muted) out["--muted"] = t.muted;
  if (t.accent) out["--accent"] = t.accent;
  if (t.accentFg) out["--accent-fg"] = t.accentFg;
  return out;
}
