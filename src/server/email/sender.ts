import nodemailer from "nodemailer";
import { env } from "@/server/env";

export type Email = { to: string; subject: string; text: string; html: string };

export interface EmailSender {
  send(email: Email): Promise<void>;
}

class SmtpSender implements EmailSender {
  private transport = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
  });

  async send(email: Email) {
    await this.transport.sendMail({ from: env.smtp.from, ...email });
  }
}

/** Tests replace this with an in-memory sender. */
let current: EmailSender | null = null;

export function getEmailSender(): EmailSender {
  return (current ??= new SmtpSender());
}

export function setEmailSender(sender: EmailSender | null) {
  current = sender;
}

export async function sendEmail(email: Email) {
  await getEmailSender().send(email);
}
