import { describe, it, expect } from "vitest";
import { eventInputSchema, eventListQuerySchema } from "@/lib/validation/events";

const valid = {
  title: "Leadership Breakfast",
  description: "Coffee and ideas",
  hostChapterId: "ch1",
  eventTypeId: "t1",
  startAt: "2026-10-01T01:00:00.000Z",
  endAt: "2026-10-01T03:00:00.000Z",
  timezone: "Asia/Singapore",
  venue: "Raffles Hotel",
  isOnline: false,
  visibility: "REGIONAL",
  accessChapterIds: [],
  capacity: null,
  registrationOpensAt: null,
  registrationClosesAt: null,
  paymentType: "FREE",
  price: null,
  currency: null,
  paymentInstructions: null,
  paymentUrl: null,
};

describe("eventInputSchema", () => {
  it("accepts a valid free regional event and parses dates", () => {
    const out = eventInputSchema.parse(valid);
    expect(out.startAt).toBeInstanceOf(Date);
    expect(out.capacity).toBeNull();
  });
  it("rejects end before start", () => {
    const r = eventInputSchema.safeParse({ ...valid, endAt: "2026-10-01T00:00:00.000Z" });
    expect(r.success).toBe(false);
  });
  it("requires chapters for CHAPTER_SPECIFIC", () => {
    expect(eventInputSchema.safeParse({ ...valid, visibility: "CHAPTER_SPECIFIC" }).success).toBe(false);
    expect(
      eventInputSchema.safeParse({ ...valid, visibility: "CHAPTER_SPECIFIC", accessChapterIds: ["ch2"] }).success,
    ).toBe(true);
  });
  it("requires price and currency for PAID", () => {
    expect(eventInputSchema.safeParse({ ...valid, paymentType: "PAID" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...valid, paymentType: "PAID", price: 120, currency: "SGD" }).success).toBe(
      true,
    );
  });
  it("rejects unknown timezone and bad urls", () => {
    expect(eventInputSchema.safeParse({ ...valid, timezone: "Nope/Nope" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...valid, isOnline: true, onlineUrl: "not a url" }).success).toBe(false);
  });
});

describe("eventListQuerySchema", () => {
  it("parses comma lists, booleans and defaults", () => {
    const q = eventListQuerySchema.parse({ chapterIds: "a,b", registrableOnly: "true", page: "2" });
    expect(q.chapterIds).toEqual(["a", "b"]);
    expect(q.registrableOnly).toBe(true);
    expect(q.page).toBe(2);
    expect(q.pageSize).toBe(20);
  });
});
