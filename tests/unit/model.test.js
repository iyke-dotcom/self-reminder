import { describe, expect, it } from "vitest";
import { createReminder } from "../../src/modules/reminders/model.js";

describe("createReminder", () => {
  it("creates a reminder with an ISO date", () => {
    const reminder = createReminder({
      title: "  Call dentist  ",
      date: "2026-09-27T12:00:00",
      id: "fixed-id",
    });

    expect(reminder).toMatchObject({
      id: "fixed-id",
      title: "Call dentist",
      notified: false,
    });
    expect(reminder.date).toBe(new Date("2026-09-27T12:00:00").toISOString());
  });

  it("rejects an empty title", () => {
    expect(() =>
      createReminder({ title: "   ", date: "2026-09-27T12:00:00" }),
    ).toThrow("Title is required");
  });
});
