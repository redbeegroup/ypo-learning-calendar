import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";

describe("password", () => {
  it("verifies a correct password and rejects a wrong one", async () => {
    const hash = await hashPassword("Secret123!");
    expect(hash).not.toBe("Secret123!");
    expect(await verifyPassword("Secret123!", hash)).toBe(true);
    expect(await verifyPassword("nope", hash)).toBe(false);
  });

  it("rejects when there is no hash", async () => {
    expect(await verifyPassword("anything", null)).toBe(false);
  });
});
