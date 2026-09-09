# Phase 3: Events Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins create, edit, publish, and cancel events; members browse a searchable, filterable event list and a detail page that tells them whether they may register.

**Architecture:** One event service (`src/server/services/events.ts`) owns all reads and writes and returns a single DTO shape (`EventDto`). API route handlers under `/api/v1/events` are thin wrappers for the future mobile app and for client-side mutations. Server components (list, detail, admin table, edit form loader) call the service directly, so there is no HTTP hop for page loads. Filters live in the URL query string so links are shareable and the server renders the filtered result.

**Tech Stack:** Prisma, Zod, date-fns + date-fns-tz (timezone conversion), react-markdown + remark-gfm (safe Markdown), react-hook-form + @hookform/resolvers (admin form), shadcn select/textarea/checkbox/badge/dropdown-menu/radio-group/switch/table/dialog/separator.

Spec: `docs/superpowers/specs/2026-09-09-learning-calendar-design.md`

Note on the spec's "API is the only way the UI touches data": server components call the same service functions the API handlers call, so business rules are never duplicated. Client components (forms, buttons) always go through `/api/v1`.

---

## File structure

```
src/lib/dates.ts                         timezone helpers, SEA zone list, range formatting
src/lib/validation/events.ts             eventInputSchema, eventListQuerySchema
src/server/services/events.ts            create/update/publish/cancel/list/get + toEventDto
src/app/api/v1/events/route.ts           GET list, POST create
src/app/api/v1/events/[id]/route.ts      GET detail, PATCH update
src/app/api/v1/events/[id]/publish/route.ts
src/app/api/v1/events/[id]/cancel/route.ts
src/app/api/v1/chapters/route.ts         GET active chapters (any user)
src/app/api/v1/event-types/route.ts      GET active types (any user)
src/components/events/event-card.tsx
src/components/events/event-filters.tsx  client; writes filters to URL
src/components/events/event-badges.tsx   chapter / type / payment / visibility badges
src/components/events/markdown.tsx
src/app/(member)/events/page.tsx         list
src/app/(member)/events/[id]/page.tsx    detail
src/app/admin/layout.tsx                 sidebar, admin guard
src/app/admin/events/page.tsx            table
src/app/admin/events/new/page.tsx
src/app/admin/events/[id]/edit/page.tsx
src/components/admin/event-form.tsx      client form (create + edit)
src/components/admin/event-actions.tsx   publish / cancel buttons
tests/unit/dates.test.ts
tests/unit/event-validation.test.ts
tests/api/events.test.ts
```

---

### Task 1: Date helpers and validation (TDD)

**Files:** `src/lib/dates.ts`, `src/lib/validation/events.ts`, `tests/unit/dates.test.ts`, `tests/unit/event-validation.test.ts`

- [ ] **Step 1: Failing tests**

`tests/unit/dates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { zonedInputToUtc, utcToZonedInput, formatEventRange, isValidTimeZone } from "@/lib/dates";

describe("dates", () => {
  it("converts a wall-clock input in a zone to UTC and back", () => {
    const utc = zonedInputToUtc("2026-10-01T09:00", "Asia/Singapore");
    expect(utc.toISOString()).toBe("2026-10-01T01:00:00.000Z");
    expect(utcToZonedInput(utc, "Asia/Singapore")).toBe("2026-10-01T09:00");
    expect(utcToZonedInput(utc, "Asia/Yangon")).toBe("2026-10-01T07:30");
  });

  it("formats a same-day range compactly and a multi-day range fully", () => {
    const s = new Date("2026-10-01T01:00:00Z");
    expect(formatEventRange(s, new Date("2026-10-01T03:30:00Z"), "Asia/Singapore")).toBe(
      "Thu 1 Oct 2026, 9:00 AM – 11:30 AM (SGT)",
    );
    expect(formatEventRange(s, new Date("2026-10-02T03:30:00Z"), "Asia/Singapore")).toBe(
      "Thu 1 Oct 2026, 9:00 AM – Fri 2 Oct 2026, 11:30 AM (SGT)",
    );
  });

  it("validates IANA zones", () => {
    expect(isValidTimeZone("Asia/Bangkok")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
```

`tests/unit/event-validation.test.ts`:
```ts
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
    expect(eventInputSchema.safeParse({ ...valid, visibility: "CHAPTER_SPECIFIC", accessChapterIds: ["ch2"] }).success).toBe(true);
  });
  it("requires price and currency for PAID", () => {
    expect(eventInputSchema.safeParse({ ...valid, paymentType: "PAID" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...valid, paymentType: "PAID", price: 120, currency: "SGD" }).success).toBe(true);
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
```

- [ ] **Step 2: Run** `make test` → FAIL (modules missing).

- [ ] **Step 3: Implement `src/lib/dates.ts`**

```ts
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const SEA_TIMEZONES: { value: string; label: string }[] = [
  { value: "Asia/Singapore", label: "Singapore (SGT, UTC+8)" },
  { value: "Asia/Kuala_Lumpur", label: "Malaysia (MYT, UTC+8)" },
  { value: "Asia/Manila", label: "Philippines (PHT, UTC+8)" },
  { value: "Asia/Bangkok", label: "Thailand (ICT, UTC+7)" },
  { value: "Asia/Jakarta", label: "Indonesia – Jakarta (WIB, UTC+7)" },
  { value: "Asia/Ho_Chi_Minh", label: "Vietnam (ICT, UTC+7)" },
  { value: "Asia/Phnom_Penh", label: "Cambodia (ICT, UTC+7)" },
  { value: "Asia/Yangon", label: "Myanmar (MMT, UTC+6:30)" },
];

export function isValidTimeZone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "2026-10-01T09:00" typed in `tz` → UTC Date. */
export function zonedInputToUtc(input: string, tz: string): Date {
  return fromZonedTime(input, tz);
}

/** UTC Date → "YYYY-MM-DDTHH:mm" wall clock in `tz`, for <input type="datetime-local">. */
export function utcToZonedInput(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd'T'HH:mm");
}

export function formatEventRange(start: Date, end: Date, tz: string): string {
  const day = "EEE d MMM yyyy";
  const time = "h:mm a";
  const sameDay = formatInTimeZone(start, tz, "yyyy-MM-dd") === formatInTimeZone(end, tz, "yyyy-MM-dd");
  const zone = formatInTimeZone(start, tz, "zzz");
  if (sameDay) {
    return `${formatInTimeZone(start, tz, `${day}, ${time}`)} – ${formatInTimeZone(end, tz, time)} (${zone})`;
  }
  return `${formatInTimeZone(start, tz, `${day}, ${time}`)} – ${formatInTimeZone(end, tz, `${day}, ${time}`)} (${zone})`;
}

export function formatDateShort(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "EEE d MMM");
}

export function formatTime(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "h:mm a");
}
```

- [ ] **Step 4: Implement `src/lib/validation/events.ts`**

