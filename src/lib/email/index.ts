import { getEnv } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Provider-agnostic mail sender. `console` prints to the server log (development); `resend` uses
 * Resend's HTTP API. Adding SMTP later means adding one more branch here — callers don't change.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = getEnv();

  if (env.EMAIL_PROVIDER === "console") {
    console.info(`\n──── email (console provider) ────\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n──────────────────────────────────\n`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: message.to, subject: message.subject, text: message.text, html: message.html }),
  });
  if (!res.ok) {
    throw new Error(`Email provider responded ${res.status}`);
  }
}

export function passwordResetEmail(name: string, url: string): Omit<EmailMessage, "to"> {
  return {
    subject: "Reset your LifeOS password",
    text: `Hi ${name},\n\nUse this link to choose a new password. It expires in 30 minutes and can be used once:\n\n${url}\n\nIf you didn't ask for this, you can ignore this email — your password won't change.\n`,
  };
}
