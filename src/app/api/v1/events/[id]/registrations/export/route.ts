import { NextRequest, NextResponse } from "next/server";
import { handle, requireAdmin } from "@/server/api";
import { exportEventRegistrations } from "@/server/services/registrations";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireAdmin(req);
  const { id } = await params;
  const { csv, filename } = await exportEventRegistrations(actor, id);
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
});
