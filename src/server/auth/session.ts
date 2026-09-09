import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { verifySessionToken } from "@/server/auth/jwt";
import { env } from "@/server/env";

export const SESSION_COOKIE = "ypo_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  chapterId: string;
  chapterName: string;
};

export function extractToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return req.cookies.get(SESSION_COOKIE)?.value ?? null;
}

export async function loadSessionUser(token: string | null): Promise<SessionUser | null> {
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { chapter: { select: { name: true } } },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    chapterId: user.chapterId,
    chapterName: user.chapter.name,
  };
}

export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  return loadSessionUser(extractToken(req));
}

/** For server components and layouts (no request object). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return loadSessionUser(store.get(SESSION_COOKIE)?.value ?? null);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProduction,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
