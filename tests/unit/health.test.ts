import { describe, it, expect } from "vitest";
import { buildHealth } from "@/server/health";

describe("buildHealth", () => {
  it("reports ok when the database ping succeeds", async () => {
    const result = await buildHealth(async () => true);
    expect(result).toEqual({ status: "ok", db: "up" });
  });

  it("reports degraded when the database ping fails", async () => {
    const result = await buildHealth(async () => {
      throw new Error("boom");
    });
    expect(result).toEqual({ status: "degraded", db: "down" });
  });
});