```ts
import { z } from "zod";
import { isValidTimeZone } from "@/lib/dates";

const isoDate = z.string().datetime({ offset: true }).transform((s) => new Date(s));
const nullableIsoDate = isoDate.nullable().optional().transform((d) => d ?? null);
const nullableUrl = z.string().url().max(2000).nullable().optional().transform((v) => v || null);
const nullableText = z.string().max(5000).nullable().optional().transform((v) => v || null);

export const VISIBILITIES = ["LOCAL", "REGIONAL", "CHAPTER_SPECIFIC"] as const;
export const PAYMENT_TYPES = ["FREE", "PAID"] as const;

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(200),
    description: z.string().max(20000).default(""),
    hostChapterId: z.string().min(1, "Host chapter is required"),
    eventTypeId: z.string().min(1, "Event type is required"),
    startAt: isoDate,
    endAt: isoDate,
    timezone: z.string().refine(isValidTimeZone, "Unknown timezone"),
    venue: z.string().trim().max(300).default(""),
    isOnline: z.boolean().default(false),
    onlineUrl: nullableUrl,
    coverImageUrl: nullableUrl,
    visibility: z.enum(VISIBILITIES),
    accessChapterIds: z.array(z.string().min(1)).default([]),
    capacity: z.number().int().positive().max(100000).nullable().optional().transform((v) => v ?? null),
    registrationOpensAt: nullableIsoDate,
    registrationClosesAt: nullableIsoDate,
    paymentType: z.enum(PAYMENT_TYPES),
    price: z.number().nonnegative().max(1_000_000).nullable().optional().transform((v) => v ?? null),
    currency: z.string().trim().length(3).toUpperCase().nullable().optional().transform((v) => v || null),
    paymentInstructions: nullableText,
    paymentUrl: nullableUrl,
  })
  .superRefine((v, ctx) => {
    if (v.endAt <= v.startAt) ctx.addIssue({ code: "custom", path: ["endAt"], message: "End must be after start" });
    if (v.visibility === "CHAPTER_SPECIFIC" && v.accessChapterIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["accessChapterIds"], message: "Select at least one chapter" });
    }
    if (v.paymentType === "PAID") {
      if (v.price === null) ctx.addIssue({ code: "custom", path: ["price"], message: "Price is required for paid events" });
      if (!v.currency) ctx.addIssue({ code: "custom", path: ["currency"], message: "Currency is required for paid events" });
    }
    if (v.registrationOpensAt && v.registrationClosesAt && v.registrationClosesAt <= v.registrationOpensAt) {
      ctx.addIssue({ code: "custom", path: ["registrationClosesAt"], message: "Registration must close after it opens" });
    }
  });

export type EventInput = z.infer<typeof eventInputSchema>;

const csv = z
  .string()
  .optional()
  .transform((s) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []));
const bool = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .optional()
  .transform((v) => v === true || v === "true");

export const eventListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().transform((v) => v || undefined),
  chapterIds: csv,
  typeIds: csv,
  from: z.string().datetime({ offset: true }).optional().transform((s) => (s ? new Date(s) : undefined)),
  to: z.string().datetime({ offset: true }).optional().transform((s) => (s ? new Date(s) : undefined)),
  payment: z.enum(PAYMENT_TYPES).optional(),
  registrableOnly: bool,
  includePast: bool,
  status: z.enum(["DRAFT", "PUBLISHED", "CANCELLED"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type EventListQuery = z.infer<typeof eventListQuerySchema>;
```

- [ ] **Step 5: Run** `make test` → dates (3) and validation (6) pass. Commit: `git commit -m "feat: event validation and date helpers"`.

---

### Task 2: Event service and API routes (TDD)

**Files:** `src/server/services/events.ts`, routes listed above, `tests/api/events.test.ts`, extend `tests/api/helpers.ts`

- [ ] **Step 1: Helpers** — add to `tests/api/helpers.ts`:

```ts
export async function createEventType(name = "Business") {
  return prisma.eventType.create({ data: { name } });
}

export function eventBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Leadership Breakfast",
    description: "Coffee and **ideas**",
    startAt: "2026-10-01T01:00:00.000Z",
    endAt: "2026-10-01T03:00:00.000Z",
    timezone: "Asia/Singapore",
    venue: "Raffles Hotel",
    isOnline: false,
    visibility: "REGIONAL",
    accessChapterIds: [],
    paymentType: "FREE",
    ...overrides,
  };
}
```

