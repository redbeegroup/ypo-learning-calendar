import { NextRequest } from "next/server";
import { handle, ok, parseBody, requireAdmin, requireUser } from "@/server/api";
import { chapterSchema } from "@/lib/validation/catalog";
import { listChapters } from "@/server/services/events";
import { createChapter, listAllChapters } from "@/server/services/catalog";

export const GET = handle(async (req: NextRequest) => {
  const actor = await requireUser(req);
  const all = req.nextUrl.searchParams.get("all") === "true";
  if (all) return ok(await listAllChapters(actor));
  return ok(await listChapters());
});

export const POST = handle(async (req: NextRequest) => {
  const actor = await requireAdmin(req);
  const input = await parseBody(req, chapterSchema);
  return ok(await createChapter(actor, input), { status: 201 });
});
