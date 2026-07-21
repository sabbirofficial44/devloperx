import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders, json, requireAuthUserId } from "../_auth";

export const Route = createFileRoute("/api/public/extension/deduct")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let body: {
          userId?: string;
          user_id?: string;
          amount?: number;
          reason?: string;
          source?: string;
          metadata?: Record<string, unknown>;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const claimed = body.userId ?? body.user_id;
        const auth = await requireAuthUserId(request, claimed);
        if ("response" in auth) return auth.response;
        const userId = auth.userId;
        const amount = Math.max(1, Math.floor(Number(body.amount ?? 1)));
        const reason = (body.reason ?? "generation").toString().slice(0, 200);
        const source = (body.source ?? "extension").toString().slice(0, 60);
        const metadata: Record<string, unknown> =
          body.metadata && typeof body.metadata === "object" ? body.metadata : {};

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: profile, error: readErr } = await supabaseAdmin
          .from("profiles")
          .select("credits")
          .eq("user_id", userId)
          .maybeSingle();
        if (readErr) return json({ error: readErr.message }, 500);
        if (!profile) return json({ error: "User not found" }, 404);

        const current = Number(profile.credits ?? 0);
        if (current < amount) {
          await supabaseAdmin.from("credit_ledger").insert({
            user_id: userId,
            amount: 0,
            reason: `insufficient: ${reason}`,
            source,
            metadata: metadata as never,
            balance_after: current,
          });
          return json(
            { success: false, error: "Insufficient credits", creditsLeft: current },
            402,
          );
        }
        const next = current - amount;
        const { error: upErr } = await supabaseAdmin
          .from("profiles")
          .update({ credits: next })
          .eq("user_id", userId);
        if (upErr) return json({ error: upErr.message }, 500);
        await supabaseAdmin.from("credit_ledger").insert({
          user_id: userId,
          amount: -amount,
          reason,
          source,
          metadata: metadata as never,
          balance_after: next,
        });
        return json({ success: true, deducted: amount, creditsLeft: next });
      },
    },
  },
});
