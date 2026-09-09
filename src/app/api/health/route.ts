import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { buildHealth } from "@/server/health";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await buildHealth(() => prisma.$queryRaw`SELECT 1`);
  return NextResponse.json(health, { status: health.status === "ok" ? 200 : 503 });
}
