import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireUser } from "@/server/api";
import { changePasswordSchema } from "@/lib/validation/auth";
import { changePassword } from "@/server/services/users";

export const POST = handle(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema);
  await changePassword(actor, currentPassword, newPassword);
  return ok({ changed: true });
});
