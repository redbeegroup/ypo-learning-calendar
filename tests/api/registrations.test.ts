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
    jsonRequest(
      "/api/v1/events",
      "POST",
      eventBody({ hostChapterId: sg.id, eventTypeId: type.id, capacity, visibility: "LOCAL", ...overrides }),
      tok,
    ),
    noParams,
  );
  const event = (await res.json()).data;
  await publishEvent(jsonRequest(`/api/v1/events/${event.id}/publish`, "POST", undefined, tok), p(event.id));
  const t = (u: { id: string }) => tokenFor(u.id);
  return { sg, my, admin, a, b, outsider, event, t, tok };
}

const reg = (eventId: string, token: string) =>
  register(jsonRequest(`/api/v1/events/${eventId}/register`, "POST", undefined, token), p(eventId));
const unreg = (eventId: string, token: string) =>
  cancel(jsonRequest(`/api/v1/events/${eventId}/register`, "DELETE", undefined, token), p(eventId));
const detail = async (eventId: string, token: string) =>
  (await (await getEvent(jsonRequest(`/api/v1/events/${eventId}`, "GET", undefined, token), p(eventId))).json()).data;

describe("registration", () => {
  it("registers, then waitlists when full, and promotes on cancel", async () => {
    const w = await world(1);
    const r1 = await reg(w.event.id, await w.t(w.a));
    expect(r1.status).toBe(201);
    expect((await r1.json()).data.status).toBe("REGISTERED");
    expect(sentEmails.at(-1)?.to).toBe("a@x.com");
    expect(sentEmails.at(-1)?.subject).toMatch(/registered/i);

    const r2 = await reg(w.event.id, await w.t(w.b));
    expect((await r2.json()).data.status).toBe("WAITLISTED");
    expect(sentEmails.at(-1)?.subject).toMatch(/waitlist/i);

    const d = await detail(w.event.id, await w.t(w.b));
    expect(d.myRegistration.status).toBe("WAITLISTED");
    expect(d.waitlistPosition).toBe(1);
    expect(d.spotsLeft).toBe(0);
    expect(d.waitlistedCount).toBe(1);

    sentEmails.length = 0;
    const c = await unreg(w.event.id, await w.t(w.a));
    expect(c.status).toBe(200);
    expect((await c.json()).data.promotedUserIds).toEqual([w.b.id]);
    const promoted = sentEmails.find((e) => e.to === "b@x.com");
    expect(promoted?.subject).toMatch(/spot opened/i);
    const after = await detail(w.event.id, await w.t(w.b));
    expect(after.myRegistration.status).toBe("REGISTERED");
    expect(after.waitlistPosition).toBeNull();
    const aAfter = await detail(w.event.id, await w.t(w.a));
    expect(aAfter.myRegistration).toBeNull();
  });

  it("rejects duplicates, out-of-scope members, and non-registered cancels", async () => {
    const w = await world(null);
    await reg(w.event.id, await w.t(w.a));
    expect((await reg(w.event.id, await w.t(w.a))).status).toBe(409);
    const denied = await reg(w.event.id, await w.t(w.outsider));
    expect(denied.status).toBe(403);
    expect((await denied.json()).error.code).toBe("NOT_IN_SCOPE");
    expect((await unreg(w.event.id, await w.t(w.b))).status).toBe(404);
  });

  it("serialises two members racing for the last seat", async () => {
    const w = await world(1);
    const [ta, tb] = await Promise.all([w.t(w.a), w.t(w.b)]);
    const [r1, r2] = await Promise.all([reg(w.event.id, ta), reg(w.event.id, tb)]);
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
    const list = await listRegs(
      jsonRequest(`/api/v1/events/${w.event.id}/registrations`, "GET", undefined, w.tok),
      p(w.event.id),
    );
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.data.registered[0].user.email).toBe("a@x.com");
    const patched = await patchReg(
      jsonRequest(`/api/v1/registrations/${created.id}`, "PATCH", { paymentStatus: "PAID" }, w.tok),
      p(created.id),
    );
    expect((await patched.json()).data.paymentStatus).toBe("PAID");
    const denied = await listRegs(
      jsonRequest(`/api/v1/events/${w.event.id}/registrations`, "GET", undefined, await w.t(w.a)),
      p(w.event.id),
    );
    expect(denied.status).toBe(403);
  });

  it("exports csv and lists my registrations", async () => {
    const w = await world(null);
    await reg(w.event.id, await w.t(w.a));
    const csv = await exportCsv(
      jsonRequest(`/api/v1/events/${w.event.id}/registrations/export`, "GET", undefined, w.tok),
      p(w.event.id),
    );
    expect(csv.headers.get("content-type")).toContain("text/csv");
    const text = await csv.text();
    expect(text.split("\n")[0]).toBe("Name,Email,Chapter,Status,Payment,Registered at");
    expect(text).toContain("a@x.com");
    const mine = await myRegs(jsonRequest("/api/v1/me/registrations", "GET", undefined, await w.t(w.a)), noParams);
    const m = (await mine.json()).data;
    expect(m.upcoming).toHaveLength(1);
    expect(m.upcoming[0].event.title).toBe("Leadership Breakfast");
    expect(m.past).toHaveLength(0);
  });
});
