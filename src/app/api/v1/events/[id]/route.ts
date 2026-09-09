import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin, requireUser } from "@/server/api";
import { eventInputSchema } from "@/lib/validation/events";
import { getEvent, updateEvent } from "@/server/services/events";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireUser(req);
  const { id } = await params;
  return ok(await getEvent(actor, id));
});

export const PATCH = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireAdmin(req);
  const { id } = await params;
  const input = await parseBody(req, eventInputSchema);
  return ok(await updateEvent(actor, id, input));
});
