import { SignJWT, jwtVerify } from "jose";
import { env } from "@/server/env";

export type SessionPayload = { sub: string };

const alg = "HS256";
const secret = () => new TextEncoder().encode(env.jwtSecret);

export async function signSessionToken(payload: SessionPayload, expiresIn = "7d"): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [alg] });
    if (!payload.sub) return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