- [ ] **Step 2: Failing tests `tests/api/events.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { GET as listEvents, POST as createEvent } from "@/app/api/v1/events/route";
import { GET as getEvent, PATCH as updateEvent } from "@/app/api/v1/events/[id]/route";
import { POST as publishEvent } from "@/app/api/v1/events/[id]/publish/route";
import { POST as cancelEvent } from "@/app/api/v1/events/[id]/cancel/route";
import { jsonRequest, createChapter, createUser, createEventType, tokenFor, eventBody } from "./helpers";

const p = (id: string) => ({ params: Promise.resolve({ id }) });
const noParams = { params: Promise.resolve({}) };

async function world() {
  const sg = await createChapter("SG", "Singapore");
  const my = await createChapter("MY", "Malaysia");
  const type = await createEventType();
  const superAdmin = await createUser({ email: "super@x.com", chapterId: sg.id, role: "SUPER_ADMIN" });
  const sgAdmin = await createUser({ email: "sgadmin@x.com", chapterId: sg.id, role: "CHAPTER_ADMIN" });
  const myAdmin = await createUser({ email: "myadmin@x.com", chapterId: my.id, role: "CHAPTER_ADMIN" });
  const sgMember = await createUser({ email: "sg@x.com", chapterId: sg.id });
  const myMember = await createUser({ email: "my@x.com", chapterId: my.id });
  const t = async (u: { id: string }) => tokenFor(u.id);
  return { sg, my, type, superAdmin, sgAdmin, myAdmin, sgMember, myMember, t };
}

async function create(token: string, body: Record<string, unknown>) {
  const res = await createEvent(jsonRequest("/api/v1/events", "POST", body, token), noParams);
  return { res, body: await res.json() };
}

describe("POST /api/v1/events", () => {
  it("chapter admin creates a draft in own chapter, not in another; members cannot", async () => {
    const w = await world();
    const ok = await create(await w.t(w.sgAdmin), eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id }));
    expect(ok.res.status).toBe(201);
    expect(ok.body.data.status).toBe("DRAFT");
    expect(ok.body.data.hostChapter.code).toBe("SG");

    const other = await create(await w.t(w.sgAdmin), eventBody({ hostChapterId: w.my.id, eventTypeId: w.type.id }));
    expect(other.res.status).toBe(403);

    const member = await create(await w.t(w.sgMember), eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id }));
    expect(member.res.status).toBe(403);
  });

  it("validates input", async () => {
    const w = await world();
    const bad = await create(
      await w.t(w.sgAdmin),
      eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id, endAt: "2026-09-01T00:00:00.000Z", paymentType: "PAID" }),
    );
    expect(bad.res.status).toBe(400);
    expect(bad.body.error.fields.endAt).toBeDefined();
    expect(bad.body.error.fields.price).toBeDefined();
  });

  it("stores chapter access for CHAPTER_SPECIFIC events", async () => {
    const w = await world();
    const r = await create(
      await w.t(w.superAdmin),
      eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id, visibility: "CHAPTER_SPECIFIC", accessChapterIds: [w.my.id] }),
    );
    expect(r.res.status).toBe(201);
    expect(r.body.data.accessChapters.map((c: { code: string }) => c.code)).toEqual(["MY"]);
  });
});

describe("publish, update, cancel", () => {
  it("only managers of the host chapter can publish/update/cancel", async () => {
    const w = await world();
    const { body } = await create(await w.t(w.sgAdmin), eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id }));
    const id = body.data.id;

    expect((await publishEvent(jsonRequest(`/api/v1/events/${id}/publish`, "POST", undefined, await w.t(w.myAdmin)), p(id))).status).toBe(403);
    const pub = await publishEvent(jsonRequest(`/api/v1/events/${id}/publish`, "POST", undefined, await w.t(w.sgAdmin)), p(id));
    expect(pub.status).toBe(200);
    expect((await pub.json()).data.status).toBe("PUBLISHED");

    const upd = await updateEvent(
      jsonRequest(`/api/v1/events/${id}`, "PATCH", eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id, title: "Renamed" }), await w.t(w.sgAdmin)),
      p(id),
    );
    expect(upd.status).toBe(200);
    expect((await upd.json()).data.title).toBe("Renamed");

    const can = await cancelEvent(jsonRequest(`/api/v1/events/${id}/cancel`, "POST", undefined, await w.t(w.superAdmin)), p(id));
    expect((await can.json()).data.status).toBe("CANCELLED");
  });
});

describe("GET /api/v1/events and /:id", () => {
  async function seedEvents(w: Awaited<ReturnType<typeof world>>) {
    const tok = await w.t(w.superAdmin);
    const mk = async (o: Record<string, unknown>, publish = true) => {
      const { body } = await create(tok, eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id, ...o }));
      if (publish) await publishEvent(jsonRequest(`/api/v1/events/${body.data.id}/publish`, "POST", undefined, tok), p(body.data.id));
      return body.data.id as string;
    };
    const regional = await mk({ title: "Regional Summit", venue: "Marina Bay" });
    const local = await mk({ title: "SG Local Forum", visibility: "LOCAL" });
    const paid = await mk({ title: "Paid Workshop", paymentType: "PAID", price: 50, currency: "SGD", hostChapterId: w.my.id });
    const later = await mk({ title: "December Retreat", startAt: "2026-12-05T01:00:00.000Z", endAt: "2026-12-06T09:00:00.000Z" });
    const draft = await mk({ title: "Secret Draft" }, false);
    return { regional, local, paid, later, draft };
  }

  const titles = async (res: Response) => (await res.json()).data.items.map((e: { title: string }) => e.title);
  const list = (qs: string, token: string) => listEvents(jsonRequest(`/api/v1/events${qs}`, "GET", undefined, token), noParams);

  it("members see published events only, sorted by date, with registration info", async () => {
    const w = await world();
    await seedEvents(w);
    const res = await list("?from=2026-09-01T00:00:00.000Z", await w.t(w.myMember));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.map((e: { title: string }) => e.title)).toEqual([
      "Regional Summit",
      "SG Local Forum",
      "Paid Workshop",
      "December Retreat",
    ]);
    const local = body.data.items.find((e: { title: string }) => e.title === "SG Local Forum");
    expect(local.registration).toEqual({ allowed: false, reason: "NOT_IN_SCOPE" });
    expect(body.data.total).toBe(4);
  });

  it("searches and filters", async () => {
    const w = await world();
    await seedEvents(w);
    const tok = await w.t(w.myMember);
    expect(await titles(await list("?q=marina&from=2026-09-01T00:00:00.000Z", tok))).toEqual(["Regional Summit"]);
    expect(await titles(await list(`?chapterIds=${w.my.id}&from=2026-09-01T00:00:00.000Z`, tok))).toEqual(["Paid Workshop"]);
    expect(await titles(await list("?payment=PAID&from=2026-09-01T00:00:00.000Z", tok))).toEqual(["Paid Workshop"]);
    expect(await titles(await list("?from=2026-12-01T00:00:00.000Z&to=2026-12-31T00:00:00.000Z", tok))).toEqual(["December Retreat"]);
    expect(await titles(await list("?registrableOnly=true&from=2026-09-01T00:00:00.000Z", tok))).toEqual([
      "Regional Summit",
      "Paid Workshop",
      "December Retreat",
    ]);
  });

  it("admins can list drafts in their scope", async () => {
    const w = await world();
    await seedEvents(w);
    expect(await titles(await list("?status=DRAFT&from=2026-09-01T00:00:00.000Z", await w.t(w.sgAdmin)))).toEqual(["Secret Draft"]);
    expect(await titles(await list("?status=DRAFT&from=2026-09-01T00:00:00.000Z", await w.t(w.myAdmin)))).toEqual([]);
    expect((await list("?status=DRAFT", await w.t(w.sgMember))).status).toBe(403);
  });

  it("detail hides drafts from members and includes canManage", async () => {
    const w = await world();
    const ids = await seedEvents(w);
    expect((await getEvent(jsonRequest(`/api/v1/events/${ids.draft}`, "GET", undefined, await w.t(w.sgMember)), p(ids.draft))).status).toBe(404);
    const asAdmin = await getEvent(jsonRequest(`/api/v1/events/${ids.draft}`, "GET", undefined, await w.t(w.sgAdmin)), p(ids.draft));
    expect(asAdmin.status).toBe(200);
    expect((await asAdmin.json()).data.canManage).toBe(true);
    const asMember = await getEvent(jsonRequest(`/api/v1/events/${ids.regional}`, "GET", undefined, await w.t(w.sgMember)), p(ids.regional));
    expect((await asMember.json()).data.canManage).toBe(false);
  });
});
```

- [ ] **Step 3: Run** `make test` → FAIL.

- [ ] **Step 4: Implement `src/server/services/events.ts`**

