import type { Role, Visibility, EventStatus } from "@prisma/client";

export type Actor = { id: string; role: Role; chapterId: string; secondaryChapterId?: string | null };

/** Primary chapter plus the optional secondary chapter. */
export function actorChapterIds(actor: Pick<Actor, "chapterId" | "secondaryChapterId">): string[] {
  return actor.secondaryChapterId ? [actor.chapterId, actor.secondaryChapterId] : [actor.chapterId];
}

export type EventScope = {
  status: EventStatus;
  hostChapterId: string;
  visibility: Visibility;
  accessChapterIds: string[];
  startAt: Date;
  registrationOpensAt: Date | null;
  registrationClosesAt: Date | null;
};

export type RegisterDenial = "NOT_PUBLISHED" | "NOT_IN_SCOPE" | "NOT_OPEN_YET" | "CLOSED" | "STARTED";
export type RegisterCheck = { ok: true } | { ok: false; reason: RegisterDenial };

export function isAdmin(actor: Actor): boolean {
  return actor.role === "SUPER_ADMIN" || actor.role === "CHAPTER_ADMIN";
}

export function canManageChapters(actor: Actor): boolean {
  return actor.role === "SUPER_ADMIN";
}

export function canManageEvent(actor: Actor, event: { hostChapterId: string }): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.role === "CHAPTER_ADMIN") return actor.chapterId === event.hostChapterId;
  return false;
}

export function canManageUser(actor: Actor, target: { chapterId: string; role: Role }): boolean {
  if (actor.role === "SUPER_ADMIN") return true;
  if (actor.role === "CHAPTER_ADMIN") return actor.chapterId === target.chapterId && target.role === "MEMBER";
  return false;
}

export function isInRegistrationScope(
  actor: Pick<Actor, "chapterId" | "secondaryChapterId">,
  event: Pick<EventScope, "hostChapterId" | "visibility" | "accessChapterIds">,
): boolean {
  switch (event.visibility) {
    case "REGIONAL":
      return true;
    case "LOCAL":
      return actorChapterIds(actor).includes(event.hostChapterId);
    case "CHAPTER_SPECIFIC":
      return actorChapterIds(actor).some((id) => event.accessChapterIds.includes(id));
  }
}

export function canRegisterForEvent(actor: Actor, event: EventScope, now = new Date()): RegisterCheck {
  if (event.status !== "PUBLISHED") return { ok: false, reason: "NOT_PUBLISHED" };
  if (!isInRegistrationScope(actor, event)) return { ok: false, reason: "NOT_IN_SCOPE" };
  if (event.registrationOpensAt && now < event.registrationOpensAt) return { ok: false, reason: "NOT_OPEN_YET" };
  if (event.registrationClosesAt && now > event.registrationClosesAt) return { ok: false, reason: "CLOSED" };
  if (now >= event.startAt) return { ok: false, reason: "STARTED" };
  return { ok: true };
}
