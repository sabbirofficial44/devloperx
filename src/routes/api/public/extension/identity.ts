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

export const Route = createFileRoute("/api/public/extension/identity")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const userId = url.searchParams.get("userId") ?? "";

        if (!userId) return json({ ok: false }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("email, display_name")
          .eq("user_id", userId)
          .maybeSingle();

        if (!profile) return json({ ok: false }, 404);

        return json({
          ok: true,
          fakeEmail: profile.email ?? null,
          fakeName: profile.display_name ?? null,
        });
      },
    },
  },
});
