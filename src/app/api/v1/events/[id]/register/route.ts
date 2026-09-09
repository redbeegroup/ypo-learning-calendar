import { NextRequest } from "next/server";
import { handle, ok, requireUser } from "@/server/api";
import { cancelRegistration, registerForEvent } from "@/server/services/registrations";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireUser(req);
  const { id } = await params;
  return ok(await registerForEvent(actor, id), { status: 201 });
});

export const DELETE = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireUser(req);
  const { id } = await params;
  return ok(await cancelRegistration(actor, id));
});
