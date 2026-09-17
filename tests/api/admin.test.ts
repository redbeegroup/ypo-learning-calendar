import { describe, it, expect } from "vitest";
import { GET as listUsers, POST as inviteUser } from "@/app/api/v1/users/route";
import { PATCH as patchUser } from "@/app/api/v1/users/[id]/route";
import { POST as resendInvite } from "@/app/api/v1/users/[id]/resend-invite/route";
import { GET as getChapters, POST as postChapter } from "@/app/api/v1/chapters/route";
import { PATCH as patchChapter } from "@/app/api/v1/chapters/[id]/route";
import { GET as getTypes, POST as postType } from "@/app/api/v1/event-types/route";
import { PATCH as patchType } from "@/app/api/v1/event-types/[id]/route";
import { sentEmails } from "./setup";
import { jsonRequest, createChapter, createUser, tokenFor } from "./helpers";

const p = (id: string) => ({ params: Promise.resolve({ id }) });
const noParams = { params: Promise.resolve({}) };

async function world() {
  const sg = await createChapter("SG", "Singapore");
  const my = await createChapter("MY", "Malaysia");
  const superAdmin = await createUser({ email: "super@x.com", chapterId: sg.id, role: "SUPER_ADMIN" });
  const sgAdmin = await createUser({ email: "sgadmin@x.com", chapterId: sg.id, role: "CHAPTER_ADMIN" });
  const sgMember = await createUser({ email: "sg@x.com", chapterId: sg.id });
  const myMember = await createUser({ email: "my@x.com", chapterId: my.id });
  const invited = await createUser({ email: "inv@x.com", chapterId: sg.id, status: "INVITED" });
  const t = (u: { id: string }) => tokenFor(u.id);
  return { sg, my, superAdmin, sgAdmin, sgMember, myMember, invited, t };
}

const emails = async (res: Response) => (await res.json()).data.items.map((u: { email: string }) => u.email).sort();

describe("users admin", () => {
  it("lists users within scope", async () => {
    const w = await world();
    expect(await emails(await listUsers(jsonRequest("/api/v1/users", "GET", undefined, await w.t(w.superAdmin)), noParams))).toEqual(
      ["inv@x.com", "my@x.com", "sg@x.com", "sgadmin@x.com", "super@x.com"],
    );
    expect(await emails(await listUsers(jsonRequest("/api/v1/users", "GET", undefined, await w.t(w.sgAdmin)), noParams))).toEqual(
      ["inv@x.com", "sg@x.com", "sgadmin@x.com", "super@x.com"],
    );
    expect(await emails(await listUsers(jsonRequest("/api/v1/users?q=inv", "GET", undefined, await w.t(w.superAdmin)), noParams))).toEqual(["inv@x.com"]);
    expect((await listUsers(jsonRequest("/api/v1/users", "GET", undefined, await w.t(w.sgMember)), noParams)).status).toBe(403);
  });

  it("enforces update rules", async () => {
    const w = await world();
    const sgTok = await w.t(w.sgAdmin);
    const superTok = await w.t(w.superAdmin);
    const rename = await patchUser(jsonRequest(`/api/v1/users/${w.sgMember.id}`, "PATCH", { name: "Renamed" }, sgTok), p(w.sgMember.id));
    expect(rename.status).toBe(200);
    expect((await rename.json()).data.name).toBe("Renamed");
    expect((await patchUser(jsonRequest(`/api/v1/users/${w.sgMember.id}`, "PATCH", { role: "CHAPTER_ADMIN" }, sgTok), p(w.sgMember.id))).status).toBe(403);
    expect((await patchUser(jsonRequest(`/api/v1/users/${w.sgMember.id}`, "PATCH", { chapterId: w.my.id }, sgTok), p(w.sgMember.id))).status).toBe(403);
    expect((await patchUser(jsonRequest(`/api/v1/users/${w.myMember.id}`, "PATCH", { name: "X" }, sgTok), p(w.myMember.id))).status).toBe(403);
    const promote = await patchUser(jsonRequest(`/api/v1/users/${w.sgMember.id}`, "PATCH", { role: "CHAPTER_ADMIN", chapterId: w.my.id }, superTok), p(w.sgMember.id));
    expect(promote.status).toBe(200);
    expect((await promote.json()).data.chapterName).toBe("Malaysia");
    expect((await patchUser(jsonRequest(`/api/v1/users/${w.superAdmin.id}`, "PATCH", { status: "DISABLED" }, superTok), p(w.superAdmin.id))).status).toBe(400);
    const disable = await patchUser(jsonRequest(`/api/v1/users/${w.invited.id}`, "PATCH", { status: "DISABLED" }, superTok), p(w.invited.id));
    expect((await disable.json()).data.status).toBe("DISABLED");
    const enable = await patchUser(jsonRequest(`/api/v1/users/${w.invited.id}`, "PATCH", { status: "ACTIVE" }, superTok), p(w.invited.id));
    expect((await enable.json()).data.status).toBe("INVITED");
  });

  it("supports a secondary chapter on invite and update", async () => {
    const w = await world();
    const superTok = await w.t(w.superAdmin);
    const same = await inviteUser(
      jsonRequest("/api/v1/users", "POST", { email: "dual@x.com", name: "Dual", chapterId: w.sg.id, secondaryChapterId: w.sg.id }, superTok),
      noParams,
    );
    expect(same.status).toBe(400);
    expect((await same.json()).error.fields.secondaryChapterId).toBeDefined();

    const ok = await inviteUser(
      jsonRequest("/api/v1/users", "POST", { email: "dual@x.com", name: "Dual", chapterId: w.my.id, secondaryChapterId: w.sg.id }, superTok),
      noParams,
    );
    expect(ok.status).toBe(201);
    const dual = (await ok.json()).data;
    expect(dual.secondaryChapterId).toBe(w.sg.id);

    // The Singapore chapter admin sees the member (secondary chapter) but cannot manage them (primary is Malaysia).
    expect(await emails(await listUsers(jsonRequest("/api/v1/users", "GET", undefined, await w.t(w.sgAdmin)), noParams))).toContain("dual@x.com");
    expect((await patchUser(jsonRequest(`/api/v1/users/${dual.id}`, "PATCH", { name: "X" }, await w.t(w.sgAdmin)), p(dual.id))).status).toBe(403);

    const cleared = await patchUser(jsonRequest(`/api/v1/users/${dual.id}`, "PATCH", { secondaryChapterId: null }, superTok), p(dual.id));
    expect(cleared.status).toBe(200);
    expect((await cleared.json()).data.secondaryChapterName).toBeNull();
  });

  it("resends invites only to invited users", async () => {
    const w = await world();
    const tok = await w.t(w.sgAdmin);
    const ok = await resendInvite(jsonRequest(`/api/v1/users/${w.invited.id}/resend-invite`, "POST", undefined, tok), p(w.invited.id));
    expect(ok.status).toBe(200);
    expect(sentEmails.at(-1)?.to).toBe("inv@x.com");
    expect((await resendInvite(jsonRequest(`/api/v1/users/${w.sgMember.id}/resend-invite`, "POST", undefined, tok), p(w.sgMember.id))).status).toBe(400);
  });
});

