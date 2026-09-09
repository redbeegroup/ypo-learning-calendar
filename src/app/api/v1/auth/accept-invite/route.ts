import { NextRequest } from "next/server";
import { handle, ok, parseBody } from "@/server/api";
import { acceptInviteSchema } from "@/lib/validation/auth";
import { acceptInvite, publicUser } from "@/server/services/users";
import { signSessionToken } from "@/server/auth/jwt";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";

export const POST = handle(async (req: NextRequest) => {
  const { token, password } = await parseBody(req, acceptInviteSchema);
  const user = await acceptInvite(token, password);
  const session = await signSessionToken({ sub: user.id });
  const res = ok({ token: session, user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, session, sessionCookieOptions());
  return res;
});
