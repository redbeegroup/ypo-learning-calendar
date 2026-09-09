export type Health = { status: "ok" | "degraded"; db: "up" | "down" };

export async function buildHealth(ping: () => Promise<unknown>): Promise<Health> {
  try {
    await ping();
    return { status: "ok", db: "up" };
  } catch {
    return { status: "degraded", db: "down" };
  }
}
