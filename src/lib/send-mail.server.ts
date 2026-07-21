// Server-only Gmail SMTP sender via nodemailer.
import nodemailer from "nodemailer";

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

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"${fromName}" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
  });
}
