import { env } from "@/server/env";
import type { Email } from "@/server/email/sender";
import { formatEventRange } from "@/lib/dates";

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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function inviteEmail(to: string, name: string, token: string, chapterName: string): Email {
  const url = `${env.appUrl}/invite/${token}`;
  return {
    to,
    subject: "You are invited to the YPO SEA Learning Calendar",
    text: `Hi ${name},\n\nYou have been added to the YPO SEA Learning Calendar as a member of ${chapterName}. Set your password here (link valid for 7 days):\n${url}\n`,
    html: layout(
      "Welcome",
      `<p>Hi ${escapeHtml(name)},</p><p>You have been added to the YPO SEA Learning Calendar as a member of <strong>${escapeHtml(chapterName)}</strong>.</p>${button(url, "Set your password")}<p style="color:#64748b;font-size:12px">This link is valid for 7 days.</p>`,
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
      `<p>Hi ${escapeHtml(name)},</p>${button(url, "Reset password")}<p style="color:#64748b;font-size:12px">This link is valid for 1 hour. If you did not request this, ignore this email.</p>`,
    ),
  };
}

export type EventSummary = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  venue: string;
  isOnline: boolean;
  onlineUrl: string | null;
  paymentType: "FREE" | "PAID";
  price: { toString(): string } | number | null;
  currency: string | null;
  paymentInstructions: string | null;
  paymentUrl: string | null;
};

function eventLines(event: EventSummary): { text: string; html: string } {
  const when = formatEventRange(event.startAt, event.endAt, event.timezone);
  const where = event.isOnline ? `Online${event.onlineUrl ? ` – ${event.onlineUrl}` : ""}` : event.venue || "Venue to be announced";
  const url = `${env.appUrl}/events/${event.id}`;
  let payText = "";
  let payHtml = "";
  if (event.paymentType === "PAID") {
    const amount = `${event.currency ?? ""} ${event.price?.toString() ?? ""}`.trim();
    payText = `\nThis is a paid event: ${amount}.${event.paymentInstructions ? `\n${event.paymentInstructions}` : ""}${event.paymentUrl ? `\nPay here: ${event.paymentUrl}` : ""}\n`;
    payHtml = `<div style="background:#fffbeb;border:1px solid #fcd34d;padding:12px;border-radius:6px;margin:12px 0"><strong>Paid event: ${escapeHtml(amount)}</strong>${event.paymentInstructions ? `<p style="white-space:pre-line;margin:8px 0 0">${escapeHtml(event.paymentInstructions)}</p>` : ""}${event.paymentUrl ? `<p style="margin:8px 0 0"><a href="${event.paymentUrl}">Payment link</a></p>` : ""}</div>`;
  }
  return {
    text: `${event.title}\nWhen: ${when}\nWhere: ${where}\n${payText}\nView event: ${url}\n`,
    html: `<p><strong>${escapeHtml(event.title)}</strong><br>When: ${escapeHtml(when)}<br>Where: ${escapeHtml(where)}</p>${payHtml}${button(url, "View event")}`,
  };
}

export function registrationEmail(to: string, name: string, event: EventSummary, status: "REGISTERED" | "WAITLISTED"): Email {
  const lines = eventLines(event);
  if (status === "REGISTERED") {
    return {
      to,
      subject: `You're registered: ${event.title}`,
      text: `Hi ${name},\n\nYou are registered for:\n\n${lines.text}`,
      html: layout("You're registered", `<p>Hi ${escapeHtml(name)},</p><p>You are registered for:</p>${lines.html}`),
    };
  }
  return {
    to,
    subject: `You're on the waitlist: ${event.title}`,
    text: `Hi ${name},\n\nThis event is full, so you are on the waitlist. We will email you if a spot opens up.\n\n${lines.text}`,
    html: layout(
      "You're on the waitlist",
      `<p>Hi ${escapeHtml(name)},</p><p>This event is full, so you are on the waitlist. We will email you if a spot opens up.</p>${lines.html}`,
    ),
  };
}

export function promotedEmail(to: string, name: string, event: EventSummary): Email {
  const lines = eventLines(event);
  return {
    to,
    subject: `A spot opened up: ${event.title}`,
    text: `Hi ${name},\n\nGood news: a spot opened up and you are now registered for:\n\n${lines.text}`,
    html: layout(
      "A spot opened up",
      `<p>Hi ${escapeHtml(name)},</p><p>Good news: a spot opened up and you are now registered for:</p>${lines.html}`,
    ),
  };
}