describe("chapters and event types", () => {
  it("super admin manages chapters; others cannot", async () => {
    const w = await world();
    const superTok = await w.t(w.superAdmin);
    const created = await postChapter(jsonRequest("/api/v1/chapters", "POST", { name: "Brunei", code: "bn", country: "Brunei" }, superTok), noParams);
    expect(created.status).toBe(201);
    const ch = (await created.json()).data;
    expect(ch.code).toBe("BN");
    expect((await postChapter(jsonRequest("/api/v1/chapters", "POST", { name: "Dup", code: "BN", country: "X" }, superTok), noParams)).status).toBe(409);
    expect((await postChapter(jsonRequest("/api/v1/chapters", "POST", { name: "Nope", code: "NO", country: "X" }, await w.t(w.sgAdmin)), noParams)).status).toBe(403);
    const upd = await patchChapter(jsonRequest(`/api/v1/chapters/${ch.id}`, "PATCH", { isActive: false }, superTok), p(ch.id));
    expect((await upd.json()).data.isActive).toBe(false);
    const visible = await getChapters(jsonRequest("/api/v1/chapters", "GET", undefined, await w.t(w.sgMember)), noParams);
    expect((await visible.json()).data.map((c: { code: string }) => c.code)).toEqual(["MY", "SG"]);
    const all = await getChapters(jsonRequest("/api/v1/chapters?all=true", "GET", undefined, superTok), noParams);
    expect((await all.json()).data).toHaveLength(3);
    expect((await getChapters(jsonRequest("/api/v1/chapters?all=true", "GET", undefined, await w.t(w.sgMember)), noParams)).status).toBe(403);
  });

  it("super admin manages event types", async () => {
    const w = await world();
    const superTok = await w.t(w.superAdmin);
    const created = await postType(jsonRequest("/api/v1/event-types", "POST", { name: "Golf", color: "#16a34a", sortOrder: 5 }, superTok), noParams);
    expect(created.status).toBe(201);
    const t = (await created.json()).data;
    expect((await postType(jsonRequest("/api/v1/event-types", "POST", { name: "Golf" }, superTok), noParams)).status).toBe(409);
    expect((await postType(jsonRequest("/api/v1/event-types", "POST", { name: "Bad", color: "green" }, superTok), noParams)).status).toBe(400);
    expect((await patchType(jsonRequest(`/api/v1/event-types/${t.id}`, "PATCH", { name: "Golf Day" }, await w.t(w.sgAdmin)), p(t.id))).status).toBe(403);
    const upd = await patchType(jsonRequest(`/api/v1/event-types/${t.id}`, "PATCH", { isActive: false }, superTok), p(t.id));
    expect((await upd.json()).data.isActive).toBe(false);
    const visible = await getTypes(jsonRequest("/api/v1/event-types", "GET", undefined, await w.t(w.sgMember)), noParams);
    expect((await visible.json()).data).toHaveLength(0);
  });
});
