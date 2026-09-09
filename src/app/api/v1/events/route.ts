import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin, requireUser } from "@/server/api";
import { eventInputSchema, eventListQuerySchema } from "@/lib/validation/events";
import { createEvent, listEvents, queryFromSearchParams } from "@/server/services/events";

export const GET = handle(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const query = eventListQuerySchema.parse(queryFromSearchParams(req.nextUrl.searchParams));
  return ok(await listEvents(actor, query));
});

export const POST = handle(async (req: NextRequest) => {
  const actor = await requireAdmin(req);
  const input = await parseBody(req, eventInputSchema);
  return ok(await createEvent(actor, input), { status: 201 });
});
