import { NextRequest } from "next/server";
import { handle, ok, requireAdmin } from "@/server/api";
import { listEventRegistrations } from "@/server/services/registrations";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireAdmin(req);
  const { id } = await params;
  return ok(await listEventRegistrations(actor, id));
});
