import { NextRequest } from "next/server";
import { handle, ok, requireAdmin } from "@/server/api";
import { cancelEvent } from "@/server/services/events";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireAdmin(req);
  const { id } = await params;
  return ok(await cancelEvent(actor, id));
});
