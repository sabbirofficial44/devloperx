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

function getUserIdFromUrl(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("userId") ?? url.searchParams.get("user_id");
}

export const Route = createFileRoute("/api/public/credits")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async ({ request }) => {
        const userId = getUserIdFromUrl(request);
        if (!userId) return json({ credits: 0 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("credits")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) return json({ error: error.message }, 500);
        return json({ credits: Number(data?.credits ?? 0) });
      },

      POST: async ({ request }) => {
        let body: { userId?: string; user_id?: string; credits?: number };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const userId = body.userId ?? body.user_id ?? getUserIdFromUrl(request);
        const credits = body.credits;
        if (typeof credits !== "number" || credits < 0) {
          return json({ error: "Invalid credits" }, 400);
        }
        if (!userId) return json({ error: "Missing userId" }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({ credits })
          .eq("user_id", userId);
        if (error) return json({ error: error.message }, 500);
        return json({ success: true, credits });
      },
    },
  },
});
