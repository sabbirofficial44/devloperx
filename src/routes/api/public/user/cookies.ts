import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, json, requireAuthUserId } from "../_auth";

// Session cookie pool. GET requires an authenticated user (extension callers).
// POST (upload) requires an admin.

export const Route = createFileRoute("/api/public/user/cookies")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const auth = await requireAuthUserId(request);
        if ("response" in auth) return auth.response;
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("session_cookies")
            .select("cookies, total_cookies, updated_at")
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const cookies = (data?.cookies as unknown[] | null) ?? [];
          return json({
            cookies,
            encryptedCookies: null,
            disabled: false,
            totalCookies: data?.total_cookies ?? cookies.length,
            lastUpdated: data?.updated_at ?? null,
            veoSettings: { veoFastEnabled: true, veoLowerEnabled: true },
          });
        } catch (error) {
          return json({ error: (error as Error).message }, 500);
        }
      },
      POST: async ({ request }) => {
        const auth = await requireAuthUserId(request);
        if ("response" in auth) return auth.response;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
          _user_id: auth.userId,
          _role: "admin",
        });
        if (!isAdmin) return json({ error: "Forbidden" }, 403);
        try {
          const body = (await request.json()) as { cookies?: unknown };
          const cookies = Array.isArray(body?.cookies) ? body.cookies : [];
          const { error } = await supabaseAdmin.from("session_cookies").insert({
            cookies,
            total_cookies: cookies.length,
          });
          if (error) return json({ error: error.message }, 500);
          return json({ success: true, count: cookies.length });
        } catch (error) {
          return json({ error: (error as Error).message }, 500);
        }
      },
    },
  },
});
