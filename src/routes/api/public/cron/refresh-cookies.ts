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

// Public cron endpoint — call every 60s from an external scheduler
// (cron-job.org, GitHub Actions, uptimerobot, etc.) using the stable URL:
//   https://project--306a4997-5830-492f-b8db-9bb0ab4aee1f.lovable.app/api/public/cron/refresh-cookies?key=<CRON_SECRET>
// Also safe to hit without a key — the underlying refresh is idempotent
// and rate-limited (min 90s between real upstream pulls).
async function handle(request: Request) {
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("key") ??
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const expected = process.env.CRON_SECRET;
  // If CRON_SECRET is configured, enforce it; otherwise the endpoint stays
  // open so admins can hit it manually or from any scheduler in a pinch.
  if (expected && provided !== expected) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  // When no secret is configured the endpoint is reachable by anyone, so throttle
  // it: without this, a tight loop could race past the 90s freshness check and
  // hammer the upstream provider with duplicate pulls.
  if (!expected) {
    const { checkRateLimit } = await import("@/lib/rate-limit.server");
    const gate = await checkRateLimit({
      bucket: "cron:refresh-cookies",
      key: "global",
      limit: 4,
      windowSec: 60,
    });
    if (!gate.allowed) return json({ ok: false, error: "rate_limited" }, 429);
  }

  const { refreshCookiePool } = await import("@/lib/cookie-refresh.server");
  const result = await refreshCookiePool();

  // Alert on real failures — 'fresh' (skipped because pool is young) is not a failure.
  if (!result.ok) {
    const reason = result.reason ?? "unknown";
    // Keep the alert `kind` low-cardinality so the 15-minute throttle works even
    // when the reason string carries a variable error detail.
    const kindKey = reason.split(":")[0].trim() || "unknown";
    const { sendAlert } = await import("@/lib/alert.server");
    await sendAlert({
      kind: `refresh_fail_${kindKey}`,
      subject: `Cookie refresh failed: ${kindKey}`,
      message:
        `Refresh endpoint could not update the pool.\n` +
        `Reason: ${reason}\n` +
        `Pool age before attempt: ${
          result.ageBeforeMs === Number.POSITIVE_INFINITY
            ? "no rows"
            : `${Math.round((result.ageBeforeMs ?? 0) / 1000)}s`
        }`,
    });
  }


  return json({ ...result, at: new Date().toISOString() });
}

export const Route = createFileRoute("/api/public/cron/refresh-cookies")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});
