import { describe, expect, it } from "vitest";
import { buildIcs } from "../../src/modules/ics.js";

const reminder = {
  id: "r1",
  title: "Water plants",
  date: "2026-09-30T09:00:00.000Z",
  tags: ["home"],
  recurring: { frequency: "weekly", interval: 1 },
};

describe("buildIcs", () => {
  it("produces a VCALENDAR with VEVENTs", () => {
    const ics = buildIcs([reminder]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain(`UID:r1@self-reminder`);
  });

  it("emits UTC DTSTART matching the reminder date", () => {
    const ics = buildIcs([reminder]);
    expect(ics).toContain("DTSTART:20260930T090000Z");
  });

  it("emits RRULE for recurring reminders", () => {
    expect(buildIcs([reminder])).toContain("RRULE:FREQ=WEEKLY");
    expect(
      buildIcs([{ ...reminder, recurring: { freq: "monthly", interval: 2 } }]),
    ).toContain("RRULE:FREQ=MONTHLY;INTERVAL=2");
  });

  it("escapes summary text", () => {
    const ics = buildIcs([{ ...reminder, title: "Buy milk, eggs" }]);
    expect(ics).toContain("SUMMARY:Buy milk\\, eggs");
  });
});
