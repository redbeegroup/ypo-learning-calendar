import { Prisma, type Chapter, type EventStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError, forbidden, notFound } from "@/server/api";
import {
  actorChapterIds,
  canManageEvent,
  canRegisterForEvent,
  isAdmin,
  type Actor,
  type RegisterCheck,
} from "@/server/permissions";
import { promoteWaitlist, sendPromotionEmails } from "@/server/services/waitlist";
import type { AgendaItem, EventInput, EventListQuery, EventResource } from "@/lib/validation/events";

/** Include clause that also loads the acting user's own registration (at most one row). */
export function eventInclude(userId: string) {
  return {
    hostChapter: true,
    eventType: true,
    chapterAccess: { include: { chapter: true } },
    registrations: {
      where: { userId },
      select: { id: true, status: true, paymentStatus: true, registeredAt: true },
    },
    _count: {
      select: {
        registrations: { where: { status: "REGISTERED" } },
      },
    },
  } satisfies Prisma.EventInclude;
}

export type EventRow = Prisma.EventGetPayload<{ include: ReturnType<typeof eventInclude> }>;

export type EventDto = ReturnType<typeof toEventDto>;

type Extras = { waitlistedCount?: number; waitlistPosition?: number | null };

export function toEventDto(e: EventRow, actor: Actor, extras: Extras = {}) {
  const accessChapterIds = e.chapterAccess.map((a) => a.chapterId);
  const registeredCount = e._count.registrations;
  const registration: RegisterCheck = canRegisterForEvent(actor, {
    status: e.status,
    hostChapterId: e.hostChapterId,
    visibility: e.visibility,
    accessChapterIds,
    startAt: e.startAt,
    registrationOpensAt: e.registrationOpensAt,
    registrationClosesAt: e.registrationClosesAt,
  });
  const mine = e.registrations.find((r) => r.status !== "CANCELLED") ?? null;
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    hostChapter: pickChapter(e.hostChapter),
    eventType: { id: e.eventType.id, name: e.eventType.name, color: e.eventType.color },
    startAt: e.startAt.toISOString(),
    endAt: e.endAt.toISOString(),
    timezone: e.timezone,
    venue: e.venue,
    isOnline: e.isOnline,
    onlineUrl: e.onlineUrl,
    coverImageUrl: e.coverImageUrl,
    visibility: e.visibility,
    accessChapters: e.chapterAccess.map((a) => pickChapter(a.chapter)),
    capacity: e.capacity,
    registeredCount,
    waitlistedCount: extras.waitlistedCount ?? 0,
    spotsLeft: e.capacity === null ? null : Math.max(0, e.capacity - registeredCount),
    registrationOpensAt: e.registrationOpensAt?.toISOString() ?? null,
    registrationClosesAt: e.registrationClosesAt?.toISOString() ?? null,
    paymentType: e.paymentType,
    price: e.price === null ? null : Number(e.price),
    currency: e.currency,
    paymentInstructions: e.paymentInstructions,
    paymentUrl: e.paymentUrl,
    chairs: e.chairs,
    resources: (e.resources as unknown as EventResource[] | null) ?? [],
    agenda: (e.agenda as unknown as AgendaItem[] | null) ?? [],
    status: e.status,
    canManage: canManageEvent(actor, e),
    registration,
    myRegistration: mine
      ? {
          id: mine.id,
          status: mine.status,
          paymentStatus: mine.paymentStatus,
          registeredAt: mine.registeredAt.toISOString(),
        }
      : null,
    waitlistPosition: extras.waitlistPosition ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function pickChapter(c: Chapter) {
  return { id: c.id, name: c.name, code: c.code };
}

function toData(input: EventInput, createdById?: string): Prisma.EventUncheckedCreateInput {
  return {
    title: input.title,
    description: input.description,
    hostChapterId: input.hostChapterId,
    eventTypeId: input.eventTypeId,
    startAt: input.startAt,
    endAt: input.endAt,
    timezone: input.timezone,
    venue: input.venue,
    isOnline: input.isOnline,
    onlineUrl: input.onlineUrl,
    coverImageUrl: input.coverImageUrl,
    visibility: input.visibility,
    capacity: input.capacity,
    registrationOpensAt: input.registrationOpensAt,
    registrationClosesAt: input.registrationClosesAt,
    paymentType: input.paymentType,
    price: input.paymentType === "PAID" ? input.price : null,
    currency: input.paymentType === "PAID" ? input.currency : null,
    paymentInstructions: input.paymentType === "PAID" ? input.paymentInstructions : null,
    paymentUrl: input.paymentType === "PAID" ? input.paymentUrl : null,
    chairs: input.chairs,
    resources: input.resources as Prisma.InputJsonValue,
    agenda: input.agenda as Prisma.InputJsonValue,
    ...(createdById ? { createdById } : {}),
  } as Prisma.EventUncheckedCreateInput;
}

async function assertRefs(input: EventInput) {
  const [chapter, type, access] = await Promise.all([
    prisma.chapter.findUnique({ where: { id: input.hostChapterId } }),
    prisma.eventType.findUnique({ where: { id: input.eventTypeId } }),
    prisma.chapter.findMany({ where: { id: { in: input.accessChapterIds } }, select: { id: true } }),
  ]);
  const fields: Record<string, string[]> = {};
  if (!chapter) fields.hostChapterId = ["Unknown chapter"];
  if (!type) fields.eventTypeId = ["Unknown event type"];
  if (access.length !== input.accessChapterIds.length) fields.accessChapterIds = ["Unknown chapter in list"];
  if (Object.keys(fields).length) throw new ApiError(400, "VALIDATION", "Invalid input", fields);
}

export async function createEvent(actor: Actor, input: EventInput) {
  if (!canManageEvent(actor, { hostChapterId: input.hostChapterId })) forbidden();
  await assertRefs(input);
  const accessIds = input.visibility === "CHAPTER_SPECIFIC" ? input.accessChapterIds : [];
  const event = await prisma.event.create({
    data: {
      ...toData(input, actor.id),
      chapterAccess: { create: accessIds.map((chapterId) => ({ chapterId })) },
    },
    include: eventInclude(actor.id),
  });
  return toEventDto(event, actor);
}

export async function updateEvent(actor: Actor, id: string, input: EventInput) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) notFound("Event");
  if (!canManageEvent(actor, existing) || !canManageEvent(actor, { hostChapterId: input.hostChapterId })) forbidden();
  await assertRefs(input);
  const accessIds = input.visibility === "CHAPTER_SPECIFIC" ? input.accessChapterIds : [];
  const { event, promoted } = await prisma.$transaction(async (tx) => {
    await tx.eventChapterAccess.deleteMany({ where: { eventId: id } });
    const event = await tx.event.update({
      where: { id },
      data: {
        ...toData(input),
        chapterAccess: { create: accessIds.map((chapterId) => ({ chapterId })) },
      },
      include: eventInclude(actor.id),
    });
    // A larger capacity frees seats for waitlisted members.
    const promoted = event.status === "PUBLISHED" ? await promoteWaitlist(tx, event) : [];
    return { event, promoted };
  });
  await sendPromotionEmails(event, promoted);
  return toEventDto(event, actor);
}

