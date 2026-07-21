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

function buildEmailHtml(link: string) {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;color:#e5e7eb;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;width:64px;height:64px;border-radius:16px;background:linear-gradient(135deg,#a855f7,#ec4899);line-height:64px;font-size:28px;font-weight:800;color:#fff;">D</div>
      <h1 style="margin:16px 0 4px;font-size:24px;color:#fff;">Confirm your email</h1>
      <p style="margin:0;color:#9ca3af;font-size:14px;">Welcome to DeveloperX — one click to activate your account.</p>
    </div>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px;text-align:center;">
      <p style="margin:0 0 24px;color:#d1d5db;font-size:15px;line-height:1.6;">
        Click the button below to verify your email and activate your DeveloperX account.
      </p>
      <a href="${link}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px;">
        ✓ Confirm Email
      </a>
      <p style="margin:24px 0 0;color:#6b7280;font-size:12px;">
        Or paste this link in your browser:<br>
        <span style="color:#a78bfa;word-break:break-all;">${link}</span>
      </p>
    </div>
    <p style="margin-top:24px;text-align:center;color:#6b7280;font-size:12px;">
      This link expires in 24 hours. If you didn't sign up, ignore this email.
    </p>
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

        const origin = new URL(request.url).origin;
        const link = `${origin}/api/public/auth/confirm?token=${token}`;

        try {
          const { sendGmail } = await import("@/lib/send-mail.server");
          await sendGmail({
            to: email,
            subject: "Confirm your DeveloperX account",
            html: buildEmailHtml(link),
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
