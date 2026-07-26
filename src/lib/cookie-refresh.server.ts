// Server-only helper that pulls the freshest cookie pool from upstream
// and writes it into session_cookies + mirrors onto profiles.
// Called from: /api/public/extension/verify (self-heal on read),
// /api/public/cron/refresh-cookies (proactive schedule).

export interface RefreshResult {
  ok: boolean;
  reason?: string;
  inserted?: boolean;
  total?: number;
  ageBeforeMs?: number;
}

const STALE_MS_DEFAULT = 90 * 1000; // 90s — well under the 3-min drain window

export async function refreshCookiePool(opts: {
  forceIfYoungerThanMs?: number;
} = {}): Promise<RefreshResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const stale = opts.forceIfYoungerThanMs ?? STALE_MS_DEFAULT;

  const { data: latest } = await supabaseAdmin
    .from("session_cookies")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const ageMs = latest?.updated_at
    ? Date.now() - new Date(latest.updated_at).getTime()
    : Number.POSITIVE_INFINITY;

  if (ageMs < stale) {
    return { ok: true, inserted: false, ageBeforeMs: ageMs, reason: "fresh" };
  }

  let freshCookies: unknown[] = [];
  try {
    const r = await fetch("https://veoly.netlify.app/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "admin", sessionToken: "admin:admin@developerx.dev" }),
    });
    if (!r.ok) return { ok: false, reason: `upstream_${r.status}`, ageBeforeMs: ageMs };
    const j = (await r.json()) as { cookies?: unknown[] };
    freshCookies = Array.isArray(j.cookies) ? j.cookies : [];
  } catch (e) {
    const detail = String((e as { message?: string })?.message ?? e).slice(0, 200);
    return { ok: false, reason: `upstream_error: ${detail}`, ageBeforeMs: ageMs };
  }

  if (freshCookies.length === 0) {
    return { ok: false, reason: "empty_upstream", ageBeforeMs: ageMs };
  }

  const { error: insertError } = await supabaseAdmin
    .from("session_cookies")
    .insert({ cookies: freshCookies as never, total_cookies: freshCookies.length });
  if (insertError) return { ok: false, reason: "insert_failed", ageBeforeMs: ageMs };

  await supabaseAdmin
    .from("profiles")
    .update({
      assigned_cookies: freshCookies as never,
      cookies_rotated_at: new Date().toISOString(),
    })
    .not("user_id", "is", null);

  return { ok: true, inserted: true, total: freshCookies.length, ageBeforeMs: ageMs };
}
