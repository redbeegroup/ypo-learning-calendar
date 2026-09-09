import { NextRequest } from "next/server";
import { handle, ok, parseBody } from "@/server/api";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { resetPassword } from "@/server/services/users";

export const POST = handle(async (req: NextRequest) => {
  const { token, password } = await parseBody(req, resetPasswordSchema);
  await resetPassword(token, password);
  return ok({ reset: true });
});
