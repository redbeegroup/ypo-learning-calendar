import { NextRequest } from "next/server";
import { handle, ok, parseBody } from "@/server/api";
import { loginSchema } from "@/lib/validation/auth";
import { authenticate, publicUser } from "@/server/services/users";
import { signSessionToken } from "@/server/auth/jwt";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";

export const POST = handle(async (req: NextRequest) => {
  const { email, password } = await parseBody(req, loginSchema);
  const user = await authenticate(email, password);
  const token = await signSessionToken({ sub: user.id });
  const res = ok({ token, user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return res;
});
