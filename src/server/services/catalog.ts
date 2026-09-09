import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError, forbidden, notFound } from "@/server/api";
import { canManageChapters, type Actor } from "@/server/permissions";
import type { ChapterInput, ChapterUpdateInput, EventTypeInput, EventTypeUpdateInput } from "@/lib/validation/catalog";

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function listAllChapters(actor: Actor) {
  if (!canManageChapters(actor)) forbidden();
  return prisma.chapter.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { users: true, hostedEvents: true } } },
  });
}

export async function createChapter(actor: Actor, input: ChapterInput) {
  if (!canManageChapters(actor)) forbidden();
  try {
    return await prisma.chapter.create({ data: input });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "CODE_TAKEN", "A chapter with this code already exists");
    throw e;
  }
}

export async function updateChapter(actor: Actor, id: string, input: ChapterUpdateInput) {
  if (!canManageChapters(actor)) forbidden();
  const existing = await prisma.chapter.findUnique({ where: { id } });
  if (!existing) notFound("Chapter");
  try {
    return await prisma.chapter.update({ where: { id }, data: input });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "CODE_TAKEN", "A chapter with this code already exists");
    throw e;
  }
}

export async function listAllEventTypes(actor: Actor) {
  if (!canManageChapters(actor)) forbidden();
  return prisma.eventType.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { events: true } } },
  });
}

export async function createEventType(actor: Actor, input: EventTypeInput) {
  if (!canManageChapters(actor)) forbidden();
  try {
    return await prisma.eventType.create({ data: input });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "NAME_TAKEN", "An event type with this name already exists");
    throw e;
  }
}

export async function updateEventType(actor: Actor, id: string, input: EventTypeUpdateInput) {
  if (!canManageChapters(actor)) forbidden();
  const existing = await prisma.eventType.findUnique({ where: { id } });
  if (!existing) notFound("Event type");
  try {
    return await prisma.eventType.update({ where: { id }, data: input });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ApiError(409, "NAME_TAKEN", "An event type with this name already exists");
    throw e;
  }
}
