import { NextRequest } from "next/server";
import { handle, ok, requireUser } from "@/server/api";
import { listMyRegistrations } from "@/server/services/registrations";

export const GET = handle(async (req: NextRequest) => {
  const actor = await requireUser(req);
  return ok(await listMyRegistrations(actor));
});
