import { handle, ok } from "@/server/api";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/auth/session";

export const POST = handle(async () => {
  const res = ok({ loggedOut: true });
  res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return res;
});
