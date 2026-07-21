import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, json, requireAuthUserId } from "./_auth";

function getUserIdFromUrl(request: Request): string | null {
  const url = new URL(request.url);
  return url.searchParams.get("userId") ?? url.searchParams.get("user_id");
}

export const Route = createFileRoute("/api/public/credits")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async ({ request }) => {
        const claimed = getUserIdFromUrl(request);
        const auth = await requireAuthUserId(request, claimed);
        if ("response" in auth) return auth.response;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("credits")
          .eq("user_id", auth.userId)
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
        const claimed = body.userId ?? body.user_id ?? getUserIdFromUrl(request);
        const auth = await requireAuthUserId(request, claimed);
        if ("response" in auth) return auth.response;
        // Users are not allowed to set their own credits from a public endpoint.
        // Only admins may adjust credits — that flow uses the authenticated
        // server function `flow-admin.functions.ts`.
        return json({ error: "Forbidden" }, 403);
      },
    },
  },
});
