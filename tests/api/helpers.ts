import { NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { signSessionToken } from "@/server/auth/jwt";

export function jsonRequest(url: string, method: string, body?: unknown, token?: string) {
  return new NextRequest(`http://localhost${url}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export async function createChapter(code = "SG", name = "Singapore") {
  return prisma.chapter.create({ data: { code, name, country: name } });
}

export async function createUser(opts: {
  email: string;
  role?: Role;
  chapterId: string;
  password?: string;
  status?: "ACTIVE" | "INVITED" | "DISABLED";
}) {
  return prisma.user.create({
    data: {
      email: opts.email,
      name: opts.email.split("@")[0],
      role: opts.role ?? "MEMBER",
      chapterId: opts.chapterId,
      status: opts.status ?? "ACTIVE",
      passwordHash: opts.password ? await hashPassword(opts.password) : null,
    },
  });
}

export async function tokenFor(userId: string) {
  return signSessionToken({ sub: userId });
}
