import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Cron-Secret",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Freshness monitor — pg_cron hits this every 2 min.
// Alerts (throttled 15 min) if the cookie pool is older than STALE_ALERT_MS
// or if there are no rows at all.
const STALE_ALERT_MS = 5 * 60 * 1000; // 5 min

async function handle(request: Request) {
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("key") ??
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const expected = process.env.CRON_SECRET;
  if (expected && provided !== expected) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendAlert } = await import("@/lib/alert.server");

  const { data: latest, error } = await supabaseAdmin
    .from("session_cookies")
    .select("updated_at, total_cookies")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    await sendAlert({
      kind: "monitor_db_error",
      subject: "Freshness monitor: DB error",
      message: `Could not read session_cookies: ${error.message}`,
    });
    return json({ ok: false, error: error.message }, 500);
  }

  if (!latest?.updated_at) {
    await sendAlert({
      kind: "pool_empty",
      subject: "Cookie pool is EMPTY",
      message: "session_cookies has no rows. Extension will fail auth.",
    });
    return json({ ok: false, reason: "empty" });
  }

  const ageMs = Date.now() - new Date(latest.updated_at).getTime();

  if (ageMs > STALE_ALERT_MS) {
    // Try one self-heal before alerting so a transient upstream blip doesn't page us.
    const { refreshCookiePool } = await import("@/lib/cookie-refresh.server");
    const result = await refreshCookiePool({ forceIfYoungerThanMs: STALE_ALERT_MS });

    // Re-read pool age AFTER self-heal to confirm whether the panel is still inactive.
    const { data: after } = await supabaseAdmin
      .from("session_cookies")
      .select("updated_at, total_cookies")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ageAfterMs = after?.updated_at
      ? Date.now() - new Date(after.updated_at).getTime()
      : Number.POSITIVE_INFINITY;
    const stillStale = ageAfterMs > STALE_ALERT_MS;

    if (stillStale) {
      const mins = Math.round(ageAfterMs / 60000);
      await sendAlert({
        kind: "admin_inactive_5min",
        subject: `Admin panel INACTIVE for ${mins}+ min (self-heal failed)`,
        message:
          `The cookie pool has been stale for ${Math.round(ageAfterMs / 1000)}s ` +
          `(threshold ${STALE_ALERT_MS / 1000}s). The extension /verify self-heal ` +
          `was invoked but did NOT recover the pool.\n\n` +
          `Self-heal result: ${JSON.stringify(result)}\n` +
          `Pool age before self-heal: ${Math.round(ageMs / 1000)}s\n` +
          `Pool age after self-heal:  ${Math.round(ageAfterMs / 1000)}s\n` +
          `Latest row total_cookies:  ${after?.total_cookies ?? latest.total_cookies ?? "?"}\n\n` +
          `Action: check upstream (veoly) availability and CRON_SECRET / cron job health.`,
      });
    }
    return json({ ok: true, ageMs, ageAfterMs, selfHeal: result, stillStale });
  }

  return json({ ok: true, ageMs, fresh: true });
}

export const Route = createFileRoute("/api/public/cron/monitor-freshness")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
