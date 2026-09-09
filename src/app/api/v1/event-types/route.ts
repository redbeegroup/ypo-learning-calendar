import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin, requireUser } from "@/server/api";
import { eventTypeSchema } from "@/lib/validation/catalog";
import { listEventTypes } from "@/server/services/events";
import { createEventType, listAllEventTypes } from "@/server/services/catalog";

export const GET = handle(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const all = req.nextUrl.searchParams.get("all") === "true";
  if (all) return ok(await listAllEventTypes(actor));
  return ok(await listEventTypes());
});

export const POST = handle(async (req: NextRequest) => {
  const actor = await requireAdmin(req);
  const input = await parseBody(req, eventTypeSchema);
  return ok(await createEventType(actor, input), { status: 201 });
});
