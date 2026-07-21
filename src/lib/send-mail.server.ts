// Server-only Gmail SMTP sender via worker-mailer (Cloudflare Workers TCP sockets).
import { WorkerMailer } from "worker-mailer";

export async function sendGmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const user = process.env.GMAIL_SMTP_USER;
  const pass = process.env.GMAIL_SMTP_PASS;
  const fromName = process.env.GMAIL_FROM_NAME || "DeveloperX";
  if (!user || !pass) throw new Error("Gmail SMTP not configured");

  const mailer = await WorkerMailer.connect({
    credentials: { username: user, password: pass },
    authType: "login",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
  });

  await mailer.send({
    from: { name: fromName, email: user },
    to: { email: opts.to },
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
  });
}
