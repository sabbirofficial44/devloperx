import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const bodySchema = z.object({
  email: z.string().email(),
});

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

function buildEmailHtml(link: string, logoUrl: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;color:#e5e7eb;">
    <div style="text-align:center;margin-bottom:32px;">
      <img src="${logoUrl}" alt="DeveloperX" width="120" height="120" style="display:inline-block;border-radius:24px;box-shadow:0 12px 40px rgba(240,185,11,0.35);background:#0b0f19;" />
      <h1 style="margin:20px 0 6px;font-size:26px;color:#fff;letter-spacing:-0.5px;">Confirm your email</h1>
      <p style="margin:0;color:#9ca3af;font-size:14px;">Welcome to DeveloperX — one click to activate your account.</p>
    </div>
    <div style="background:linear-gradient(135deg,rgba(240,185,11,0.08),rgba(255,255,255,0.03));border:1px solid rgba(240,185,11,0.25);border-radius:20px;padding:32px;text-align:center;">
      <a href="${link}" style="display:inline-block;padding:16px 40px;background:linear-gradient(135deg,#f0b90b,#f59e0b);color:#0b0f19;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;box-shadow:0 8px 24px rgba(240,185,11,0.4);">✓ Confirm Email</a>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px;">Or paste this link in your browser:<br><span style="color:#f0b90b;word-break:break-all;">${link}</span></p>
    </div>
    <p style="margin-top:24px;text-align:center;color:#6b7280;font-size:12px;">Link expires in 24 hours. If you didn't sign up, ignore this email.<br>© DeveloperX</p>
  </div></body></html>`;
}

export const Route = createFileRoute("/api/public/auth/send-verification")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      POST: async ({ request }) => {
        let body: z.infer<typeof bodySchema>;
        try {
          body = bodySchema.parse(await request.json());
        } catch {
          return json({ ok: false, message: "Invalid email" }, 400);
        }
        const email = body.email.trim().toLowerCase();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Look up user by email via admin listUsers
        const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
          page: 1,
          perPage: 200,
        });
        if (listErr) return json({ ok: false, message: "Lookup failed" }, 500);
        const user = list.users.find((u) => (u.email ?? "").toLowerCase() === email);
        if (!user) return json({ ok: true }); // silent success (don't leak existence)

        if (user.email_confirmed_at) {
          return json({ ok: true, alreadyConfirmed: true });
        }

        // Create token
        const token = randomToken();
        await supabaseAdmin.from("email_verifications").insert({
          user_id: user.id,
          email,
          token,
        });

        const origin = publicOrigin(request);
        const logoUrl = `${origin}/developerx-logo.png`;
        const link2 = `${origin}/api/public/auth/confirm?token=${token}`;
        try {
          const { sendGmail } = await import("@/lib/send-mail.server");
          await sendGmail({
            to: email,
            subject: "Confirm your DeveloperX account",
            html: buildEmailHtml(link2, logoUrl),
          });
        } catch (e) {
          console.error("[send-verification] SMTP error:", e);
          return json({ ok: false, message: "Could not send email" }, 500);
        }

        return json({ ok: true });
      },
    },
  },
});
