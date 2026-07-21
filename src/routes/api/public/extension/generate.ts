import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, json, requireAuthUserId } from "../_auth";

export const Route = createFileRoute("/api/public/extension/generate")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let claimed: string | null = null;
        try {
          const body = (await request.json()) as { userId?: string; user_id?: string };
          claimed = body.userId ?? body.user_id ?? null;
        } catch {
          /* ignore */
        }
        const auth = await requireAuthUserId(request, claimed);
        if ("response" in auth) return auth.response;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("profiles")
          .select("credits")
          .eq("user_id", auth.userId)
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
