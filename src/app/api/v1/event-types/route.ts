import { NextRequest } from "next/server";
import { handle, ok, requireUser } from "@/server/api";
import { listEventTypes } from "@/server/services/events";

export const GET = handle(async (req: NextRequest) => {
  await requireUser(req);
  return ok(await listEventTypes());
});
