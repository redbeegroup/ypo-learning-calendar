import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodType, type ZodTypeDef } from "zod";
import { getSessionUser, type SessionUser } from "@/server/auth/session";
import { isAdmin } from "@/server/permissions";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message?: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message ?? code);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function fail(status: number, code: string, message: string, fields?: Record<string, string[]>) {
  return NextResponse.json({ error: { code, message, fields } }, { status });
}

type Handler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<NextResponse>;

export function handle<Ctx = unknown>(fn: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        const fields: Record<string, string[]> = {};
        for (const issue of err.issues) {
          const key = issue.path.join(".") || "_";
          (fields[key] ??= []).push(issue.message);
        }
        return fail(400, "VALIDATION", "Invalid input", fields);
      }
      if (err instanceof ApiError) return fail(err.status, err.code, err.message, err.fields);
      console.error(err);
      return fail(500, "INTERNAL", "Something went wrong");
    }
  };
}

/** `T` is the schema's output type, so defaults and transforms are reflected in the result. */
export async function parseBody<T>(req: NextRequest, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "VALIDATION", "Body must be JSON");
  }
  return schema.parse(json);
}

export async function requireUser(req: NextRequest): Promise<SessionUser> {
  const user = await getSessionUser(req);
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Please sign in");
  return user;
}

export async function requireAdmin(req: NextRequest): Promise<SessionUser> {
  const user = await requireUser(req);
  if (!isAdmin(user)) throw new ApiError(403, "FORBIDDEN", "Admin access required");
  return user;
}

export function forbidden(message = "You do not have permission to do this"): never {
  throw new ApiError(403, "FORBIDDEN", message);
}

export function notFound(what = "Resource"): never {
  throw new ApiError(404, "NOT_FOUND", `${what} not found`);
}
