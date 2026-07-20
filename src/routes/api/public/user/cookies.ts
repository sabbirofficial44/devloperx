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

export const Route = createFileRoute("/api/public/user/cookies")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async () => {
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
          return json({
            cookies: [],
            encryptedCookies: null,
            disabled: false,
            totalCookies: 0,
            lastUpdated: null,
            veoSettings: { veoFastEnabled: true, veoLowerEnabled: true },
            error: (error as Error).message,
          });
        }
      },
      POST: async ({ request }) => {
        try {
          const body = (await request.json()) as { cookies?: unknown };
          const cookies = Array.isArray(body?.cookies) ? body.cookies : [];
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
