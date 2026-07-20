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

export const Route = createFileRoute("/api/public/extension/generate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let userId: string | null = null;
        try {
          const body = (await request.json()) as { userId?: string; user_id?: string };
          userId = body.userId ?? body.user_id ?? null;
        } catch {
          /* ignore */
        }
        if (!userId) {
          return json({
            success: true,
            creditsLeft: 99999,
            message: "Mock generation (no user id provided)",
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("profiles")
          .select("credits")
          .eq("user_id", userId)
          .maybeSingle();
        return json({
          success: true,
          creditsLeft: Number(data?.credits ?? 0),
          message: "Generation successful",
        });
      },
    },
  },
});
