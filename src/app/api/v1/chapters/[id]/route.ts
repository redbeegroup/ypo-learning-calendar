import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin } from "@/server/api";
import { chapterUpdateSchema } from "@/lib/validation/catalog";
import { updateChapter } from "@/server/services/catalog";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle<Ctx>(async (req: NextRequest, { params }) => {
  const actor = await requireAdmin(req);
  const { id } = await params;
  const input = await parseBody(req, chapterUpdateSchema);
  return ok(await updateChapter(actor, id, input));
});
