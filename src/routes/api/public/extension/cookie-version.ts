import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

async function versionResponse() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("session_cookies")
    .select("id, total_cookies, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return new Response(JSON.stringify({
    version: data?.updated_at ?? "0",
    updatedAt: data?.updated_at ?? null,
    totalCookies: data?.total_cookies ?? 0,
    cookieSetId: data?.id ?? null,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export const Route = createFileRoute("/api/public/extension/cookie-version")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      GET: async () => versionResponse(),
      POST: async () => versionResponse(),
    },
  },
});
