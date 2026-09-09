import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin } from "@/server/api";
import { updateUserSchema } from "@/lib/validation/users";
import { updateUser } from "@/server/services/users";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireAdmin(req);
  const { id } = await params;
  const input = await parseBody(req, updateUserSchema);
  return ok(await updateUser(actor, id, input));
});
