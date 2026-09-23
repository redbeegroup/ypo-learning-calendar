import { describe, it, expect } from "vitest";
import { GET as listEvents, POST as createEvent } from "@/app/api/v1/events/route";
import { GET as getEvent, PATCH as updateEvent, DELETE as deleteEvent } from "@/app/api/v1/events/[id]/route";
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
      eventBody({
        hostChapterId: w.sg.id,
        eventTypeId: w.type.id,
        endAt: "2026-09-01T00:00:00.000Z",
        paymentType: "PAID",
      }),
    );
    expect(bad.res.status).toBe(400);
    expect(bad.body.error.fields.endAt).toBeDefined();
    expect(bad.body.error.fields.price).toBeDefined();
  });

  it("stores chapter access for CHAPTER_SPECIFIC events", async () => {
    const w = await world();
    const r = await create(
      await w.t(w.superAdmin),
      eventBody({
        hostChapterId: w.sg.id,
        eventTypeId: w.type.id,
        visibility: "CHAPTER_SPECIFIC",
        accessChapterIds: [w.my.id],
      }),
    );
    expect(r.res.status).toBe(201);
    expect(r.body.data.accessChapters.map((c: { code: string }) => c.code)).toEqual(["MY"]);
  });
});

describe("programme fields", () => {
  it("stores chairs, resources and agenda and validates them", async () => {
    const w = await world();
    const tok = await w.t(w.superAdmin);
    const programme = {
      chairs: ["Mr. Minh Le", "Ms. Van Ma"],
      resources: [{ name: "Dr. Ada Lovelace", photoUrl: "https://example.com/ada.jpg", bio: "Pioneer of **computing**." }],
      agenda: [
        { time: "09:00", title: "Registration", description: "" },
        { time: "09:30", title: "Keynote", description: "AI for family businesses" },
      ],
    };
    const ok = await create(tok, eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id, ...programme }));
    expect(ok.res.status).toBe(201);
    expect(ok.body.data.chairs).toEqual(programme.chairs);
    expect(ok.body.data.resources).toEqual(programme.resources);
    expect(ok.body.data.agenda).toEqual(programme.agenda);

    const bad = await create(
      tok,
      eventBody({
        hostChapterId: w.sg.id,
        eventTypeId: w.type.id,
        resources: [{ name: "", photoUrl: "not a url", bio: "" }],
        agenda: [{ time: "", title: "", description: "" }],
      }),
    );
    expect(bad.res.status).toBe(400);
    expect(bad.body.error.fields["resources.0.name"]).toBeDefined();
    expect(bad.body.error.fields["resources.0.photoUrl"]).toBeDefined();
    expect(bad.body.error.fields["agenda.0.title"]).toBeDefined();
  });
});

describe("publish, update, cancel", () => {
  it("only managers of the host chapter can publish/update/cancel", async () => {
    const w = await world();
    const { body } = await create(await w.t(w.sgAdmin), eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id }));
    const id = body.data.id;

    const denied = await publishEvent(
      jsonRequest(`/api/v1/events/${id}/publish`, "POST", undefined, await w.t(w.myAdmin)),
      p(id),
    );
    expect(denied.status).toBe(403);
    const pub = await publishEvent(
      jsonRequest(`/api/v1/events/${id}/publish`, "POST", undefined, await w.t(w.sgAdmin)),
      p(id),
    );
    expect(pub.status).toBe(200);
    expect((await pub.json()).data.status).toBe("PUBLISHED");

    const upd = await updateEvent(
      jsonRequest(
        `/api/v1/events/${id}`,
        "PATCH",
        eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id, title: "Renamed" }),
        await w.t(w.sgAdmin),
      ),
      p(id),
    );
    expect(upd.status).toBe(200);
    expect((await upd.json()).data.title).toBe("Renamed");

    const can = await cancelEvent(
      jsonRequest(`/api/v1/events/${id}/cancel`, "POST", undefined, await w.t(w.superAdmin)),
      p(id),
    );
    expect((await can.json()).data.status).toBe("CANCELLED");
  });
});

describe("DELETE /api/v1/events/:id", () => {
  it("only super admins can delete; the event is gone afterwards", async () => {
    const w = await world();
    const { body } = await create(await w.t(w.sgAdmin), eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id }));
    const id = body.data.id;
    const denied = await deleteEvent(jsonRequest(`/api/v1/events/${id}`, "DELETE", undefined, await w.t(w.sgAdmin)), p(id));
    expect(denied.status).toBe(403);
    const ok = await deleteEvent(jsonRequest(`/api/v1/events/${id}`, "DELETE", undefined, await w.t(w.superAdmin)), p(id));
    expect(ok.status).toBe(200);
    const gone = await getEvent(jsonRequest(`/api/v1/events/${id}`, "GET", undefined, await w.t(w.superAdmin)), p(id));
    expect(gone.status).toBe(404);
  });
});

