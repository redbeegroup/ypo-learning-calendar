import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin } from "@/server/api";
import { inviteUserSchema } from "@/lib/validation/auth";
import { userListQuerySchema } from "@/lib/validation/users";
import { inviteUser, listUsers, publicUser } from "@/server/services/users";
import { queryFromSearchParams } from "@/server/services/events";

export const GET = handle(async (req: NextRequest) => {
  const actor = await requireAdmin(req);
  const query = userListQuerySchema.parse(queryFromSearchParams(req.nextUrl.searchParams));
  return ok(await listUsers(actor, query));
});

export const POST = handle(async (req: NextRequest) => {
  const actor = await requireAdmin(req);
  const input = await parseBody(req, inviteUserSchema);
  const user = await inviteUser(actor, input);
  return ok(publicUser(user), { status: 201 });
});
