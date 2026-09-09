export type ApiErrorBody = { code: string; message: string; fields?: Record<string, string[]> };

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public body: ApiErrorBody,
  ) {
    super(body.message);
  }
}

export async function api<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`/api/v1${path}`, {
    ...rest,
    headers: { "content-type": "application/json", ...(rest.headers ?? {}) },
    body: json === undefined ? rest.body : JSON.stringify(json),
    credentials: "same-origin",
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ClientApiError(res.status, payload.error ?? { code: "UNKNOWN", message: "Request failed" });
  }
  return payload.data as T;
}
