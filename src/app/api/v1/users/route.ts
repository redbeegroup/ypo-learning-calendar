import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin } from "@/server/api";
import { inviteUserSchema } from "@/lib/validation/auth";
import { inviteUser, publicUser } from "@/server/services/users";

export const POST = handle(async (req: NextRequest) => {
  const actor = await requireAdmin(req);
  const input = await parseBody(req, inviteUserSchema);
  const user = await inviteUser(actor, input);
  return ok(publicUser(user), { status: 201 });
});
