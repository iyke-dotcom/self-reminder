import { describe, expect, it } from "vitest";
import { effectiveDueDate } from "../../src/modules/settings.js";

describe("effectiveDueDate", () => {
  it("returns the due date unchanged when no pre-reminder is set", () => {
    const iso = "2026-09-27T12:00:00.000Z";
    const expected = new Date(iso).getTime();
    expect(effectiveDueDate(iso, { preReminderMinutes: 0 })).toBe(expected);
  });

  it("shifts the effective time earlier by the pre-reminder offset", () => {
    const iso = "2026-09-27T12:00:00.000Z";
    const shifted = effectiveDueDate(iso, { preReminderMinutes: 10 });
    expect(shifted).toBe(new Date(iso).getTime() - 10 * 60 * 1000);
  });
});