```ts
import { Prisma, type Event, type Chapter, type EventType, type EventStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError, forbidden, notFound } from "@/server/api";
import { canManageEvent, canRegisterForEvent, isAdmin, type Actor, type RegisterCheck } from "@/server/permissions";
import type { EventInput, EventListQuery } from "@/lib/validation/events";

const include = {
  hostChapter: true,
  eventType: true,
  chapterAccess: { include: { chapter: true } },
  _count: {
    select: {
      registrations: { where: { status: "REGISTERED" } },
    },
  },
} satisfies Prisma.EventInclude;

type EventRow = Prisma.EventGetPayload<{ include: typeof include }> & { waitlistedCount?: number };

export type EventDto = ReturnType<typeof toEventDto>;

export function toEventDto(e: EventRow, actor: Actor, waitlistedCount = 0) {
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
    waitlistedCount,
    spotsLeft: e.capacity === null ? null : Math.max(0, e.capacity - registeredCount),
    registrationOpensAt: e.registrationOpensAt?.toISOString() ?? null,
    registrationClosesAt: e.registrationClosesAt?.toISOString() ?? null,
    paymentType: e.paymentType,
    price: e.price === null ? null : Number(e.price),
    currency: e.currency,
    paymentInstructions: e.paymentInstructions,
    paymentUrl: e.paymentUrl,
    status: e.status,
    canManage: canManageEvent(actor, e),
    registration,
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
    ...(createdById ? { createdById } : {}),
  };
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
    include,
  });
  return toEventDto(event, actor);
}

export async function updateEvent(actor: Actor, id: string, input: EventInput) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) notFound("Event");
  if (!canManageEvent(actor, existing) || !canManageEvent(actor, { hostChapterId: input.hostChapterId })) forbidden();
  await assertRefs(input);
  const accessIds = input.visibility === "CHAPTER_SPECIFIC" ? input.accessChapterIds : [];
  const event = await prisma.$transaction(async (tx) => {
    await tx.eventChapterAccess.deleteMany({ where: { eventId: id } });
    return tx.event.update({
      where: { id },
      data: {
        ...toData(input),
        chapterAccess: { create: accessIds.map((chapterId) => ({ chapterId })) },
      },
      include,
    });
  });
  return toEventDto(event, actor);
}

async function setStatus(actor: Actor, id: string, status: EventStatus) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) notFound("Event");
  if (!canManageEvent(actor, existing)) forbidden();
  if (status === "PUBLISHED" && existing.status === "CANCELLED") {
    throw new ApiError(400, "INVALID_STATE", "A cancelled event cannot be published again");
  }
  const event = await prisma.event.update({ where: { id }, data: { status }, include });
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

export async function listEvents(actor: Actor, q: EventListQuery) {
  const where: Prisma.EventWhereInput = {};

  if (q.status && q.status !== "PUBLISHED") {
    if (!isAdmin(actor)) forbidden("Only admins can list unpublished events");
    const managed = managedChapterIds(actor);
    where.status = q.status;
    if (managed) where.hostChapterId = { in: managed };
  } else {
    where.status = "PUBLISHED";
  }

  if (q.chapterIds.length) where.hostChapterId = { in: q.chapterIds, ...(where.hostChapterId as object) };
  if (q.typeIds.length) where.eventTypeId = { in: q.typeIds };
  if (q.payment) where.paymentType = q.payment;
  const from = q.from ?? (q.includePast ? undefined : startOfToday());
  if (from || q.to) where.startAt = { ...(from ? { gte: from } : {}), ...(q.to ? { lte: q.to } : {}) };
  if (q.q) {
    where.OR = [
      { title: { contains: q.q, mode: "insensitive" } },
      { description: { contains: q.q, mode: "insensitive" } },
      { venue: { contains: q.q, mode: "insensitive" } },
    ];
  }
  if (q.registrableOnly) {
    where.AND = [
      {
        OR: [
          { visibility: "REGIONAL" },
          { visibility: "LOCAL", hostChapterId: actor.chapterId },
          { visibility: "CHAPTER_SPECIFIC", chapterAccess: { some: { chapterId: actor.chapterId } } },
        ],
      },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.event.count({ where }),
    prisma.event.findMany({
      where,
      include,
      orderBy: [{ startAt: "asc" }, { title: "asc" }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  return { items: rows.map((r) => toEventDto(r, actor)), total, page: q.page, pageSize: q.pageSize };
}

export async function getEvent(actor: Actor, id: string) {
  const row = await prisma.event.findUnique({ where: { id }, include });
  if (!row) notFound("Event");
  if (row.status !== "PUBLISHED" && !canManageEvent(actor, row)) notFound("Event");
  const waitlisted = await prisma.registration.count({ where: { eventId: id, status: "WAITLISTED" } });
  return toEventDto(row, actor, waitlisted);
}

export async function listChapters() {
  return prisma.chapter.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, country: true } });
}

export async function listEventTypes() {
  return prisma.eventType.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, color: true } });
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
```

- [ ] **Step 5: Routes**

`src/app/api/v1/events/route.ts`:
```ts
import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin, requireUser } from "@/server/api";
import { eventInputSchema, eventListQuerySchema } from "@/lib/validation/events";
import { createEvent, listEvents, queryFromSearchParams } from "@/server/services/events";

export const GET = handle(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const query = eventListQuerySchema.parse(queryFromSearchParams(req.nextUrl.searchParams));
  return ok(await listEvents(actor, query));
});

export const POST = handle(async (req: NextRequest) => {
  const actor = await requireAdmin(req);
  const input = await parseBody(req, eventInputSchema);
  return ok(await createEvent(actor, input), { status: 201 });
});
```

`src/app/api/v1/events/[id]/route.ts`:
```ts
import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin, requireUser } from "@/server/api";
import { eventInputSchema } from "@/lib/validation/events";
import { getEvent, updateEvent } from "@/server/services/events";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireUser(req);
  const { id } = await params;
  return ok(await getEvent(actor, id));
});

export const PATCH = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireAdmin(req);
  const { id } = await params;
  const input = await parseBody(req, eventInputSchema);
  return ok(await updateEvent(actor, id, input));
});
```

`src/app/api/v1/events/[id]/publish/route.ts`:
```ts
import { NextRequest } from "next/server";
import { handle, ok, requireAdmin } from "@/server/api";
import { publishEvent } from "@/server/services/events";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireAdmin(req);
  const { id } = await params;
  return ok(await publishEvent(actor, id));
});
```

`src/app/api/v1/events/[id]/cancel/route.ts`: same as publish with `cancelEvent`.

`src/app/api/v1/chapters/route.ts`:
```ts
import { NextRequest } from "next/server";
import { handle, ok, requireUser } from "@/server/api";
import { listChapters } from "@/server/services/events";

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  return ok(await listChapters());
});
```

`src/app/api/v1/event-types/route.ts`: same with `listEventTypes`.

- [ ] **Step 6: Run** `make test` → all pass. `make typecheck && make lint`. Commit: `git commit -m "feat: event service and api routes with tests"`.

---

### Task 3: Member event list and detail pages

**Files:** `src/components/events/*.tsx`, `src/app/(member)/events/page.tsx`, `src/app/(member)/events/[id]/page.tsx`

- [ ] **Step 1: `src/components/events/event-badges.tsx`**

```tsx
import { Badge } from "@/components/ui/badge";
import type { EventDto } from "@/server/services/events";

export function TypeBadge({ type }: { type: EventDto["eventType"] }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: type.color }}
    >
      {type.name}
    </span>
  );
}

export function ChapterBadge({ chapter }: { chapter: EventDto["hostChapter"] }) {
  return <Badge variant="secondary">{chapter.name}</Badge>;
}

export function PaymentBadge({ event }: { event: Pick<EventDto, "paymentType" | "price" | "currency"> }) {
  if (event.paymentType === "FREE") return <Badge className="bg-green-600 hover:bg-green-600">Free</Badge>;
  return (
    <Badge className="bg-amber-600 hover:bg-amber-600">
      {event.currency} {event.price?.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
    </Badge>
  );
}

export function StatusBadge({ status }: { status: EventDto["status"] }) {
  const map = { DRAFT: "bg-slate-500", PUBLISHED: "bg-blue-600", CANCELLED: "bg-red-600" } as const;
  return <Badge className={`${map[status]} hover:${map[status]}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>;
}

export function visibilityLabel(event: Pick<EventDto, "visibility" | "hostChapter" | "accessChapters">): string {
  switch (event.visibility) {
    case "REGIONAL":
      return "Open to all SEA members";
    case "LOCAL":
      return `Open to ${event.hostChapter.name} members`;
    case "CHAPTER_SPECIFIC":
      return `Open to ${event.accessChapters.map((c) => c.name).join(", ")} members`;
  }
}

