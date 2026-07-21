import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const schema = z.object({ email: z.string().email() });

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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

function buildEmailHtml(link: string, name: string, logoUrl: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;color:#e5e7eb;">
    <div style="text-align:center;margin-bottom:32px;">
      <img src="${logoUrl}" alt="DeveloperX" width="120" height="120" style="display:inline-block;border-radius:24px;box-shadow:0 12px 40px rgba(240,185,11,0.35);background:#0b0f19;" />
      <h1 style="margin:20px 0 6px;font-size:26px;color:#fff;letter-spacing:-0.5px;">Reset your password</h1>
      <p style="margin:0;color:#9ca3af;font-size:14px;">Hi ${name}, click the button below to choose a new password.</p>
    </div>
    <div style="background:linear-gradient(135deg,rgba(124,92,252,0.10),rgba(255,255,255,0.03));border:1px solid rgba(124,92,252,0.30);border-radius:20px;padding:32px;text-align:center;">
      <a href="${link}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#7c5cfc,#a78bfa);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;box-shadow:0 8px 24px rgba(124,92,252,0.4);">🔑 Reset Password</a>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px;">Or paste this link in your browser:<br><span style="color:#a78bfa;word-break:break-all;">${link}</span></p>
    </div>
    <p style="margin-top:24px;text-align:center;color:#6b7280;font-size:12px;">Link expires in 1 hour. Didn't request this? Ignore this email — your password stays the same.<br>© DeveloperX</p>
  </div></body></html>`;
}

export const Route = createFileRoute("/api/public/auth/reset-request")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        let body: z.infer<typeof schema>;
        try {
          body = schema.parse(await request.json());
        } catch {
          return json({ ok: false, message: "Invalid email" }, 400);
        }
        const email = body.email.trim().toLowerCase();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Look up user (silent success either way to prevent enumeration)
        const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const user = existing.users.find((u) => (u.email ?? "").toLowerCase() === email);

        if (user) {
          const origin = publicOrigin(request);
          const logoUrl = `${origin}/developerx-logo.png`;
          const token = randomToken();
          await (supabaseAdmin as any).from("password_resets").insert({ user_id: user.id, email, token });
          const link = `${origin}/api/public/auth/reset?token=${token}`;
          const name =
            (user.user_metadata?.display_name as string) ||
            (user.user_metadata?.full_name as string) ||
            email.split("@")[0];
          try {
            const { sendGmail } = await import("@/lib/send-mail.server");
            await sendGmail({
              to: email,
              subject: "Reset your DeveloperX password",
              html: buildEmailHtml(link, name, logoUrl),
            });
          } catch (e) {
            console.error("[reset-request] SMTP error:", e);
            return json({ ok: false, message: "Could not send reset email. Try again later." }, 500);
          }
        }
        // Always return ok to prevent email enumeration.
        return json({ ok: true });
      },
    },
  },
});
