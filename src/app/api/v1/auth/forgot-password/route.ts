import { NextRequest } from "next/server";
import { handle, ok, parseBody } from "@/server/api";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { requestPasswordReset } from "@/server/services/users";

export const POST = handle(async (req: NextRequest) => {
  const { email } = await parseBody(req, forgotPasswordSchema);
  await requestPasswordReset(email);
  return ok({ sent: true });
});
