# Phase 5: Registration and Waitlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Members register for events (or join the waitlist when full), cancel, and see their registrations; admins see attendee lists, mark payments, and export CSV. Waitlisted members are promoted automatically when a seat frees up.

**Architecture:** `src/server/services/registrations.ts` owns all registration writes inside a database transaction that first locks the event row (`SELECT … FOR UPDATE`) so two members racing for the last seat are serialised. The event DTO gains `myRegistration` and `waitlistPosition` so the detail page and list can show the member's own status. Emails go through the existing sender.

**Tech Stack:** Prisma interactive transactions with raw row lock, Zod, existing email sender, shadcn table/badge/select.

---

## File structure

```
src/server/services/registrations.ts          register, cancel, promote, listMine, listForEvent, setPaymentStatus, toCsv
src/server/services/events.ts                 include actor's registration; DTO adds myRegistration + waitlistPosition
src/server/email/templates.ts                 registrationEmail (registered/waitlisted), promotedEmail
src/lib/validation/registrations.ts           paymentStatusSchema
src/app/api/v1/events/[id]/register/route.ts  POST register, DELETE cancel
src/app/api/v1/events/[id]/registrations/route.ts         GET attendee list (admin)
src/app/api/v1/events/[id]/registrations/export/route.ts  GET CSV (admin)
src/app/api/v1/registrations/[id]/route.ts    PATCH paymentStatus (admin)
src/app/api/v1/me/registrations/route.ts      GET my registrations
src/components/events/register-button.tsx     client: register / waitlist / cancel
src/app/(member)/events/[id]/page.tsx         use RegisterButton
src/app/(member)/my-registrations/page.tsx
src/app/admin/events/[id]/registrations/page.tsx
src/components/admin/registrations-table.tsx  client: payment status select
tests/api/registrations.test.ts
```

---

### Task 1: Service, DTO changes, emails, routes (TDD)

- [ ] **Step 1: Failing tests `tests/api/registrations.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { POST as createEvent } from "@/app/api/v1/events/route";
import { GET as getEvent } from "@/app/api/v1/events/[id]/route";
import { POST as publishEvent } from "@/app/api/v1/events/[id]/publish/route";
import { POST as register, DELETE as cancel } from "@/app/api/v1/events/[id]/register/route";
import { GET as listRegs } from "@/app/api/v1/events/[id]/registrations/route";
import { GET as exportCsv } from "@/app/api/v1/events/[id]/registrations/export/route";
import { PATCH as patchReg } from "@/app/api/v1/registrations/[id]/route";
import { GET as myRegs } from "@/app/api/v1/me/registrations/route";
import { sentEmails } from "./setup";
import { jsonRequest, createChapter, createUser, createEventType, tokenFor, eventBody } from "./helpers";

const p = (id: string) => ({ params: Promise.resolve({ id }) });
const noParams = { params: Promise.resolve({}) };

async function world(capacity: number | null = 1, overrides: Record<string, unknown> = {}) {
  const sg = await createChapter("SG", "Singapore");
  const my = await createChapter("MY", "Malaysia");
  const type = await createEventType();
  const admin = await createUser({ email: "admin@x.com", chapterId: sg.id, role: "CHAPTER_ADMIN" });
  const a = await createUser({ email: "a@x.com", chapterId: sg.id });
  const b = await createUser({ email: "b@x.com", chapterId: sg.id });
  const outsider = await createUser({ email: "o@x.com", chapterId: my.id });
  const tok = await tokenFor(admin.id);
  const res = await createEvent(
    jsonRequest("/api/v1/events", "POST", eventBody({ hostChapterId: sg.id, eventTypeId: type.id, capacity, visibility: "LOCAL", ...overrides }), tok),
    noParams,
  );
  const event = (await res.json()).data;
  await publishEvent(jsonRequest(`/api/v1/events/${event.id}/publish`, "POST", undefined, tok), p(event.id));
  const t = (u: { id: string }) => tokenFor(u.id);
  return { sg, my, admin, a, b, outsider, event, t, tok };
}

const reg = async (eventId: string, token: string) => register(jsonRequest(`/api/v1/events/${eventId}/register`, "POST", undefined, token), p(eventId));
const unreg = async (eventId: string, token: string) => cancel(jsonRequest(`/api/v1/events/${eventId}/register`, "DELETE", undefined, token), p(eventId));

describe("registration", () => {
  it("registers, then waitlists when full, and promotes on cancel", async () => {
    const w = await world(1);
    const r1 = await reg(w.event.id, await w.t(w.a));
    expect(r1.status).toBe(201);
    expect((await r1.json()).data.status).toBe("REGISTERED");
    expect(sentEmails.at(-1)?.to).toBe("a@x.com");

    const r2 = await reg(w.event.id, await w.t(w.b));
    expect((await r2.json()).data.status).toBe("WAITLISTED");

    const detail = await getEvent(jsonRequest(`/api/v1/events/${w.event.id}`, "GET", undefined, await w.t(w.b)), p(w.event.id));
    const d = (await detail.json()).data;
    expect(d.myRegistration.status).toBe("WAITLISTED");
    expect(d.waitlistPosition).toBe(1);
    expect(d.spotsLeft).toBe(0);

    sentEmails.length = 0;
    const c = await unreg(w.event.id, await w.t(w.a));
    expect(c.status).toBe(200);
    const promoted = sentEmails.find((e) => e.to === "b@x.com");
    expect(promoted?.subject).toMatch(/spot/i);
    const after = await getEvent(jsonRequest(`/api/v1/events/${w.event.id}`, "GET", undefined, await w.t(w.b)), p(w.event.id));
    expect((await after.json()).data.myRegistration.status).toBe("REGISTERED");
  });

  it("rejects duplicates, out-of-scope members, and drafts", async () => {
    const w = await world(null);
    await reg(w.event.id, await w.t(w.a));
    expect((await reg(w.event.id, await w.t(w.a))).status).toBe(409);
    const denied = await reg(w.event.id, await w.t(w.outsider));
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("NOT_IN_SCOPE");
  });

  it("serialises two members racing for the last seat", async () => {
    const w = await world(1);
    const [r1, r2] = await Promise.all([reg(w.event.id, await w.t(w.a)), reg(w.event.id, await w.t(w.b))]);
    const statuses = [(await r1.json()).data.status, (await r2.json()).data.status].sort();
    expect(statuses).toEqual(["REGISTERED", "WAITLISTED"]);
  });

  it("allows re-registering after cancelling", async () => {
    const w = await world(null);
    await reg(w.event.id, await w.t(w.a));
    await unreg(w.event.id, await w.t(w.a));
    const again = await reg(w.event.id, await w.t(w.a));
    expect(again.status).toBe(201);
    expect((await again.json()).data.status).toBe("REGISTERED");
  });

  it("paid events start PENDING and admins can mark PAID", async () => {
    const w = await world(null, { paymentType: "PAID", price: 100, currency: "SGD" });
    const r = await reg(w.event.id, await w.t(w.a));
    const created = (await r.json()).data;
    expect(created.paymentStatus).toBe("PENDING");
    const list = await listRegs(jsonRequest(`/api/v1/events/${w.event.id}/registrations`, "GET", undefined, w.tok), p(w.event.id));
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.data.registered[0].user.email).toBe("a@x.com");
    const patched = await patchReg(jsonRequest(`/api/v1/registrations/${created.id}`, "PATCH", { paymentStatus: "PAID" }, w.tok), p(created.id));
    expect((await patched.json()).data.paymentStatus).toBe("PAID");
    const denied = await listRegs(jsonRequest(`/api/v1/events/${w.event.id}/registrations`, "GET", undefined, await w.t(w.a)), p(w.event.id));
    expect(denied.status).toBe(403);
  });

  it("exports csv and lists my registrations", async () => {
    const w = await world(null);
    await reg(w.event.id, await w.t(w.a));
    const csv = await exportCsv(jsonRequest(`/api/v1/events/${w.event.id}/registrations/export`, "GET", undefined, w.tok), p(w.event.id));
    expect(csv.headers.get("content-type")).toContain("text/csv");
    const text = await csv.text();
    expect(text.split("\n")[0]).toBe("Name,Email,Chapter,Status,Payment,Registered at");
    expect(text).toContain("a@x.com");
    const mine = await myRegs(jsonRequest("/api/v1/me/registrations", "GET", undefined, await w.t(w.a)), noParams);
    const m = (await mine.json()).data;
    expect(m.upcoming).toHaveLength(1);
    expect(m.upcoming[0].event.title).toBe("Leadership Breakfast");
  });
});
```

