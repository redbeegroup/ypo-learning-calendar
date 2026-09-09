import { describe, it, expect } from "vitest";
import { POST as login } from "@/app/api/v1/auth/login/route";
import { GET as me } from "@/app/api/v1/auth/me/route";
import { POST as logout } from "@/app/api/v1/auth/logout/route";
import { POST as forgot } from "@/app/api/v1/auth/forgot-password/route";
import { POST as reset } from "@/app/api/v1/auth/reset-password/route";
import { POST as acceptInvite } from "@/app/api/v1/auth/accept-invite/route";
import { POST as inviteUser } from "@/app/api/v1/users/route";
import { prisma } from "@/server/db";
import { sentEmails } from "./setup";
import { jsonRequest, createChapter, createUser, tokenFor } from "./helpers";

const ctx = { params: Promise.resolve({}) };

describe("POST /api/v1/auth/login", () => {
  it("returns a token and sets the session cookie for valid credentials", async () => {
    const ch = await createChapter();
    await createUser({ email: "a@x.com", chapterId: ch.id, password: "Secret123!" });
    const res = await login(jsonRequest("/api/v1/auth/login", "POST", { email: "A@x.com", password: "Secret123!" }), ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.token).toBeTypeOf("string");
    expect(body.data.user.email).toBe("a@x.com");
    expect(res.headers.get("set-cookie")).toContain("ypo_session=");
  });

  it("rejects wrong password and disabled users", async () => {
    const ch = await createChapter();
    await createUser({ email: "a@x.com", chapterId: ch.id, password: "Secret123!" });
    await createUser({ email: "d@x.com", chapterId: ch.id, password: "Secret123!", status: "DISABLED" });
    const bad = await login(jsonRequest("/api/v1/auth/login", "POST", { email: "a@x.com", password: "wrong" }), ctx);
    expect(bad.status).toBe(401);
    const disabled = await login(jsonRequest("/api/v1/auth/login", "POST", { email: "d@x.com", password: "Secret123!" }), ctx);
    expect(disabled.status).toBe(401);
  });

  it("validates the body", async () => {
    const res = await login(jsonRequest("/api/v1/auth/login", "POST", { email: "nope" }), ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.fields.email).toBeDefined();
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns the user for a bearer token and 401 without one", async () => {
    const ch = await createChapter();
    const u = await createUser({ email: "a@x.com", chapterId: ch.id });
    const res = await me(jsonRequest("/api/v1/auth/me", "GET", undefined, await tokenFor(u.id)), ctx);
    expect(res.status).toBe(200);
    expect((await res.json()).data.chapterName).toBe("Singapore");
    expect((await me(jsonRequest("/api/v1/auth/me", "GET"), ctx)).status).toBe(401);
  });
});

describe("POST /api/v1/auth/logout", () => {
  it("clears the cookie", async () => {
    const res = await logout(jsonRequest("/api/v1/auth/logout", "POST"), ctx);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toMatch(/ypo_session=;|Max-Age=0/);
  });
});

describe("invite flow", () => {
  it("admin invites a member, member accepts and can log in", async () => {
    const ch = await createChapter();
    const admin = await createUser({ email: "admin@x.com", chapterId: ch.id, role: "CHAPTER_ADMIN" });
    const res = await inviteUser(
      jsonRequest("/api/v1/users", "POST", { email: "new@x.com", name: "New Member", chapterId: ch.id }, await tokenFor(admin.id)),
      ctx,
    );
    expect(res.status).toBe(201);
    expect(sentEmails).toHaveLength(1);
    const token = sentEmails[0].text.match(/\/invite\/([a-f0-9]+)/)?.[1];
    expect(token).toBeTruthy();

    const accepted = await acceptInvite(jsonRequest("/api/v1/auth/accept-invite", "POST", { token, password: "Welcome123!" }), ctx);
    expect(accepted.status).toBe(200);

    const loggedIn = await login(jsonRequest("/api/v1/auth/login", "POST", { email: "new@x.com", password: "Welcome123!" }), ctx);
    expect(loggedIn.status).toBe(200);

    const reused = await acceptInvite(jsonRequest("/api/v1/auth/accept-invite", "POST", { token, password: "Again123!" }), ctx);
    expect(reused.status).toBe(400);
  });

  it("chapter admin cannot invite into another chapter or as admin", async () => {
    const sg = await createChapter("SG", "Singapore");
    const my = await createChapter("MY", "Malaysia");
    const admin = await createUser({ email: "admin@x.com", chapterId: sg.id, role: "CHAPTER_ADMIN" });
    const t = await tokenFor(admin.id);
    const other = await inviteUser(jsonRequest("/api/v1/users", "POST", { email: "n@x.com", name: "N", chapterId: my.id }, t), ctx);
    expect(other.status).toBe(403);
    const asAdmin = await inviteUser(
      jsonRequest("/api/v1/users", "POST", { email: "n@x.com", name: "N", chapterId: sg.id, role: "CHAPTER_ADMIN" }, t),
      ctx,
    );
    expect(asAdmin.status).toBe(403);
  });

  it("members cannot invite", async () => {
    const ch = await createChapter();
    const m = await createUser({ email: "m@x.com", chapterId: ch.id });
    const res = await inviteUser(
      jsonRequest("/api/v1/users", "POST", { email: "n@x.com", name: "N", chapterId: ch.id }, await tokenFor(m.id)),
      ctx,
    );
    expect(res.status).toBe(403);
  });
});

describe("password reset flow", () => {
  it("emails a reset link and accepts the new password once", async () => {
    const ch = await createChapter();
    await createUser({ email: "a@x.com", chapterId: ch.id, password: "Old12345!" });
    const res = await forgot(jsonRequest("/api/v1/auth/forgot-password", "POST", { email: "a@x.com" }), ctx);
    expect(res.status).toBe(200);
    const token = sentEmails[0].text.match(/\/reset-password\/([a-f0-9]+)/)?.[1];
    expect(token).toBeTruthy();

    const done = await reset(jsonRequest("/api/v1/auth/reset-password", "POST", { token, password: "New12345!" }), ctx);
    expect(done.status).toBe(200);
    expect((await login(jsonRequest("/api/v1/auth/login", "POST", { email: "a@x.com", password: "New12345!" }), ctx)).status).toBe(200);
    expect((await reset(jsonRequest("/api/v1/auth/reset-password", "POST", { token, password: "Third123!" }), ctx)).status).toBe(400);
  });

  it("does not reveal unknown emails", async () => {
    const res = await forgot(jsonRequest("/api/v1/auth/forgot-password", "POST", { email: "ghost@x.com" }), ctx);
    expect(res.status).toBe(200);
    expect(sentEmails).toHaveLength(0);
    expect(await prisma.user.count()).toBe(0);
  });
});
