import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Plans that bypass credit gating.
const UNLIMITED_PLANS = new Set(["unlimited", "ultra", "lifetime"]);

async function loadContext(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Real-time trial burn before reading profile
  await supabaseAdmin.rpc("tick_trial_credits", { _user_id: userId });
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, display_name, credits, user_plan, assigned_cookies")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile) return { supabaseAdmin, profile: null as null };

  const { data: cookieRow } = await supabaseAdmin
    .from("session_cookies")
    .select("cookies, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const liveCookies = (cookieRow?.cookies as unknown[] | null) ?? [];
  const assignedCookies = Array.isArray(profile.assigned_cookies)
    ? (profile.assigned_cookies as unknown[])
    : [];
  const cookies = liveCookies.length > 0 ? liveCookies : assignedCookies;
  return { supabaseAdmin, profile, cookies, cookieUpdatedAt: cookieRow?.updated_at ?? null };
}

function buildUser(profile: {
  user_id: string; email: string | null; display_name: string | null;
  credits: number | null; user_plan: string | null;
}) {
  const credits = Number(profile.credits ?? 0);
  const plan = (profile.user_plan ?? "basic").toLowerCase();
  return {
    id: profile.user_id,
    name: profile.display_name ?? profile.email ?? "Flow User",
    email: profile.email,
    plan,
    creditsTotal: credits,
    creditsUsed: 0,
    creditsLeft: credits,
    unlimited: UNLIMITED_PLANS.has(plan),
  };
}

function gate(profile: { credits: number | null; user_plan: string | null }) {
  const plan = (profile.user_plan ?? "basic").toLowerCase();
  const credits = Number(profile.credits ?? 0);
  if (UNLIMITED_PLANS.has(plan)) return null;
  if (credits <= 0) {
    return {
      code: "credits_exhausted",
      message:
        "Your free trial / credits have run out. Please purchase more credits to keep using the extension.",
    };
  }
  return null;
}

export const Route = createFileRoute("/api/verify")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId") ?? url.searchParams.get("user_id");
        if (!userId) return json({ valid: false, message: "Missing userId", cookies: [], user: null }, 401);

        const ctx = await loadContext(userId);
        if (!ctx.profile) return json({ valid: false, message: "Invalid user", cookies: [], user: null }, 401);

        const blocked = gate(ctx.profile);
        const user = buildUser(ctx.profile);
        if (blocked) {
          return json(
            { valid: false, blocked: true, code: blocked.code, message: blocked.message, cookies: [], user },
            402,
          );
        }
        return json({ valid: true, cookies: ctx.cookies, cookieUpdatedAt: ctx.cookieUpdatedAt, user });
      },

      POST: async ({ request }) => {
        let userId: string | null = null;
        let action: string | null = null;
        try {
          const body = (await request.json()) as {
            userId?: string; user_id?: string; action?: string;
          };
          userId = body.userId ?? body.user_id ?? null;
          action = body.action ?? null;
        } catch { /* ignore */ }

        if (!userId) return json({ valid: false, message: "Missing userId", cookies: [], user: null }, 401);

        const ctx = await loadContext(userId);
        if (!ctx.profile) return json({ valid: false, message: "Invalid user", cookies: [], user: null }, 401);

        const blocked = gate(ctx.profile);
        if (blocked) {
          return json(
            {
              valid: false, blocked: true, code: blocked.code, message: blocked.message,
              cookies: [], user: buildUser(ctx.profile),
            },
            402,
          );
        }

        // If the extension explicitly reports a usage event, decrement credit and log.
        // action="usage" with optional cost (minutes). Default 1 minute per event.
        if (action === "usage" && !UNLIMITED_PLANS.has((ctx.profile.user_plan ?? "basic").toLowerCase())) {
          const currentCredits = Number(ctx.profile.credits ?? 0);
          const cost = 1;
          const newBalance = Math.max(0, currentCredits - cost);
          await ctx.supabaseAdmin
            .from("profiles")
            .update({ credits: newBalance })
            .eq("user_id", userId);
          await ctx.supabaseAdmin.from("credit_ledger").insert({
            user_id: userId,
            amount: -cost,
            reason: "Extension usage",
            source: "extension",
            balance_after: newBalance,
          });
          const updatedProfile = { ...ctx.profile, credits: newBalance };
          return json({ valid: true, cookies: ctx.cookies, user: buildUser(updatedProfile) });
        }

        return json({ valid: true, cookies: ctx.cookies, user: buildUser(ctx.profile) });
      },
    },
  },
});
