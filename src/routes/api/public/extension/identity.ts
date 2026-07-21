import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, json, requireAuthUserId } from "../_auth";

export const Route = createFileRoute("/api/public/extension/identity")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const claimed = url.searchParams.get("userId");
        const auth = await requireAuthUserId(request, claimed);
        if ("response" in auth) return auth.response;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("email, display_name")
          .eq("user_id", auth.userId)
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
