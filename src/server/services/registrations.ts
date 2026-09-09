import type { PaymentStatus, Registration } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError, forbidden, notFound } from "@/server/api";
import { canManageEvent, canRegisterForEvent, type Actor, type RegisterDenial } from "@/server/permissions";
import { sendEmail } from "@/server/email/sender";
import { registrationEmail } from "@/server/email/templates";
import { eventInclude, toEventDto } from "@/server/services/events";
import { lockEvent, promoteWaitlist, sendPromotionEmails } from "@/server/services/waitlist";
import { formatEventRange } from "@/lib/dates";

const DENIAL_MESSAGES: Record<RegisterDenial, string> = {
  NOT_PUBLISHED: "This event is not open for registration",
  NOT_IN_SCOPE: "This event is not open to members of your chapter",
  NOT_OPEN_YET: "Registration has not opened yet",
  CLOSED: "Registration has closed",
  STARTED: "This event has already started",
};

export function toRegistrationDto(r: Registration) {
  return {
    id: r.id,
    eventId: r.eventId,
    userId: r.userId,
    status: r.status,
    paymentStatus: r.paymentStatus,
    registeredAt: r.registeredAt.toISOString(),
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
  };
}

export async function registerForEvent(actor: Actor, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, include: { chapterAccess: true } });
  if (!event) notFound("Event");
  const check = canRegisterForEvent(actor, {
    status: event.status,
    hostChapterId: event.hostChapterId,
    visibility: event.visibility,
    accessChapterIds: event.chapterAccess.map((a) => a.chapterId),
    startAt: event.startAt,
    registrationOpensAt: event.registrationOpensAt,
    registrationClosesAt: event.registrationClosesAt,
  });
  if (!check.ok) throw new ApiError(403, check.reason, DENIAL_MESSAGES[check.reason]);

  const registration = await prisma.$transaction(async (tx) => {
    await lockEvent(tx, eventId);
    const existing = await tx.registration.findUnique({
      where: { eventId_userId: { eventId, userId: actor.id } },
    });
    if (existing && existing.status !== "CANCELLED") {
      throw new ApiError(409, "ALREADY_REGISTERED", "You are already registered for this event");
    }
    const registered = await tx.registration.count({ where: { eventId, status: "REGISTERED" } });
    const status = event.capacity === null || registered < event.capacity ? "REGISTERED" : "WAITLISTED";
    const paymentStatus: PaymentStatus = event.paymentType === "PAID" ? "PENDING" : "NOT_REQUIRED";
    const data = { status, paymentStatus, registeredAt: new Date(), cancelledAt: null } as const;
    return existing
      ? tx.registration.update({ where: { id: existing.id }, data })
      : tx.registration.create({ data: { eventId, userId: actor.id, ...data } });
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.id } });
  await sendEmail(registrationEmail(user.email, user.name, event, registration.status as "REGISTERED" | "WAITLISTED"));
  return toRegistrationDto(registration);
}

export async function cancelRegistration(actor: Actor, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound("Event");
  if (event.startAt <= new Date()) throw new ApiError(400, "STARTED", "This event has already started");

  const promoted = await prisma.$transaction(async (tx) => {
    await lockEvent(tx, eventId);
    const existing = await tx.registration.findUnique({
      where: { eventId_userId: { eventId, userId: actor.id } },
    });
    if (!existing || existing.status === "CANCELLED") {
      throw new ApiError(404, "NOT_REGISTERED", "You are not registered for this event");
    }
    await tx.registration.update({
      where: { id: existing.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    return existing.status === "REGISTERED" && event.status === "PUBLISHED" ? promoteWaitlist(tx, event) : [];
  });

  await sendPromotionEmails(event, promoted);
  return { cancelled: true, promotedUserIds: promoted.map((u) => u.id) };
}

export async function listMyRegistrations(actor: Actor) {
  const rows = await prisma.registration.findMany({
    where: { userId: actor.id, status: { not: "CANCELLED" } },
    include: { event: { include: eventInclude(actor.id) } },
    orderBy: { event: { startAt: "asc" } },
  });
  const now = new Date();
  const items = rows.map((r) => ({ ...toRegistrationDto(r), event: toEventDto(r.event, actor) }));
  return {
    upcoming: items.filter((i) => new Date(i.event.endAt) >= now),
    past: items.filter((i) => new Date(i.event.endAt) < now).reverse(),
  };
}

const attendeeInclude = {
  user: { select: { id: true, name: true, email: true, chapter: { select: { name: true } } } },
} as const;

export type Attendee = {
  id: string;
  status: Registration["status"];
  paymentStatus: PaymentStatus;
  registeredAt: string;
  cancelledAt: string | null;
  user: { id: string; name: string; email: string; chapterName: string };
};

export async function listEventRegistrations(actor: Actor, eventId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound("Event");
  if (!canManageEvent(actor, event)) forbidden();
  const rows = await prisma.registration.findMany({
    where: { eventId },
    include: attendeeInclude,
    orderBy: { registeredAt: "asc" },
  });
  const attendees: Attendee[] = rows.map((r) => ({
    id: r.id,
    status: r.status,
    paymentStatus: r.paymentStatus,
    registeredAt: r.registeredAt.toISOString(),
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    user: { id: r.user.id, name: r.user.name, email: r.user.email, chapterName: r.user.chapter.name },
  }));
  return {
    registered: attendees.filter((a) => a.status === "REGISTERED"),
    waitlisted: attendees.filter((a) => a.status === "WAITLISTED"),
    cancelled: attendees.filter((a) => a.status === "CANCELLED"),
  };
}

export async function setPaymentStatus(actor: Actor, registrationId: string, paymentStatus: PaymentStatus) {
  const reg = await prisma.registration.findUnique({ where: { id: registrationId }, include: { event: true } });
  if (!reg) notFound("Registration");
  if (!canManageEvent(actor, reg.event)) forbidden();
  const updated = await prisma.registration.update({ where: { id: registrationId }, data: { paymentStatus } });
  return toRegistrationDto(updated);
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function registrationsToCsv(attendees: Attendee[]): string {
  const header = "Name,Email,Chapter,Status,Payment,Registered at";
  const lines = attendees.map((a) =>
    [a.user.name, a.user.email, a.user.chapterName, a.status, a.paymentStatus, a.registeredAt].map(csvCell).join(","),
  );
  return [header, ...lines].join("\n");
}

export async function exportEventRegistrations(actor: Actor, eventId: string) {
  const groups = await listEventRegistrations(actor, eventId);
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const filename = `${event.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-registrations.csv`;
  const csv = registrationsToCsv([...groups.registered, ...groups.waitlisted, ...groups.cancelled]);
  return { csv, filename, when: formatEventRange(event.startAt, event.endAt, event.timezone) };
}
