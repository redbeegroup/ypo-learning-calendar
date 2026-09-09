import { describe, it, expect, beforeAll } from "vitest";
import { signSessionToken, verifySessionToken } from "@/server/auth/jwt";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-that-is-long-enough-123456";
});

describe("session jwt", () => {
  it("round-trips the user id", async () => {
    const token = await signSessionToken({ sub: "user_1" });
    const payload = await verifySessionToken(token);
    expect(payload?.sub).toBe("user_1");
  });

  it("returns null for a tampered token", async () => {
    const token = await signSessionToken({ sub: "user_1" });
    expect(await verifySessionToken(token + "x")).toBeNull();
  });

  it("returns null for an expired token", async () => {
    const token = await signSessionToken({ sub: "user_1" }, "-1s");
    expect(await verifySessionToken(token)).toBeNull();
  });
});