export function registrationHint(event: Pick<EventDto, "registration" | "visibility" | "hostChapter" | "accessChapters" | "spotsLeft">): string {
  if (event.registration.ok) {
    if (event.spotsLeft === 0) return "Full – waitlist available";
    if (event.spotsLeft !== null) return `${event.spotsLeft} spots left`;
    return "Open for registration";
  }
  switch (event.registration.reason) {
    case "NOT_IN_SCOPE":
      return visibilityLabel(event);
    case "NOT_OPEN_YET":
      return "Registration opens later";
    case "CLOSED":
      return "Registration closed";
    case "STARTED":
      return "Event has started";
    case "NOT_PUBLISHED":
      return "Not published";
  }
}
```

- [ ] **Step 2: `src/components/events/event-card.tsx`**

```tsx
import Link from "next/link";
import { MapPin, Video, CalendarDays } from "lucide-react";
import type { EventDto } from "@/server/services/events";
import { formatEventRange } from "@/lib/dates";
import { ChapterBadge, PaymentBadge, TypeBadge, registrationHint } from "@/components/events/event-badges";

export function EventCard({ event }: { event: EventDto }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-lg border bg-card p-4 shadow-sm transition hover:border-primary hover:shadow"
    >
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={event.eventType} />
        <ChapterBadge chapter={event.hostChapter} />
        <PaymentBadge event={event} />
      </div>
      <h3 className="mt-2 text-lg font-semibold leading-snug">{event.title}</h3>
      <div className="mt-2 space-y-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 shrink-0" />
          <span>{formatEventRange(new Date(event.startAt), new Date(event.endAt), event.timezone)}</span>
        </div>
        <div className="flex items-center gap-2">
          {event.isOnline ? <Video className="h-4 w-4 shrink-0" /> : <MapPin className="h-4 w-4 shrink-0" />}
          <span>{event.isOnline ? "Online" : event.venue || "Venue to be announced"}</span>
        </div>
      </div>
      <p className={`mt-3 text-xs font-medium ${event.registration.ok ? "text-primary" : "text-muted-foreground"}`}>
        {registrationHint(event)}
      </p>
    </Link>
  );
}
```

- [ ] **Step 3: `src/components/events/event-filters.tsx`** (client)

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { id: string; name: string };
type Props = { chapters: Option[]; types: Option[]; showStatus?: boolean };

const RANGES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "3months", label: "Next 3 months" },
  { value: "past", label: "Past events" },
];

export function rangeToDates(range: string): { from?: string; to?: string; includePast?: boolean } {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  switch (range) {
    case "week":
      end.setDate(end.getDate() + (7 - end.getDay()));
      return { from: start.toISOString(), to: end.toISOString() };
    case "month":
      end.setMonth(end.getMonth() + 1, 1);
      return { from: start.toISOString(), to: end.toISOString() };
    case "3months":
      end.setMonth(end.getMonth() + 3);
      return { from: start.toISOString(), to: end.toISOString() };
    case "past":
      return { from: new Date(0).toISOString(), to: start.toISOString(), includePast: true };
    default:
      return {};
  }
}

export function EventFilters({ chapters, types, showStatus }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const selectedChapters = (params.get("chapterIds") ?? "").split(",").filter(Boolean);
  const selectedTypes = (params.get("typeIds") ?? "").split(",").filter(Boolean);

  function update(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) update({ q });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function toggle(key: "chapterIds" | "typeIds", id: string, current: string[]) {
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    update({ [key]: next.join(",") });
  }

  const hasFilters = ["q", "chapterIds", "typeIds", "payment", "registrableOnly", "range", "status"].some((k) => params.get(k));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search events by title, description or venue…"
          className="h-11 pl-9 text-base"
          aria-label="Search events"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {selectedChapters.length ? `${selectedChapters.length} chapter${selectedChapters.length > 1 ? "s" : ""}` : "All chapters"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            <DropdownMenuLabel>Chapters</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {chapters.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={selectedChapters.includes(c.id)}
                onCheckedChange={() => toggle("chapterIds", c.id, selectedChapters)}
                onSelect={(e) => e.preventDefault()}
              >
                {c.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {selectedTypes.length ? `${selectedTypes.length} theme${selectedTypes.length > 1 ? "s" : ""}` : "All themes"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Themes</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {types.map((t) => (
              <DropdownMenuCheckboxItem
                key={t.id}
                checked={selectedTypes.includes(t.id)}
                onCheckedChange={() => toggle("typeIds", t.id, selectedTypes)}
                onSelect={(e) => e.preventDefault()}
              >
                {t.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Select value={params.get("range") ?? "upcoming"} onValueChange={(v) => update({ range: v === "upcoming" ? undefined : v })}>
          <SelectTrigger className="h-8 w-[150px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={params.get("payment") ?? "ALL"} onValueChange={(v) => update({ payment: v === "ALL" ? undefined : v })}>
          <SelectTrigger className="h-8 w-[120px] text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Free & paid</SelectItem>
            <SelectItem value="FREE">Free</SelectItem>
            <SelectItem value="PAID">Paid</SelectItem>
          </SelectContent>
        </Select>

        {showStatus && (
          <Select value={params.get("status") ?? "PUBLISHED"} onValueChange={(v) => update({ status: v === "PUBLISHED" ? undefined : v })}>
            <SelectTrigger className="h-8 w-[130px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="DRAFT">Drafts</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        )}

        {!showStatus && (
          <div className="flex items-center gap-2">
            <Switch
              id="registrable"
              checked={params.get("registrableOnly") === "true"}
              onCheckedChange={(v) => update({ registrableOnly: v ? "true" : undefined })}
            />
            <Label htmlFor="registrable" className="text-sm">
              Only events I can register for
            </Label>
          </div>
        )}

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); startTransition(() => router.replace(pathname)); }}>
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
        {pending && <span className="text-xs text-muted-foreground">Updating…</span>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `src/components/events/markdown.tsx`**

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  if (!children.trim()) return <p className="text-muted-foreground">No description provided.</p>;
  return (
    <div className="prose prose-slate max-w-none prose-a:text-primary prose-headings:font-semibold">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
```
Add `@tailwindcss/typography` to devDependencies and `@plugin "@tailwindcss/typography";` after the imports in `globals.css`.

