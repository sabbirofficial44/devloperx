import { createFileRoute } from "@tanstack/react-router";

function page(title: string, body: string, ok: boolean) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b0f19;color:#e5e7eb;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
  <div style="max-width:440px;width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:40px;text-align:center;backdrop-filter:blur(20px);">
    <div style="width:72px;height:72px;margin:0 auto 20px;border-radius:20px;background:linear-gradient(135deg,${ok ? "#22c55e,#10b981" : "#ef4444,#f97316"});display:flex;align-items:center;justify-content:center;font-size:36px;">${ok ? "✓" : "✕"}</div>
    <h1 style="margin:0 0 12px;font-size:24px;color:#fff;">${title}</h1>
    <p style="margin:0 0 28px;color:#9ca3af;font-size:15px;line-height:1.6;">${body}</p>
    <a href="/auth" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">Go to Sign In →</a>
  </div>
</body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/public/auth/confirm")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = new URL(request.url).searchParams.get("token");
        if (!token) return page("Invalid link", "This confirmation link is missing a token.", false);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("email_verifications")
          .select("id, user_id, email, expires_at, used_at")
          .eq("token", token)
          .maybeSingle();

        if (!row) return page("Invalid link", "This confirmation link is invalid or has already been used.", false);
        if (row.used_at) return page("Already confirmed", "Your email is already verified. You can sign in now.", true);
        if (new Date(row.expires_at).getTime() < Date.now())
          return page("Link expired", "This confirmation link has expired. Please request a new one from the sign-in page.", false);

        // Confirm the user
        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
          email_confirm: true,
        });
        if (updErr) return page("Something went wrong", updErr.message, false);

        await supabaseAdmin
          .from("email_verifications")
          .update({ used_at: new Date().toISOString() })
          .eq("id", row.id);

        return page("Email confirmed ✓", "Your DeveloperX account is now active. You can sign in.", true);
      },
    },
  },
});