async function setStatus(actor: Actor, id: string, status: EventStatus) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) notFound("Event");
  if (!canManageEvent(actor, existing)) forbidden();
  if (status === "PUBLISHED" && existing.status === "CANCELLED") {
    throw new ApiError(400, "INVALID_STATE", "A cancelled event cannot be published again");
  }
  const event = await prisma.event.update({ where: { id }, data: { status }, include: eventInclude(actor.id) });
  return toEventDto(event, actor);
}

export const publishEvent = (actor: Actor, id: string) => setStatus(actor, id, "PUBLISHED");
export const cancelEvent = (actor: Actor, id: string) => setStatus(actor, id, "CANCELLED");

/** Chapters whose events this actor may manage; null means all. */
function managedChapterIds(actor: Actor): string[] | null {
  if (actor.role === "SUPER_ADMIN") return null;
  if (actor.role === "CHAPTER_ADMIN") return [actor.chapterId];
  return [];
}

function buildListWhere(actor: Actor, q: EventListQuery): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = {};
  const and: Prisma.EventWhereInput[] = [];

  if (q.status && q.status !== "PUBLISHED") {
    if (!isAdmin(actor)) forbidden("Only admins can list unpublished events");
    const managed = managedChapterIds(actor);
    where.status = q.status;
    if (managed) and.push({ hostChapterId: { in: managed } });
  } else {
    where.status = "PUBLISHED";
  }

  if (q.chapterIds.length) and.push({ hostChapterId: { in: q.chapterIds } });
  if (q.typeIds.length) where.eventTypeId = { in: q.typeIds };
  if (q.payment) where.paymentType = q.payment;
  const from = q.from ?? (q.includePast ? undefined : startOfToday());
  if (from || q.to) where.startAt = { ...(from ? { gte: from } : {}), ...(q.to ? { lte: q.to } : {}) };
  if (q.q) {
    and.push({
      OR: [
        { title: { contains: q.q, mode: "insensitive" } },
        { description: { contains: q.q, mode: "insensitive" } },
        { venue: { contains: q.q, mode: "insensitive" } },
      ],
    });
  }
  if (q.registrableOnly) {
    and.push({
      OR: [
        { visibility: "REGIONAL" },
        { visibility: "LOCAL", hostChapterId: { in: actorChapterIds(actor) } },
        { visibility: "CHAPTER_SPECIFIC", chapterAccess: { some: { chapterId: { in: actorChapterIds(actor) } } } },
      ],
    });
  }
  if (and.length) where.AND = and;
  return where;
}

