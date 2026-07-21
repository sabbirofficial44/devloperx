// Shared bearer-token verification for public API endpoints.
// Ensures the caller owns the userId they are acting on.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

/**
 * Verify the request bearer token and return the authenticated userId.
 * If `claimedUserId` is provided, it must match the token's user.
 * Returns either { userId } on success or { response } with an error Response.
 */
export async function requireAuthUserId(
  request: Request,
  claimedUserId?: string | null,
): Promise<{ userId: string } | { response: Response }> {
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const token = auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (!token) {
    return { response: json({ error: "Unauthorized" }, 401) };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  const tokenUserId = data.user?.id ?? null;
  if (error || !tokenUserId) {
    return { response: json({ error: "Invalid token" }, 401) };
  }
  if (claimedUserId && claimedUserId !== tokenUserId) {
    return { response: json({ error: "Forbidden" }, 403) };
  }
  return { userId: tokenUserId };
}
