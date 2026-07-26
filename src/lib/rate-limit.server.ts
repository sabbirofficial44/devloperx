/**
 * Simple DB-backed sliding-window rate limiter for public endpoints.
 *
 * Used to stop email bombing / SMTP-quota exhaustion on the unauthenticated
 * auth endpoints (signup, reset-request, send-verification).
 */
export function callerIp(request: Request): string {
  const h = request.headers;
  return (
    h.get("cf-connecting-ip") ||
    (h.get("x-forwarded-for") || "").split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

export async function checkRateLimit(opts: {
  bucket: string;
  key: string;
  limit: number;
  windowSec: number;
}): Promise<RateLimitResult> {
  const { bucket, key, limit, windowSec } = opts;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - windowSec * 1000).toISOString();

    const { count, error } = await (supabaseAdmin as never as {
      from: (t: string) => {
        select: (c: string, o: { count: "exact"; head: true }) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => {
              gte: (c: string, v: string) => Promise<{ count: number | null; error: unknown }>;
            };
          };
        };
      };
    })
      .from("rate_limits")
      .select("id", { count: "exact", head: true })
      .eq("bucket", bucket)
      .eq("key", key)
      .gte("created_at", since);

    // Fail open on infrastructure errors — never lock real users out.
    if (error) return { allowed: true, retryAfterSec: 0 };
    if ((count ?? 0) >= limit) return { allowed: false, retryAfterSec: windowSec };

    await (supabaseAdmin as never as {
      from: (t: string) => { insert: (v: Record<string, string>) => Promise<unknown> };
    })
      .from("rate_limits")
      .insert({ bucket, key });

    return { allowed: true, retryAfterSec: 0 };
  } catch {
    return { allowed: true, retryAfterSec: 0 };
  }
}
