import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin } from "@/server/api";
import { paymentStatusSchema } from "@/lib/validation/registrations";
import { setPaymentStatus } from "@/server/services/registrations";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireAdmin(req);
  const { id } = await params;
  const { paymentStatus } = await parseBody(req, paymentStatusSchema);
  return ok(await setPaymentStatus(actor, id, paymentStatus));
});
