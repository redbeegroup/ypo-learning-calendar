import { describe, it, expect } from "vitest";
import {
  canManageEvent,
  canManageUser,
  canManageChapters,
  canRegisterForEvent,
  isAdmin,
  type Actor,
} from "@/server/permissions";

const superAdmin: Actor = { id: "u1", role: "SUPER_ADMIN", chapterId: "sg" };
const sgAdmin: Actor = { id: "u2", role: "CHAPTER_ADMIN", chapterId: "sg" };
const myAdmin: Actor = { id: "u3", role: "CHAPTER_ADMIN", chapterId: "my" };
const sgMember: Actor = { id: "u4", role: "MEMBER", chapterId: "sg" };
const myMember: Actor = { id: "u5", role: "MEMBER", chapterId: "my" };

describe("isAdmin", () => {
  it("is true for both admin roles only", () => {
    expect(isAdmin(superAdmin)).toBe(true);
    expect(isAdmin(sgAdmin)).toBe(true);
    expect(isAdmin(sgMember)).toBe(false);
  });
});

describe("canManageEvent", () => {
  it("super admin manages any chapter's event", () => {
    expect(canManageEvent(superAdmin, { hostChapterId: "my" })).toBe(true);
  });
  it("chapter admin manages only own chapter's events", () => {
    expect(canManageEvent(sgAdmin, { hostChapterId: "sg" })).toBe(true);
    expect(canManageEvent(myAdmin, { hostChapterId: "sg" })).toBe(false);
  });
  it("members manage nothing", () => {
    expect(canManageEvent(sgMember, { hostChapterId: "sg" })).toBe(false);
  });
});

describe("canManageUser", () => {
  it("super admin manages any user with any role", () => {
    expect(canManageUser(superAdmin, { chapterId: "my", role: "CHAPTER_ADMIN" })).toBe(true);
  });
  it("chapter admin manages MEMBER users in own chapter only", () => {
    expect(canManageUser(sgAdmin, { chapterId: "sg", role: "MEMBER" })).toBe(true);
    expect(canManageUser(sgAdmin, { chapterId: "sg", role: "CHAPTER_ADMIN" })).toBe(false);
    expect(canManageUser(sgAdmin, { chapterId: "my", role: "MEMBER" })).toBe(false);
  });
  it("members manage nobody", () => {
    expect(canManageUser(sgMember, { chapterId: "sg", role: "MEMBER" })).toBe(false);
  });
});

describe("canManageChapters", () => {
  it("only super admin", () => {
    expect(canManageChapters(superAdmin)).toBe(true);
    expect(canManageChapters(sgAdmin)).toBe(false);
  });
});

describe("canRegisterForEvent", () => {
  const now = new Date("2026-09-10T00:00:00Z");
  const base = {
    status: "PUBLISHED" as const,
    hostChapterId: "sg",
    visibility: "REGIONAL" as const,
    accessChapterIds: [] as string[],
    startAt: new Date("2026-10-01T00:00:00Z"),
    registrationOpensAt: null,
    registrationClosesAt: null,
  };

  it("regional events are open to any chapter", () => {
    expect(canRegisterForEvent(myMember, base, now)).toEqual({ ok: true });
  });
  it("local events are open to host chapter only", () => {
    const ev = { ...base, visibility: "LOCAL" as const };
    expect(canRegisterForEvent(sgMember, ev, now)).toEqual({ ok: true });
    expect(canRegisterForEvent(myMember, ev, now)).toEqual({ ok: false, reason: "NOT_IN_SCOPE" });
  });
  it("chapter specific events are open to listed chapters", () => {
    const ev = { ...base, visibility: "CHAPTER_SPECIFIC" as const, accessChapterIds: ["my"] };
    expect(canRegisterForEvent(myMember, ev, now)).toEqual({ ok: true });
    expect(canRegisterForEvent(sgMember, ev, now)).toEqual({ ok: false, reason: "NOT_IN_SCOPE" });
  });
  it("rejects unpublished events", () => {
    expect(canRegisterForEvent(sgMember, { ...base, status: "DRAFT" }, now)).toEqual({
      ok: false,
      reason: "NOT_PUBLISHED",
    });
  });
  it("respects the registration window", () => {
    const notYet = { ...base, registrationOpensAt: new Date("2026-09-20T00:00:00Z") };
    expect(canRegisterForEvent(sgMember, notYet, now)).toEqual({ ok: false, reason: "NOT_OPEN_YET" });
    const closed = { ...base, registrationClosesAt: new Date("2026-09-01T00:00:00Z") };
    expect(canRegisterForEvent(sgMember, closed, now)).toEqual({ ok: false, reason: "CLOSED" });
  });
  it("rejects events that already started", () => {
    const past = { ...base, startAt: new Date("2026-09-01T00:00:00Z") };
    expect(canRegisterForEvent(sgMember, past, now)).toEqual({ ok: false, reason: "STARTED" });
  });
});
