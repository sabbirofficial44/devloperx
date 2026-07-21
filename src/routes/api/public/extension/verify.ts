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

function invalid() {
  return json(
    {
      valid: false,
      message: "Session invalid. Please sign in again.",
      cookies: [],
      user: null,
    },
    401,
  );
}

const UNLIMITED_PLANS = new Set(["unlimited", "ultra", "lifetime"]);

function buildUser(profile: {
  user_id: string;
  email: string | null;
  display_name: string | null;
  credits: number | null;
  user_plan: string | null;
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

function creditBlock(profile: { credits: number | null; user_plan: string | null }) {
  const plan = (profile.user_plan ?? "basic").toLowerCase();
  if (UNLIMITED_PLANS.has(plan)) return null;
  if (Number(profile.credits ?? 0) <= 0) {
    return "Credits exhausted — buy more via WhatsApp 01410014442.";
  }
  return null;
}

async function verifyFromRequest(request: Request) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let claimedUserId: string | null = null;
  let accessToken: string | null = null;

  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) accessToken = auth.slice(7).trim();

  try {
    if (request.method !== "GET") {
      const body = (await request.clone().json()) as {
        accessToken?: string;
        access_token?: string;
        userId?: string;
        user_id?: string;
      };
      accessToken = accessToken ?? body.accessToken ?? body.access_token ?? null;
      claimedUserId = body.userId ?? body.user_id ?? null;
    }
  } catch {
    // ignore
  }

  const url = new URL(request.url);
  claimedUserId = claimedUserId ?? url.searchParams.get("userId") ?? url.searchParams.get("user_id");
  accessToken = accessToken ?? url.searchParams.get("accessToken");

  // Bearer token is required — client-supplied userId alone is not proof of ownership.
  if (!accessToken) return invalid();
  const { data: tokenData } = await supabaseAdmin.auth.getUser(accessToken);
  const userId = tokenData.user?.id ?? null;
  if (!userId) return invalid();
  if (claimedUserId && claimedUserId !== userId) return invalid();

  // Start the trial timer on first extension login (idempotent).
  await supabaseAdmin.rpc("start_trial_if_needed", { _user_id: userId });
  // Real-time trial burn: decrement credits by minutes elapsed since last tick.
  await supabaseAdmin.rpc("tick_trial_credits", { _user_id: userId });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id, email, display_name, credits, user_plan, assigned_cookies")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) return invalid();

  const user = buildUser(profile);
  const blocked = creditBlock(profile);
  if (blocked) {
    return json(
      {
        valid: false,
        blocked: true,
        disabled: true,
        message: blocked,
        cookies: [],
        user,
        encryptedCookies: null,
        veoSettings: { veoFastEnabled: true, veoLowerEnabled: true },
      },
      402,
    );
  }

  let cookies: unknown[] = Array.isArray(profile.assigned_cookies)
    ? (profile.assigned_cookies as unknown[])
    : [];
  if (cookies.length === 0) {
    const { data: cookieRow } = await supabaseAdmin
      .from("session_cookies")
      .select("cookies")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    cookies = (cookieRow?.cookies as unknown[] | null) ?? [];
  }

  return json({
    valid: true,
    cookies,
    user,
    encryptedCookies: null,
    disabled: false,
    veoSettings: { veoFastEnabled: true, veoLowerEnabled: true },
  });
}

export const Route = createFileRoute("/api/public/extension/verify")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => verifyFromRequest(request),
      POST: async ({ request }) => verifyFromRequest(request),
    },
  },
});
