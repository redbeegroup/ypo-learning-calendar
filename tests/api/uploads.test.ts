import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import { mkdtempSync } from "node:fs";
import { stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { POST as upload } from "@/app/api/v1/uploads/route";
import { GET as serve } from "@/app/api/uploads/[name]/route";
import { createChapter, createUser, tokenFor } from "./helpers";

const noParams = { params: Promise.resolve({}) };

beforeAll(() => {
  process.env.UPLOAD_DIR = mkdtempSync(path.join(os.tmpdir(), "ypo-uploads-"));
});

async function multipart(token: string | undefined, file: File | null) {
  const form = new FormData();
  if (file) form.append("file", file);
  return new NextRequest("http://localhost/api/v1/uploads", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: form,
  });
}

async function pngFile(width = 2400): Promise<File> {
  const buf = await sharp({ create: { width, height: 300, channels: 3, background: "#2563eb" } }).png().toBuffer();
  return new File([new Uint8Array(buf)], "banner.png", { type: "image/png" });
}

describe("POST /api/v1/uploads", () => {
  it("stores an admin's image as resized WebP and serves it back", async () => {
    const sg = await createChapter();
    const admin = await createUser({ email: "admin@x.com", chapterId: sg.id, role: "CHAPTER_ADMIN" });
    const res = await upload(await multipart(await tokenFor(admin.id), await pngFile()), noParams);
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.url).toMatch(/^\/api\/uploads\/[0-9a-f-]+\.webp$/);
    expect(data.width).toBe(1600);

    const name = data.url.split("/").pop() as string;
    expect((await stat(path.join(process.env.UPLOAD_DIR as string, name))).size).toBeGreaterThan(0);

    const served = await serve(new NextRequest(`http://localhost${data.url}`), { params: Promise.resolve({ name }) });
    expect(served.status).toBe(200);
    expect(served.headers.get("content-type")).toBe("image/webp");

    const missing = await serve(new NextRequest("http://localhost/api/uploads/nope.webp"), {
      params: Promise.resolve({ name: "nope.webp" }),
    });
    expect(missing.status).toBe(404);
  });

  it("rejects members, non-images and missing files", async () => {
    const sg = await createChapter();
    const member = await createUser({ email: "m@x.com", chapterId: sg.id });
    const admin = await createUser({ email: "admin@x.com", chapterId: sg.id, role: "CHAPTER_ADMIN" });
    expect((await upload(await multipart(await tokenFor(member.id), await pngFile(10)), noParams)).status).toBe(403);
    const text = new File([new TextEncoder().encode("hello")], "a.txt", { type: "text/plain" });
    expect((await upload(await multipart(await tokenFor(admin.id), text), noParams)).status).toBe(400);
    expect((await upload(await multipart(await tokenFor(admin.id), null), noParams)).status).toBe(400);
  });
});
