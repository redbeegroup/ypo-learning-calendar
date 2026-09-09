import { describe, it, expect } from "vitest";
import { zonedInputToUtc, utcToZonedInput, formatEventRange, isValidTimeZone } from "@/lib/dates";

describe("dates", () => {
  it("converts a wall-clock input in a zone to UTC and back", () => {
    const utc = zonedInputToUtc("2026-10-01T09:00", "Asia/Singapore");
    expect(utc.toISOString()).toBe("2026-10-01T01:00:00.000Z");
    expect(utcToZonedInput(utc, "Asia/Singapore")).toBe("2026-10-01T09:00");
    expect(utcToZonedInput(utc, "Asia/Yangon")).toBe("2026-10-01T07:30");
  });

  it("formats a same-day range compactly and a multi-day range fully", () => {
    const s = new Date("2026-10-01T01:00:00Z");
    expect(formatEventRange(s, new Date("2026-10-01T03:30:00Z"), "Asia/Singapore")).toBe(
      "Thu 1 Oct 2026, 9:00 AM – 11:30 AM (SGT)",
    );
    expect(formatEventRange(s, new Date("2026-10-02T03:30:00Z"), "Asia/Singapore")).toBe(
      "Thu 1 Oct 2026, 9:00 AM – Fri 2 Oct 2026, 11:30 AM (SGT)",
    );
  });

  it("validates IANA zones", () => {
    expect(isValidTimeZone("Asia/Bangkok")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
