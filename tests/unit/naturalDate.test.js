import { describe, expect, it } from "vitest";
import { parseNaturalDate } from "../../src/utils/naturalDate.js";

const now = new Date("2026-09-29T10:00:00");
const input = (text) => parseNaturalDate(text, now);

describe("parseNaturalDate", () => {
  it("rejects empty or unknown input", () => {
    expect(parseNaturalDate("", now)).toBeNull();
    expect(parseNaturalDate("   ", now)).toBeNull();
  });

  it("handles now", () => {
    expect(input("now")).toBe("2026-09-29T10:00");
  });

  it("handles relative offsets", () => {
    expect(input("in 2 hours")).toBe("2026-09-29T12:00");
    expect(input("in 3 days")).toBe("2026-10-02T10:00");
    expect(input("in 1 week")).toBe("2026-10-06T10:00");
  });

  it("handles tomorrow with a time", () => {
    expect(input("tomorrow 9am")).toBe("2026-09-30T09:00");
    expect(input("tomorrow at 5pm")).toBe("2026-09-30T17:00");
    expect(input("tomorrow")).toBe("2026-09-30T09:00");
  });

  it("handles weekday names", () => {
    expect(input("friday")).toBe("2026-10-02T09:00");
    expect(input("next monday")).toBe("2026-10-05T09:00");
  });

  it("handles tonight and today", () => {
    expect(input("tonight")).toBe("2026-09-29T19:00");
    expect(input("today 8am")).toBe("2026-09-29T08:00");
  });

  it("rejects unrecognized phrases", () => {
    expect(input("gibberish words")).toBeNull();
    expect(input("sometime next year")).toBeNull();
  });

  it("applies a bare time to today", () => {
    expect(input("5pm")).toBe("2026-09-29T17:00");
  });
});
