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

  const { refreshCookiePool } = await import("@/lib/cookie-refresh.server");
  const result = await refreshCookiePool();

  // Alert on real failures — 'fresh' (skipped because pool is young) is not a failure.
  if (!result.ok) {
    const { sendAlert } = await import("@/lib/alert.server");
    await sendAlert({
      kind: `refresh_fail_${result.reason ?? "unknown"}`,
      subject: `Cookie refresh failed: ${result.reason ?? "unknown"}`,
      message:
        `Refresh endpoint could not update the pool.\n` +
        `Reason: ${result.reason}\n` +
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
