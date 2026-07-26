// Server-only alerting helper.
// Sends an email via Gmail SMTP, throttled per-kind to avoid spam.

import { sendGmail } from "./send-mail.server";

const THROTTLE_MS = 15 * 60 * 1000; // 15 min per kind

function alertRecipient(): string {
  return (
    process.env.ALERT_EMAIL?.trim() ||
    process.env.GMAIL_SMTP_USER?.trim() ||
    ""
  );
}

export async function sendAlert(opts: {
  kind: string;
  subject: string;
  message: string;
  throttleMs?: number;
}): Promise<{ sent: boolean; reason?: string }> {
  const to = alertRecipient();
  if (!to) return { sent: false, reason: "no_recipient" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const throttle = opts.throttleMs ?? THROTTLE_MS;

  const { data: last } = await supabaseAdmin
    .from("alert_log")
    .select("created_at")
    .eq("kind", opts.kind)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (last?.created_at) {
    const age = Date.now() - new Date(last.created_at).getTime();
    if (age < throttle) return { sent: false, reason: "throttled" };
  }

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:560px">
      <h2 style="color:#b91c1c;margin:0 0 12px">⚠️ ${opts.subject}</h2>
      <p style="white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px;font-family:ui-monospace,monospace;font-size:13px">${opts.message}</p>
      <p style="color:#666;font-size:12px">Kind: <code>${opts.kind}</code> · ${new Date().toISOString()}</p>
      <p style="color:#666;font-size:12px">DeveloperX monitoring · you'll get at most one alert per 15 min per kind.</p>
    </div>
  `;

  try {
    await sendGmail({ to, subject: `[DeveloperX Alert] ${opts.subject}`, html });
  } catch (e) {
    console.error("alert send failed", e);
    return { sent: false, reason: "smtp_error" };
  }

  await supabaseAdmin.from("alert_log").insert({
    kind: opts.kind,
    message: opts.message.slice(0, 2000),
  });

  return { sent: true };
}