/** Event counts per chapter and per type for the current query, each ignoring its own filter (faceted counts). */
export async function listEventFacets(actor: Actor, q: EventListQuery) {
  const [byChapter, byType] = await Promise.all([
    prisma.event.groupBy({ by: ["hostChapterId"], where: buildListWhere(actor, { ...q, chapterIds: [] }), _count: { _all: true } }),
    prisma.event.groupBy({ by: ["eventTypeId"], where: buildListWhere(actor, { ...q, typeIds: [] }), _count: { _all: true } }),
  ]);
  return {
    chapters: Object.fromEntries(byChapter.map((r) => [r.hostChapterId, r._count._all])),
    types: Object.fromEntries(byType.map((r) => [r.eventTypeId, r._count._all])),
  };
}

export async function listEvents(actor: Actor, q: EventListQuery) {
  const where = buildListWhere(actor, q);

  const [total, rows] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include: eventInclude(actor.id),
      orderBy: [{ startAt: "asc" }, { title: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return { items: rows.map((r) => toEventDto(r, actor)), total, page: q.page, pageSize: q.pageSize };
}

export async function getEvent(actor: Actor, id: string) {
  const row = await prisma.event.findUnique({ where: { id }, include: eventInclude(actor.id) });
  if (!row) notFound("Event");
  if (row.status !== "PUBLISHED" && !canManageEvent(actor, row)) notFound("Event");
  const waitlistedCount = await prisma.registration.count({ where: { eventId: id, status: "WAITLISTED" } });
  const mine = row.registrations.find((r) => r.status === "WAITLISTED");
  const waitlistPosition = mine
    ? (await prisma.registration.count({
        where: { eventId: id, status: "WAITLISTED", registeredAt: { lt: mine.registeredAt } },
      })) + 1
    : null;
  return toEventDto(row, actor, { waitlistedCount, waitlistPosition });
}

export async function listChapters() {
  return prisma.chapter.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, country: true },
  });
}

export async function listEventTypes() {
  return prisma.eventType.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, color: true },
  });
}

function startOfToday() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function queryFromSearchParams(sp: URLSearchParams | Record<string, string | string[] | undefined>) {
  const obj: Record<string, string> = {};
  const entries = sp instanceof URLSearchParams ? Array.from(sp.entries()) : Object.entries(sp);
  for (const [k, v] of entries) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined && val !== "") obj[k] = val;
  }
  return obj;
}
