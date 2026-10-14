import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { openStoredImage } from "@/server/services/uploads";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ name: string }> };

/** Serves an uploaded image. Names are random, so no login is required (lets email clients and previews load them). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { name } = await params;
  const file = await openStoredImage(name);
  if (!file) return new NextResponse("Not found", { status: 404 });
  const body = Readable.toWeb(file.stream) as ReadableStream;
  return new NextResponse(body, {
    headers: {
      "content-type": file.contentType,
      "content-length": String(file.size),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