- [ ] **Step 5: List page `src/app/(member)/events/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listChapters, listEventTypes, listEvents, queryFromSearchParams } from "@/server/services/events";
import { eventListQuerySchema } from "@/lib/validation/events";
import { EventCard } from "@/components/events/event-card";
import { EventFilters, rangeToDates } from "@/components/events/event-filters";
import { Button } from "@/components/ui/button";

type SearchParams = Record<string, string | string[] | undefined>;

export function buildQuery(sp: SearchParams) {
  const raw = queryFromSearchParams(sp);
  const range = rangeToDates(raw.range ?? "upcoming");
  const merged = { ...raw, ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}), ...(range.includePast ? { includePast: "true" } : {}) };
  delete merged.range;
  return eventListQuerySchema.parse(merged);
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const query = buildQuery(sp);
  const [result, chapters, types] = await Promise.all([listEvents(user, query), listChapters(), listEventTypes()]);
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const pageLink = (page: number) => {
    const next = new URLSearchParams(queryFromSearchParams(sp));
    next.set("page", String(page));
    return `/events?${next.toString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/events/calendar">Calendar view</Link>
        </Button>
      </div>
      <EventFilters chapters={chapters} types={types} />
      <p className="text-sm text-muted-foreground">
        {result.total} event{result.total === 1 ? "" : "s"}
      </p>
      {result.items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No events match these filters.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={result.page <= 1}>
            <Link href={pageLink(result.page - 1)} aria-disabled={result.page <= 1}>Previous</Link>
          </Button>
          <span className="text-sm">Page {result.page} of {pages}</span>
          <Button asChild variant="outline" size="sm" disabled={result.page >= pages}>
            <Link href={pageLink(result.page + 1)} aria-disabled={result.page >= pages}>Next</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Detail page `src/app/(member)/events/[id]/page.tsx`**

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, MapPin, Video, Users, ExternalLink } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { getEvent } from "@/server/services/events";
import { ApiError } from "@/server/api";
import { formatEventRange } from "@/lib/dates";
import { Markdown } from "@/components/events/markdown";
import { ChapterBadge, PaymentBadge, StatusBadge, TypeBadge, registrationHint, visibilityLabel } from "@/components/events/event-badges";
import { Button } from "@/components/ui/button";

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  let event;
  try {
    event = await getEvent(user, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/events" className="text-sm text-primary hover:underline">← All events</Link>
      </div>
      {event.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverImageUrl} alt="" className="h-56 w-full rounded-lg object-cover" />
      )}
      <div className="flex flex-wrap items-center gap-2">
        <TypeBadge type={event.eventType} />
        <ChapterBadge chapter={event.hostChapter} />
        <PaymentBadge event={event} />
        {event.status !== "PUBLISHED" && <StatusBadge status={event.status} />}
      </div>
      <h1 className="text-3xl font-semibold">{event.title}</h1>

      <div className="grid gap-3 rounded-lg border bg-card p-4 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
          <span>{formatEventRange(new Date(event.startAt), new Date(event.endAt), event.timezone)}</span>
        </div>
        <div className="flex items-start gap-2">
          {event.isOnline ? <Video className="mt-0.5 h-4 w-4 text-primary" /> : <MapPin className="mt-0.5 h-4 w-4 text-primary" />}
          <span>
            {event.isOnline ? (
              event.onlineUrl ? (
                <a href={event.onlineUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  Online event – join link <ExternalLink className="inline h-3 w-3" />
                </a>
              ) : (
                "Online event"
              )
            ) : (
              event.venue || "Venue to be announced"
            )}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Users className="mt-0.5 h-4 w-4 text-primary" />
          <span>
            {visibilityLabel(event)}
            {event.capacity !== null && ` · ${event.registeredCount}/${event.capacity} registered`}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <span className="font-medium">{registrationHint(event)}</span>
        </div>
      </div>

      {event.paymentType === "PAID" && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <div className="font-semibold">
            Paid event: {event.currency} {event.price}
          </div>
          {event.paymentInstructions && <p className="mt-1 whitespace-pre-line">{event.paymentInstructions}</p>}
          {event.paymentUrl && (
            <a href={event.paymentUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-primary hover:underline">
              Payment link <ExternalLink className="inline h-3 w-3" />
            </a>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button disabled={!event.registration.ok} title={event.registration.ok ? undefined : registrationHint(event)}>
          {event.spotsLeft === 0 ? "Join waitlist" : "Register"}
        </Button>
        {event.canManage && (
          <Button asChild variant="outline">
            <Link href={`/admin/events/${event.id}/edit`}>Edit event</Link>
          </Button>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-semibold">About this event</h2>
        <Markdown>{event.description}</Markdown>
      </section>
    </article>
  );
}
```
(The Register button becomes live in Phase 5.)

- [ ] **Step 7: Browser check** — sign in as admin, create an event via curl, publish it, open `/events`, search, filter, open detail. Commit: `git commit -m "feat: member event list, filters, and detail"`.

---

### Task 4: Admin layout, table, and event form

**Files:** `src/app/admin/layout.tsx`, `src/app/admin/events/page.tsx`, `src/app/admin/events/new/page.tsx`, `src/app/admin/events/[id]/edit/page.tsx`, `src/components/admin/event-form.tsx`, `src/components/admin/event-actions.tsx`

- [ ] **Step 1: `src/app/admin/layout.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Users, Building2, Tags, ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/server/auth/session";
import { canManageChapters, isAdmin } from "@/server/permissions";
import { LogoutButton } from "@/components/layout/logout-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isAdmin(user)) redirect("/events");

  const nav = [
    { href: "/admin/events", label: "Events", icon: CalendarDays },
    { href: "/admin/members", label: "Members", icon: Users },
    ...(canManageChapters(user)
      ? [
          { href: "/admin/chapters", label: "Chapters", icon: Building2 },
          { href: "/admin/event-types", label: "Event types", icon: Tags },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="border-b border-sidebar-border px-4 py-4">
          <div className="font-semibold">YPO SEA Learning</div>
          <div className="text-xs text-blue-200">Admin · {user.role === "SUPER_ADMIN" ? "All chapters" : user.chapterName}</div>
        </div>
        <nav className="flex-1 space-y-1 p-2">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
              <n.icon className="h-4 w-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-1 border-t border-sidebar-border p-2">
          <Link href="/events" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent">
            <ArrowLeft className="h-4 w-4" /> Member view
          </Link>
          <div className="px-1"><LogoutButton /></div>
        </div>
      </aside>
      <div className="flex-1">
        <header className="flex items-center justify-between border-b bg-white px-4 py-3 md:hidden">
          <span className="font-semibold text-primary">Admin</span>
          <nav className="flex gap-3 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="text-primary">{n.label}</Link>
            ))}
            <Link href="/events">Member view</Link>
          </nav>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Admin events table `src/app/admin/events/page.tsx`**

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listChapters, listEventTypes, listEvents, queryFromSearchParams } from "@/server/services/events";
import { eventListQuerySchema } from "@/lib/validation/events";
import { EventFilters, rangeToDates } from "@/components/events/event-filters";
import { StatusBadge, PaymentBadge } from "@/components/events/event-badges";
import { formatEventRange } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EventActions } from "@/components/admin/event-actions";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminEventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sp = await searchParams;
  const raw = queryFromSearchParams(sp);
  const range = rangeToDates(raw.range ?? "upcoming");
  const status = raw.status ?? "PUBLISHED";
  const query = eventListQuerySchema.parse({
    ...raw,
    status,
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
    ...(range.includePast ? { includePast: "true" } : {}),
    pageSize: "50",
  });
  const managedOnly = { ...query, chapterIds: user.role === "SUPER_ADMIN" ? query.chapterIds : [user.chapterId] };
  const [result, chapters, types] = await Promise.all([listEvents(user, managedOnly), listChapters(), listEventTypes()]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Button asChild>
          <Link href="/admin/events/new">New event</Link>
        </Button>
      </div>
      <EventFilters chapters={chapters} types={types} showStatus />
      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Chapter</TableHead>
              <TableHead>Registered</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No events.</TableCell>
              </TableRow>
            )}
            {result.items.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <Link href={`/admin/events/${e.id}/edit`} className="font-medium text-primary hover:underline">{e.title}</Link>
                  <div className="mt-1 flex gap-1"><PaymentBadge event={e} /></div>
                </TableCell>
                <TableCell className="text-sm">{formatEventRange(new Date(e.startAt), new Date(e.endAt), e.timezone)}</TableCell>
                <TableCell>{e.hostChapter.name}</TableCell>
                <TableCell>{e.registeredCount}{e.capacity !== null && ` / ${e.capacity}`}</TableCell>
                <TableCell><StatusBadge status={e.status} /></TableCell>
                <TableCell className="text-right"><EventActions event={e} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: `src/components/admin/event-actions.tsx`** (client)

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, ClientApiError } from "@/lib/api-client";
import type { EventDto } from "@/server/services/events";

export function EventActions({ event, afterChange }: { event: Pick<EventDto, "id" | "status" | "title">; afterChange?: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "publish" | "cancel") {
    setBusy(true);
    setError(null);
    try {
      await api(`/events/${event.id}/${action}`, { method: "POST" });
      setConfirmCancel(false);
      afterChange ? afterChange() : router.refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button asChild variant="outline" size="sm">
        <Link href={`/admin/events/${event.id}/registrations`}>Registrations</Link>
      </Button>
      {event.status === "DRAFT" && (
        <Button size="sm" disabled={busy} onClick={() => run("publish")}>Publish</Button>
      )}
      {event.status !== "CANCELLED" && (
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel event</Button>
      )}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel “{event.title}”?</DialogTitle>
            <DialogDescription>Members will no longer be able to register. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmCancel(false)}>Keep event</Button>
            <Button variant="destructive" disabled={busy} onClick={() => run("cancel")}>Cancel event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: `src/components/admin/event-form.tsx`** (client, react-hook-form)

The form keeps wall-clock strings plus a timezone, and converts to UTC ISO on submit with `zonedInputToUtc`. On edit it converts stored UTC back with `utcToZonedInput`.

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, ClientApiError } from "@/lib/api-client";
import { SEA_TIMEZONES, utcToZonedInput, zonedInputToUtc } from "@/lib/dates";
import type { EventDto } from "@/server/services/events";

type Option = { id: string; name: string };

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(20000),
  hostChapterId: z.string().min(1, "Choose a chapter"),
  eventTypeId: z.string().min(1, "Choose a theme"),
  startLocal: z.string().min(1, "Start is required"),
  endLocal: z.string().min(1, "End is required"),
  timezone: z.string().min(1),
  venue: z.string().max(300),
  isOnline: z.boolean(),
  onlineUrl: z.string().max(2000),
  coverImageUrl: z.string().max(2000),
  visibility: z.enum(["LOCAL", "REGIONAL", "CHAPTER_SPECIFIC"]),
  accessChapterIds: z.array(z.string()),
  capacity: z.string(),
  regOpensLocal: z.string(),
  regClosesLocal: z.string(),
  paymentType: z.enum(["FREE", "PAID"]),
  price: z.string(),
  currency: z.string(),
  paymentInstructions: z.string().max(5000),
  paymentUrl: z.string().max(2000),
});
type FormValues = z.infer<typeof formSchema>;

type Props = {
  chapters: Option[];
  types: Option[];
  lockedChapterId?: string; // chapter admins cannot change host chapter
  event?: EventDto;         // edit mode
};

function toFormValues(event: EventDto | undefined, defaults: { chapterId: string; typeId: string }): FormValues {
  if (!event) {
    return {
      title: "", description: "", hostChapterId: defaults.chapterId, eventTypeId: defaults.typeId,
      startLocal: "", endLocal: "", timezone: "Asia/Singapore", venue: "", isOnline: false, onlineUrl: "", coverImageUrl: "",
      visibility: "REGIONAL", accessChapterIds: [], capacity: "", regOpensLocal: "", regClosesLocal: "",
      paymentType: "FREE", price: "", currency: "SGD", paymentInstructions: "", paymentUrl: "",
    };
  }
  const tz = event.timezone;
  return {
    title: event.title, description: event.description, hostChapterId: event.hostChapter.id, eventTypeId: event.eventType.id,
    startLocal: utcToZonedInput(new Date(event.startAt), tz), endLocal: utcToZonedInput(new Date(event.endAt), tz), timezone: tz,
    venue: event.venue, isOnline: event.isOnline, onlineUrl: event.onlineUrl ?? "", coverImageUrl: event.coverImageUrl ?? "",
    visibility: event.visibility, accessChapterIds: event.accessChapters.map((c) => c.id),
    capacity: event.capacity?.toString() ?? "",
    regOpensLocal: event.registrationOpensAt ? utcToZonedInput(new Date(event.registrationOpensAt), tz) : "",
    regClosesLocal: event.registrationClosesAt ? utcToZonedInput(new Date(event.registrationClosesAt), tz) : "",
    paymentType: event.paymentType, price: event.price?.toString() ?? "", currency: event.currency ?? "SGD",
    paymentInstructions: event.paymentInstructions ?? "", paymentUrl: event.paymentUrl ?? "",
  };
}

function toApiBody(v: FormValues) {
  const tz = v.timezone;
  const opt = (s: string) => (s ? zonedInputToUtc(s, tz).toISOString() : null);
  return {
    title: v.title, description: v.description, hostChapterId: v.hostChapterId, eventTypeId: v.eventTypeId,
    startAt: zonedInputToUtc(v.startLocal, tz).toISOString(), endAt: zonedInputToUtc(v.endLocal, tz).toISOString(), timezone: tz,
    venue: v.venue, isOnline: v.isOnline, onlineUrl: v.onlineUrl || null, coverImageUrl: v.coverImageUrl || null,
    visibility: v.visibility, accessChapterIds: v.visibility === "CHAPTER_SPECIFIC" ? v.accessChapterIds : [],
    capacity: v.capacity ? Number(v.capacity) : null,
    registrationOpensAt: opt(v.regOpensLocal), registrationClosesAt: opt(v.regClosesLocal),
    paymentType: v.paymentType, price: v.price ? Number(v.price) : null, currency: v.currency || null,
    paymentInstructions: v.paymentInstructions || null, paymentUrl: v.paymentUrl || null,
  };
}

export function EventForm({ chapters, types, lockedChapterId, event }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(event, { chapterId: lockedChapterId ?? chapters[0]?.id ?? "", typeId: types[0]?.id ?? "" }),
  });
  const { register, handleSubmit, control, watch, setError, formState: { errors, isSubmitting } } = form;
  const visibility = watch("visibility");
  const paymentType = watch("paymentType");
  const isOnline = watch("isOnline");

  async function submit(values: FormValues, publish: boolean) {
    setServerError(null);
    try {
      const body = toApiBody(values);
      const saved = event
        ? await api<EventDto>(`/events/${event.id}`, { method: "PATCH", json: body })
        : await api<EventDto>("/events", { method: "POST", json: body });
      if (publish && saved.status === "DRAFT") await api(`/events/${saved.id}/publish`, { method: "POST" });
      router.push("/admin/events");
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError) {
        const fields = e.body.fields ?? {};
        const map: Record<string, keyof FormValues> = { startAt: "startLocal", endAt: "endLocal", registrationOpensAt: "regOpensLocal", registrationClosesAt: "regClosesLocal" };
        for (const [k, msgs] of Object.entries(fields)) {
          const key = (map[k] ?? k) as keyof FormValues;
          if (key in values) setError(key, { message: msgs[0] });
        }
        setServerError(e.message);
      } else setServerError("Could not save the event");
    }
  }

  const err = (k: keyof FormValues) => errors[k]?.message ? <p className="text-xs text-destructive">{String(errors[k]?.message)}</p> : null;

  return (
    <form className="max-w-3xl space-y-8" onSubmit={handleSubmit((v) => submit(v, false))}>
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Basics</h2>
        <div className="space-y-1">
          <Label htmlFor="title">Event name</Label>
          <Input id="title" {...register("title")} />
          {err("title")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Theme</Label>
            <Controller control={control} name="eventTypeId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue placeholder="Choose a theme" /></SelectTrigger>
                <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {err("eventTypeId")}
          </div>
          <div className="space-y-1">
            <Label>Host chapter</Label>
            <Controller control={control} name="hostChapterId" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={Boolean(lockedChapterId)}>
                <SelectTrigger><SelectValue placeholder="Choose a chapter" /></SelectTrigger>
                <SelectContent>{chapters.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
            {err("hostChapterId")}
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="description">Description (Markdown supported)</Label>
          <Textarea id="description" rows={8} {...register("description")} />
          {err("description")}
        </div>
        <div className="space-y-1">
          <Label htmlFor="coverImageUrl">Cover image URL (optional)</Label>
          <Input id="coverImageUrl" placeholder="https://…" {...register("coverImageUrl")} />
          {err("coverImageUrl")}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">When and where</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="startLocal">Starts</Label>
            <Input id="startLocal" type="datetime-local" {...register("startLocal")} />
            {err("startLocal")}
          </div>
          <div className="space-y-1">
            <Label htmlFor="endLocal">Ends</Label>
            <Input id="endLocal" type="datetime-local" {...register("endLocal")} />
            {err("endLocal")}
          </div>
          <div className="space-y-1">
            <Label>Timezone</Label>
            <Controller control={control} name="timezone" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SEA_TIMEZONES.map((z) => <SelectItem key={z.value} value={z.value}>{z.label}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Controller control={control} name="isOnline" render={({ field }) => <Switch id="isOnline" checked={field.value} onCheckedChange={field.onChange} />} />
          <Label htmlFor="isOnline">Online event</Label>
        </div>
        {isOnline ? (
          <div className="space-y-1">
            <Label htmlFor="onlineUrl">Join link</Label>
            <Input id="onlineUrl" placeholder="https://zoom.us/…" {...register("onlineUrl")} />
            {err("onlineUrl")}
          </div>
        ) : (
          <div className="space-y-1">
            <Label htmlFor="venue">Venue</Label>
            <Input id="venue" {...register("venue")} />
            {err("venue")}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Who can register</h2>
        <Controller control={control} name="visibility" render={({ field }) => (
          <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-2">
            {[
              ["REGIONAL", "Regional – any SEA member"],
              ["LOCAL", "Local – host chapter members only"],
              ["CHAPTER_SPECIFIC", "Chapter specific – choose chapters"],
            ].map(([v, l]) => (
              <div key={v} className="flex items-center gap-2">
                <RadioGroupItem value={v} id={`vis-${v}`} />
                <Label htmlFor={`vis-${v}`}>{l}</Label>
              </div>
            ))}
          </RadioGroup>
        )} />
        {visibility === "CHAPTER_SPECIFIC" && (
          <Controller control={control} name="accessChapterIds" render={({ field }) => (
            <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
              {chapters.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value.includes(c.id)}
                    onCheckedChange={(on) => field.onChange(on ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))}
                  />
                  {c.name}
                </label>
              ))}
              {err("accessChapterIds")}
            </div>
          )} />
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="capacity">Capacity (blank = unlimited)</Label>
            <Input id="capacity" type="number" min={1} {...register("capacity")} />
            {err("capacity")}
          </div>
          <div className="space-y-1">
            <Label htmlFor="regOpensLocal">Registration opens (optional)</Label>
            <Input id="regOpensLocal" type="datetime-local" {...register("regOpensLocal")} />
            {err("regOpensLocal")}
          </div>
          <div className="space-y-1">
            <Label htmlFor="regClosesLocal">Registration closes (optional)</Label>
            <Input id="regClosesLocal" type="datetime-local" {...register("regClosesLocal")} />
            {err("regClosesLocal")}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Payment</h2>
        <Controller control={control} name="paymentType" render={({ field }) => (
          <RadioGroup value={field.value} onValueChange={field.onChange} className="flex gap-6">
            <div className="flex items-center gap-2"><RadioGroupItem value="FREE" id="pay-free" /><Label htmlFor="pay-free">Free</Label></div>
            <div className="flex items-center gap-2"><RadioGroupItem value="PAID" id="pay-paid" /><Label htmlFor="pay-paid">Paid</Label></div>
          </RadioGroup>
        )} />
        {paymentType === "PAID" && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="price">Price</Label>
                <Input id="price" type="number" min={0} step="0.01" {...register("price")} />
                {err("price")}
              </div>
              <div className="space-y-1">
                <Label htmlFor="currency">Currency (3 letters)</Label>
                <Input id="currency" maxLength={3} {...register("currency")} />
                {err("currency")}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="paymentInstructions">Payment instructions</Label>
              <Textarea id="paymentInstructions" rows={3} {...register("paymentInstructions")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paymentUrl">Payment link (optional)</Label>
              <Input id="paymentUrl" placeholder="https://…" {...register("paymentUrl")} />
              {err("paymentUrl")}
            </div>
          </div>
        )}
      </section>

      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={isSubmitting}>{event ? "Save changes" : "Save as draft"}</Button>
        {(!event || event.status === "DRAFT") && (
          <Button type="button" disabled={isSubmitting} onClick={handleSubmit((v) => submit(v, true))}>
            {event ? "Save and publish" : "Publish"}
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 5: New and edit pages**

`src/app/admin/events/new/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { listChapters, listEventTypes } from "@/server/services/events";
import { EventForm } from "@/components/admin/event-form";

export default async function NewEventPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [chapters, types] = await Promise.all([listChapters(), listEventTypes()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">New event</h1>
      <EventForm chapters={chapters} types={types} lockedChapterId={user.role === "SUPER_ADMIN" ? undefined : user.chapterId} />
    </div>
  );
}
```

`src/app/admin/events/[id]/edit/page.tsx`:
```tsx
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { getEvent, listChapters, listEventTypes } from "@/server/services/events";
import { ApiError } from "@/server/api";
import { EventForm } from "@/components/admin/event-form";
import { EventActions } from "@/components/admin/event-actions";
import { StatusBadge } from "@/components/events/event-badges";

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { id } = await params;
  let event;
  try {
    event = await getEvent(user, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (!event.canManage) redirect("/admin/events");
  const [chapters, types] = await Promise.all([listChapters(), listEventTypes()]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">Edit event <StatusBadge status={event.status} /></h1>
        <EventActions event={event} />
      </div>
      <EventForm chapters={chapters} types={types} lockedChapterId={user.role === "SUPER_ADMIN" ? undefined : user.chapterId} event={event} />
    </div>
  );
}
```

- [ ] **Step 6: Browser check** — as admin: New event → fill → Publish → appears in admin table and member list. Edit → change title → Save. Cancel via dialog. As Test Member: sees published events, LOCAL event shows "Open to Singapore members" and disabled Register when outside scope.

- [ ] **Step 7:** `make test && make lint && make typecheck`. Commit: `git commit -m "feat: admin event management UI"`.
