import { NextRequest } from "next/server";
import { handle, ok, requireAdmin } from "@/server/api";
import { resendInvite } from "@/server/services/users";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireAdmin(req);
  const { id } = await params;
  await resendInvite(actor, id);
  return ok({ sent: true });
});
