import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ApiError } from "@/server/api";
import { env } from "@/server/env";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_WIDTH = 1600;

export function uploadDir(): string {
  return path.resolve(env.uploadDir);
}

/** Validates, resizes (max 1600px wide) and stores an image as WebP. Returns the public path. */
export async function storeImage(file: File): Promise<{ url: string; width: number; height: number }> {
  if (!ALLOWED.has(file.type)) {
    throw new ApiError(400, "VALIDATION", "Only JPEG, PNG, WebP or GIF images are allowed", {
      file: ["Only JPEG, PNG, WebP or GIF images are allowed"],
    });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ApiError(400, "VALIDATION", "Image must be 8 MB or smaller", { file: ["Image must be 8 MB or smaller"] });
  }
  const input = Buffer.from(await file.arrayBuffer());
  let output: Buffer;
  let info: { width: number; height: number };
  try {
    const result = await sharp(input, { animated: false })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    output = result.data;
    info = { width: result.info.width, height: result.info.height };
  } catch {
    throw new ApiError(400, "VALIDATION", "The file is not a readable image", { file: ["The file is not a readable image"] });
  }
  const name = `${randomUUID()}.webp`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), output);
  return { url: `/api/uploads/${name}`, ...info };
}

const SAFE_NAME = /^[A-Za-z0-9_-]+\.(webp|jpg|jpeg|png|gif)$/;
const CONTENT_TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
};

/** Resolves a stored file by name, refusing anything that is not a plain file name in the upload dir. */
export async function openStoredImage(name: string) {
  if (!SAFE_NAME.test(name)) return null;
  const file = path.join(uploadDir(), name);
  try {
    const s = await stat(file);
    if (!s.isFile()) return null;
    const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
    return { stream: createReadStream(file), size: s.size, contentType: CONTENT_TYPES[ext] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}