- [ ] **Step 2: Extend event DTO** — `src/server/services/events.ts`: make `include` a function of the actor id that also includes `registrations: { where: { userId } }`; `toEventDto` adds `myRegistration: { id, status, paymentStatus } | null` and `waitlistPosition: number | null`; `getEvent` computes the position (count of WAITLISTED with `registeredAt` earlier than mine, plus one).

- [ ] **Step 3: Emails** — add to `templates.ts`: `registrationEmail(to, name, event, status)` (subject "You're registered: …" or "You're on the waitlist: …") and `promotedEmail(to, name, event)` (subject "A spot opened up: …"). Each includes the event title, formatted date range, venue/online, payment instructions when PAID, and a link to `${APP_URL}/events/${id}`.

- [ ] **Step 4: Service `src/server/services/registrations.ts`** — functions `registerForEvent`, `cancelRegistration`, `listMyRegistrations`, `listEventRegistrations`, `setPaymentStatus`, `registrationsToCsv`. Registration and cancellation run in `prisma.$transaction(async (tx) => { await tx.$executeRaw\`SELECT id FROM "Event" WHERE id = ${id} FOR UPDATE\`; … })`. Promotion happens inside the cancellation transaction; emails are sent after commit.

- [ ] **Step 5: Routes** — thin handlers as listed in the file structure. `DELETE …/register` returns `{ cancelled: true, promoted: userId | null }`.

- [ ] **Step 6:** `make test` green. Commit `feat: registration and waitlist service and api`.

### Task 2: UI

- [ ] `register-button.tsx`: shows current state (Registered / Waitlisted #N / not registered), primary action Register or Join waitlist, secondary Cancel registration with confirm dialog; calls API and `router.refresh()`.
- [ ] Detail page uses `RegisterButton`; shows payment box prominently when registered and PENDING.
- [ ] `/my-registrations`: two sections (Upcoming, Past), each row → event card-like row with status + payment badges.
- [ ] `/admin/events/[id]/registrations`: heading with counts, tabs-like sections Registered / Waitlisted / Cancelled, table with name, email, chapter, registered at, payment select (PAID events), Export CSV button → `/api/v1/events/:id/registrations/export`.
- [ ] Browser check as member and admin. `make lint && make typecheck && make test`. Commit `feat: registration UI, my registrations, admin attendee list`.
