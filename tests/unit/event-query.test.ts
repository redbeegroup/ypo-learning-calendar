import { describe, it, expect } from "vitest";
import { buildEventQuery, monthRangeToDates } from "@/lib/event-query";

describe("monthRangeToDates", () => {
  it("covers whole months inclusively", () => {
    const r = monthRangeToDates("2026-09", "2027-02");
    expect(r.from).toBe("2026-09-01T00:00:00.000Z");
    expect(r.to).toBe("2027-02-28T23:59:59.999Z");
    expect(r.includePast).toBe(true);
  });
  it("ignores malformed or missing bounds", () => {
    expect(monthRangeToDates("2026-13", undefined)).toEqual({ includePast: true });
    expect(monthRangeToDates(undefined, "2026-06").from).toBeUndefined();
  });
});

describe("buildEventQuery with a custom month range", () => {
  it("uses the month bounds and includes past events", () => {
    const q = buildEventQuery({ range: "custom", fromMonth: "2026-07", toMonth: "2027-06" });
    expect(q.from?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(q.to?.toISOString()).toBe("2027-06-30T23:59:59.999Z");
    expect(q.includePast).toBe(true);
  });
  it("treats month params without range=custom the same way", () => {
    const q = buildEventQuery({ fromMonth: "2025-07" });
    expect(q.from?.toISOString()).toBe("2025-07-01T00:00:00.000Z");
    expect(q.to).toBeUndefined();
  });
});
