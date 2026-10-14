import { describe, expect, it } from "vitest";
import { inQuietHours } from "../../src/modules/notifications/groupChecker.js";

const at = (hours, minutes = 0) => {
  const date = new Date(2026, 0, 1, hours, minutes);
  return date;
};

describe("group quiet hours", () => {
  it("is off when no window is configured", () => {
    expect(inQuietHours({}, at(23))).toBe(false);
    expect(inQuietHours({ quietFrom: "22:00" }, at(23))).toBe(false);
  });

  it("detects a same-day window", () => {
    const settings = { quietFrom: "22:00", quietTo: "23:00" };
    expect(inQuietHours(settings, at(22, 30))).toBe(true);
    expect(inQuietHours(settings, at(21, 59))).toBe(false);
    expect(inQuietHours(settings, at(23, 0))).toBe(false);
  });

  it("detects an overnight window", () => {
    const settings = { quietFrom: "22:00", quietTo: "07:00" };
    expect(inQuietHours(settings, at(23))).toBe(true);
    expect(inQuietHours(settings, at(3))).toBe(true);
    expect(inQuietHours(settings, at(12))).toBe(false);
  });
});
