import { createFileRoute } from "@tanstack/react-router";

function page(title: string, body: string, ok: boolean, logoUrl: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:radial-gradient(ellipse at top,#1a1230 0%,#0b0f19 60%);color:#e5e7eb;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
  <div style="max-width:440px;width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(240,185,11,0.25);border-radius:24px;padding:40px;text-align:center;backdrop-filter:blur(20px);box-shadow:0 20px 60px rgba(0,0,0,0.5);">
    <img src="${logoUrl}" alt="DeveloperX" width="96" height="96" style="display:inline-block;margin-bottom:20px;border-radius:20px;box-shadow:0 8px 30px rgba(240,185,11,0.35);" />
    <div style="width:64px;height:64px;margin:0 auto 20px;border-radius:16px;background:linear-gradient(135deg,${ok ? "#22c55e,#10b981" : "#ef4444,#f97316"});display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff;">${ok ? "✓" : "✕"}</div>
    <h1 style="margin:0 0 12px;font-size:24px;color:#fff;">${title}</h1>
    <p style="margin:0 0 28px;color:#9ca3af;font-size:15px;line-height:1.6;">${body}</p>
    <a href="/auth" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f0b90b,#f59e0b);color:#0b0f19;text-decoration:none;border-radius:12px;font-weight:700;box-shadow:0 8px 24px rgba(240,185,11,0.35);">Go to Sign In →</a>
  </div>
</body></html>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function publicOrigin(request: Request): string {
  const envUrl = process.env.PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");
  const fwdHost = request.headers.get("x-forwarded-host");
  const fwdProto = request.headers.get("x-forwarded-proto") ?? "https";
  if (fwdHost) return `${fwdProto}://${fwdHost}`;
  const u = new URL(request.url);
  if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
    return "https://id-preview--306a4997-5830-492f-b8db-9bb0ab4aee1f.lovable.app";
  }
  return u.origin;
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
