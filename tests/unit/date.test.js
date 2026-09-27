import { describe, expect, it } from "vitest";
import {
  classifyDue,
  formatDateTime,
  isValidDate,
} from "../../src/utils/date.js";

describe("classifyDue", () => {
  const now = new Date("2026-09-27T12:00:00").getTime();

  it("marks past dates as overdue", () => {
    expect(classifyDue("2026-09-27T11:00:00", now)).toBe("overdue");
  });

  it("marks dates within 5 minutes as soon", () => {
    expect(classifyDue("2026-09-27T12:02:00", now)).toBe("soon");
  });

  it("marks far dates as future", () => {
    expect(classifyDue("2026-09-28T12:00:00", now)).toBe("future");
  });
});

describe("isValidDate", () => {
  it("accepts valid dates", () => {
    expect(isValidDate("2026-09-27T12:00:00")).toBe(true);
  });

  it("rejects invalid dates", () => {
    expect(isValidDate("not-a-date")).toBe(false);
  });
});

describe("formatDateTime", () => {
  it("formats a date without throwing", () => {
    expect(typeof formatDateTime("2026-09-27T12:00:00")).toBe("string");
  });
});
