import { describe, expect, it } from "vitest";
import {
  computeNextDate,
  createRecurringRule,
  describeRecurring,
} from "../../src/modules/reminders/recurrence.js";

describe("createRecurringRule", () => {
  it("normalizes interval to at least 1", () => {
    expect(createRecurringRule({ freq: "daily", interval: 0 })).toEqual({
      freq: "daily",
      interval: 1,
    });
  });

  it("rejects unknown frequencies", () => {
    expect(() => createRecurringRule({ freq: "hourly" })).toThrow();
  });
});

describe("computeNextDate", () => {
  const base = new Date("2026-09-27T09:00:00").getTime();

  it("advances a daily reminder past the cutoff", () => {
    const next = computeNextDate(
      "2026-09-27T09:00:00",
      { freq: "daily", interval: 1 },
      base,
    );
    expect(next.getTime()).toBe(base + 24 * 60 * 60 * 1000);
  });

  it("advances by interval days", () => {
    const next = computeNextDate(
      "2026-09-27T09:00:00",
      { freq: "daily", interval: 3 },
      base,
    );
    expect(next.getDate()).toBe(30);
  });

  it("advances a weekly reminder by 7 days", () => {
    const next = computeNextDate(
      "2026-09-27T09:00:00",
      { freq: "weekly", interval: 1 },
      base,
    );
    expect(next.getTime()).toBe(base + 7 * 24 * 60 * 60 * 1000);
  });

  it("skips past occurrences", () => {
    const after = base + 3 * 24 * 60 * 60 * 1000;
    const next = computeNextDate(
      "2026-09-27T09:00:00",
      { freq: "daily", interval: 1 },
      after,
    );
    expect(next.getTime()).toBe(after + 24 * 60 * 60 * 1000);
  });
});

describe("describeRecurring", () => {
  it("describes a basic rule", () => {
    expect(describeRecurring({ freq: "daily", interval: 1 })).toBe(
      "Repeats day",
    );
  });

  it("describes a custom interval", () => {
    expect(describeRecurring({ freq: "weekly", interval: 2 })).toBe(
      "Repeats every 2 week",
    );
  });
});
