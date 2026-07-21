import { createFileRoute } from "@tanstack/react-router";

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

function shell(inner: string, title: string, logoUrl: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:radial-gradient(ellipse at top,#1a1230 0%,#0b0f19 60%);color:#e5e7eb;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
  <div style="max-width:440px;width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(124,92,252,0.30);border-radius:24px;padding:36px 32px;text-align:center;backdrop-filter:blur(20px);box-shadow:0 20px 60px rgba(0,0,0,0.5);">
    <img src="${logoUrl}" alt="DeveloperX" width="88" height="88" style="display:inline-block;margin-bottom:18px;border-radius:20px;box-shadow:0 8px 30px rgba(240,185,11,0.35);" />
    ${inner}
  </div>
</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function statusPage(title: string, body: string, ok: boolean, logoUrl: string) {
  return shell(
    `<div style="width:64px;height:64px;margin:0 auto 18px;border-radius:16px;background:linear-gradient(135deg,${ok ? "#22c55e,#10b981" : "#ef4444,#f97316"});display:flex;align-items:center;justify-content:center;font-size:32px;color:#fff;">${ok ? "✓" : "✕"}</div>
     <h1 style="margin:0 0 10px;font-size:22px;color:#fff;">${title}</h1>
     <p style="margin:0 0 24px;color:#9ca3af;font-size:14px;line-height:1.6;">${body}</p>
     <a href="/auth" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f0b90b,#f59e0b);color:#0b0f19;text-decoration:none;border-radius:12px;font-weight:700;box-shadow:0 8px 24px rgba(240,185,11,0.35);">Go to Sign In →</a>`,
    title,
    logoUrl,
    ok ? 200 : 400,
  );
}

function formPage(token: string, logoUrl: string, error?: string) {
  return shell(
    `<h1 style="margin:0 0 6px;font-size:22px;color:#fff;">Choose a new password</h1>
     <p style="margin:0 0 22px;color:#9ca3af;font-size:14px;">At least 6 characters. You'll be signed out of other devices.</p>
     ${error ? `<div style="margin:0 0 14px;padding:10px 12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.35);color:#fca5a5;border-radius:10px;font-size:13px;">${error}</div>` : ""}
     <form method="POST" action="/api/public/auth/reset" style="display:flex;flex-direction:column;gap:12px;text-align:left;">
       <input type="hidden" name="token" value="${token}" />
       <label style="font-size:12px;color:#cbd5e1;font-weight:600;">New password</label>
       <input type="password" name="password" required minlength="6" placeholder="New password" autocomplete="new-password"
         style="padding:14px 14px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#fff;font-size:15px;outline:none;" />
       <label style="font-size:12px;color:#cbd5e1;font-weight:600;">Confirm password</label>
       <input type="password" name="confirm" required minlength="6" placeholder="Repeat password" autocomplete="new-password"
         style="padding:14px 14px;background:rgba(0,0,0,0.35);border:1px solid rgba(255,255,255,0.12);border-radius:12px;color:#fff;font-size:15px;outline:none;" />
       <button type="submit"
         style="margin-top:6px;padding:14px 22px;background:linear-gradient(135deg,#7c5cfc,#a78bfa);color:#fff;border:0;border-radius:12px;font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 8px 24px rgba(124,92,252,0.4);">
         🔑 Update Password
       </button>
     </form>`,
    "Reset password",
    logoUrl,
  );
}

type ResetRow = { id: string; user_id: string; email: string; expires_at: string; used_at: string | null };
async function loadToken(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("password_resets")
    .select("id, user_id, email, expires_at, used_at")
    .eq("token", token)
    .maybeSingle();
  return { row: (data as ResetRow | null), supabaseAdmin };
}

export const Route = createFileRoute("/api/public/auth/reset")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = publicOrigin(request);
        const logoUrl = `${origin}/developerx-logo.png`;
        const token = new URL(request.url).searchParams.get("token");
        if (!token) return statusPage("Invalid link", "This reset link is missing a token.", false, logoUrl);

        const { row } = await loadToken(token);
        if (!row) return statusPage("Invalid link", "This reset link is invalid or has already been used.", false, logoUrl);
        if (row.used_at) return statusPage("Already used", "This reset link has already been used. Request a new one from Sign In.", false, logoUrl);
        if (new Date(row.expires_at).getTime() < Date.now())
          return statusPage("Link expired", "This reset link has expired. Request a new one from the Sign In page.", false, logoUrl);

        return formPage(token, logoUrl);
      },
      POST: async ({ request }) => {
        const origin = publicOrigin(request);
        const logoUrl = `${origin}/developerx-logo.png`;
        const form = await request.formData();
        const token = String(form.get("token") ?? "");
        const password = String(form.get("password") ?? "");
        const confirm = String(form.get("confirm") ?? "");

        if (!token) return statusPage("Invalid request", "Missing token.", false, logoUrl);
        if (password.length < 6) return formPage(token, logoUrl, "Password must be at least 6 characters.");
        if (password !== confirm) return formPage(token, logoUrl, "Passwords do not match.");

        const { row, supabaseAdmin } = await loadToken(token);
        if (!row) return statusPage("Invalid link", "This reset link is invalid or already used.", false, logoUrl);
        if (row.used_at) return statusPage("Already used", "This link has already been used.", false, logoUrl);
        if (new Date(row.expires_at).getTime() < Date.now())
          return statusPage("Link expired", "This reset link has expired.", false, logoUrl);

        const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, { password });
        if (updErr) return statusPage("Something went wrong", updErr.message, false, logoUrl);

        await (supabaseAdmin as any)
          .from("password_resets")
          .update({ used_at: new Date().toISOString() })
          .eq("id", row.id);

        return statusPage(
          "Password updated ✓",
          "Your DeveloperX password has been changed. You can now sign in with your new password.",
          true,
          logoUrl,
        );
      },
    },
  },
});
