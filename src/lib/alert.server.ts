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

  let emailOk = false;
  try {
    await sendGmail({ to, subject: `[DeveloperX Alert] ${opts.subject}`, html });
    emailOk = true;
  } catch (e) {
    console.error("alert email send failed", e);
  }

  // Optional Slack webhook — set SLACK_ALERT_WEBHOOK_URL to enable.
  // Uses Slack's Incoming Webhooks format; works with Discord-compatible webhooks too if payload keys match.
  let slackOk: boolean | null = null;
  const slackUrl = process.env.SLACK_ALERT_WEBHOOK_URL?.trim();
  if (slackUrl) {
    slackOk = false;
    try {
      const payload = {
        text: `⚠️ *${opts.subject}*`,
        blocks: [
          { type: "header", text: { type: "plain_text", text: `⚠️ ${opts.subject}`.slice(0, 150) } },
          { type: "section", text: { type: "mrkdwn", text: "```" + opts.message.slice(0, 2800) + "```" } },
          {
            type: "context",
            elements: [
              { type: "mrkdwn", text: `*Kind:* \`${opts.kind}\` · ${new Date().toISOString()} · DeveloperX monitoring` },
            ],
          },
        ],
      };
      const r = await fetch(slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      slackOk = r.ok;
      if (!r.ok) console.error("alert slack webhook failed", r.status, await r.text().catch(() => ""));
    } catch (e) {
      console.error("alert slack webhook error", e);
    }
  }

  if (!emailOk && !slackOk) return { sent: false, reason: "all_channels_failed" };

  await supabaseAdmin.from("alert_log").insert({
    kind: opts.kind,
    subject: opts.subject.slice(0, 300),
    message: opts.message.slice(0, 2000),
    email_ok: emailOk,
    slack_ok: slackOk,
  } as any);



  return { sent: true };
}
