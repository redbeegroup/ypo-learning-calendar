import { env } from "@/server/env";
import type { Email } from "@/server/email/sender";

function layout(title: string, body: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
  <div style="background:#1e3a8a;color:#fff;padding:16px 24px;font-size:18px;font-weight:bold">YPO SEA Learning Calendar</div>
  <div style="padding:24px;border:1px solid #e2e8f0;border-top:0">
    <h2 style="margin-top:0;color:#1e3a8a">${title}</h2>
    ${body}
  </div>
</div>`;
}

function button(href: string, label: string): string {
  return `<p><a href="${href}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">${label}</a></p>`;
}

export function inviteEmail(to: string, name: string, token: string, chapterName: string): Email {
  const url = `${env.appUrl}/invite/${token}`;
  return {
    to,
    subject: "You are invited to the YPO SEA Learning Calendar",
    text: `Hi ${name},\n\nYou have been added to the YPO SEA Learning Calendar as a member of ${chapterName}. Set your password here (link valid for 7 days):\n${url}\n`,
    html: layout(
      "Welcome",
      `<p>Hi ${name},</p><p>You have been added to the YPO SEA Learning Calendar as a member of <strong>${chapterName}</strong>.</p>${button(url, "Set your password")}<p style="color:#64748b;font-size:12px">This link is valid for 7 days.</p>`,
    ),
  };
}

export function resetPasswordEmail(to: string, name: string, token: string): Email {
  const url = `${env.appUrl}/reset-password/${token}`;
  return {
    to,
    subject: "Reset your YPO SEA Learning Calendar password",
    text: `Hi ${name},\n\nReset your password here (link valid for 1 hour):\n${url}\n\nIf you did not request this, ignore this email.\n`,
    html: layout(
      "Reset your password",
      `<p>Hi ${name},</p>${button(url, "Reset password")}<p style="color:#64748b;font-size:12px">This link is valid for 1 hour. If you did not request this, ignore this email.</p>`,
    ),
  };
}
