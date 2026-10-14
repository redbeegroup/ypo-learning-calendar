import { NextRequest } from "next/server";
import { ApiError, handle, ok, requireAdmin } from "@/server/api";
import { storeImage } from "@/server/services/uploads";

export const runtime = "nodejs";

/** Multipart upload of one image (field "file"). Admins only. */
export const POST = handle(async (req: NextRequest) => {
  await requireAdmin(req);
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "VALIDATION", "Expected multipart form data with a file");
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new ApiError(400, "VALIDATION", "Choose an image to upload", { file: ["Choose an image to upload"] });
  }
  return ok(await storeImage(file), { status: 201 });
});