describe("GET /api/v1/events and /:id", () => {
  async function seedEvents(w: Awaited<ReturnType<typeof world>>) {
    const tok = await w.t(w.superAdmin);
    const mk = async (o: Record<string, unknown>, publish = true) => {
      const { body } = await create(tok, eventBody({ hostChapterId: w.sg.id, eventTypeId: w.type.id, ...o }));
      if (publish) {
        await publishEvent(
          jsonRequest(`/api/v1/events/${body.data.id}/publish`, "POST", undefined, tok),
          p(body.data.id),
        );
      }
      return body.data.id as string;
    };
    const regional = await mk({ title: "Regional Summit", venue: "Marina Bay" });
    const local = await mk({ title: "SG Local Forum", visibility: "LOCAL" });
    const paid = await mk({
      title: "Paid Workshop",
      paymentType: "PAID",
      price: 50,
      currency: "SGD",
      hostChapterId: w.my.id,
    });
    const later = await mk({
      title: "December Retreat",
      startAt: "2026-12-05T01:00:00.000Z",
      endAt: "2026-12-06T09:00:00.000Z",
    });
    const draft = await mk({ title: "Secret Draft" }, false);
    return { regional, local, paid, later, draft };
  }

  const titles = async (res: Response) => (await res.json()).data.items.map((e: { title: string }) => e.title);
  const list = (qs: string, token: string) =>
    listEvents(jsonRequest(`/api/v1/events${qs}`, "GET", undefined, token), noParams);

  it("members see published events only, sorted by date, with registration info", async () => {
    const w = await world();
    await seedEvents(w);
    const res = await list("?from=2026-09-01T00:00:00.000Z", await w.t(w.myMember));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items.map((e: { title: string }) => e.title)).toEqual([
      "Paid Workshop",
      "Regional Summit",
      "SG Local Forum",
      "December Retreat",
    ]);
    const local = body.data.items.find((e: { title: string }) => e.title === "SG Local Forum");
    expect(local.registration).toEqual({ ok: false, reason: "NOT_IN_SCOPE" });
    expect(body.data.total).toBe(4);
  });

  it("searches and filters", async () => {
    const w = await world();
    await seedEvents(w);
    const tok = await w.t(w.myMember);
    expect(await titles(await list("?q=marina&from=2026-09-01T00:00:00.000Z", tok))).toEqual(["Regional Summit"]);
    expect(await titles(await list(`?chapterIds=${w.my.id}&from=2026-09-01T00:00:00.000Z`, tok))).toEqual([
      "Paid Workshop",
    ]);
    expect(await titles(await list("?payment=PAID&from=2026-09-01T00:00:00.000Z", tok))).toEqual(["Paid Workshop"]);
    expect(await titles(await list("?from=2026-12-01T00:00:00.000Z&to=2026-12-31T00:00:00.000Z", tok))).toEqual([
      "December Retreat",
    ]);
    expect(await titles(await list("?registrableOnly=true&from=2026-09-01T00:00:00.000Z", tok))).toEqual([
      "Paid Workshop",
      "Regional Summit",
      "December Retreat",
    ]);
  });

  it("admins can list drafts in their scope", async () => {
    const w = await world();
    await seedEvents(w);
    expect(await titles(await list("?status=DRAFT&from=2026-09-01T00:00:00.000Z", await w.t(w.sgAdmin)))).toEqual([
      "Secret Draft",
    ]);
    expect(await titles(await list("?status=DRAFT&from=2026-09-01T00:00:00.000Z", await w.t(w.myAdmin)))).toEqual([]);
    expect((await list("?status=DRAFT", await w.t(w.sgMember))).status).toBe(403);
  });

  it("detail hides drafts from members and includes canManage", async () => {
    const w = await world();
    const ids = await seedEvents(w);
    const hidden = await getEvent(
      jsonRequest(`/api/v1/events/${ids.draft}`, "GET", undefined, await w.t(w.sgMember)),
      p(ids.draft),
    );
    expect(hidden.status).toBe(404);
    const asAdmin = await getEvent(
      jsonRequest(`/api/v1/events/${ids.draft}`, "GET", undefined, await w.t(w.sgAdmin)),
      p(ids.draft),
    );
    expect(asAdmin.status).toBe(200);
    expect((await asAdmin.json()).data.canManage).toBe(true);
    const asMember = await getEvent(
      jsonRequest(`/api/v1/events/${ids.regional}`, "GET", undefined, await w.t(w.sgMember)),
      p(ids.regional),
    );
    expect((await asMember.json()).data.canManage).toBe(false);
  });
});
