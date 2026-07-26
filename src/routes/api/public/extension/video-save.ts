import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const Body = z.object({
  accessToken: z.string().optional(),
  access_token: z.string().optional(),
  prompt: z.string().max(4000).optional().nullable(),
  videoUrl: z.string().url().max(4000).optional().nullable(),
  thumbnailUrl: z.string().url().max(4000).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  status: z.string().max(40).optional().nullable(),
  externalId: z.string().max(200).optional().nullable(),
});

export const Route = createFileRoute("/api/public/extension/video-save")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return json({ ok: false, error: "Invalid payload" }, 400);
        }
        const auth = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
        const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
        const accessToken = bearer ?? body.accessToken ?? body.access_token ?? null;
        if (!accessToken) return json({ ok: false, error: "Unauthorized" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tokenData } = await supabaseAdmin.auth.getUser(accessToken);
        const userId = tokenData.user?.id ?? null;
        if (!userId) return json({ ok: false, error: "Unauthorized" }, 401);

        // Per-user write throttle: a leaked token could otherwise flood the
        // dashboard's video history with arbitrary rows.
        const { checkRateLimit } = await import("@/lib/rate-limit.server");
        const gate = await checkRateLimit({
          bucket: "video-save",
          key: userId,
          limit: 60,
          windowSec: 300,
        });
        if (!gate.allowed) return json({ ok: false, error: "Too many saves. Slow down." }, 429);

        const row = {
          user_id: userId,
          prompt: body.prompt ?? null,
          video_url: body.videoUrl ?? null,
          thumbnail_url: body.thumbnailUrl ?? null,
          model: body.model ?? null,
          status: body.status ?? "completed",
          source: "flow",
          external_id: body.externalId ?? null,
        };


        // Upsert on (user_id, external_id) when external_id given, otherwise plain insert
        if (row.external_id) {
          const { error } = await supabaseAdmin
            .from("video_history")
            .upsert(row, { onConflict: "user_id,external_id" });
          if (error) return json({ ok: false, error: error.message }, 500);
        } else {
          const { error } = await supabaseAdmin.from("video_history").insert(row);
          if (error) return json({ ok: false, error: error.message }, 500);
        }
        return json({ ok: true });
      },
    },
  },
});
