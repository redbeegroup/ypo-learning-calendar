import { NextRequest } from "next/server";
import { handle, ok, requireUser } from "@/server/api";

export const GET = handle(async (req: NextRequest) => ok(await requireUser(req)));
