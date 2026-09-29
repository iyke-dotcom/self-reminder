import { describe, expect, it } from "vitest";
import { buildBackup, parseBackup } from "../../src/modules/backup.js";

const reminder = {
  id: "r1",
  title: "Water plants",
  date: "2026-09-27T12:00:00.000Z",
};

describe("parseBackup", () => {
  it("accepts a raw array payload", () => {
    const result = parseBackup(JSON.stringify([reminder]));
    expect(result.reminders).toHaveLength(1);
    expect(result.reminders[0].id).toBe("r1");
  });

  it("accepts the wrapped backup format", () => {
    const result = parseBackup(
      JSON.stringify({ meta: { version: 1 }, reminders: [reminder] }),
    );
    expect(result.reminders).toHaveLength(1);
    expect(result.version).toBe(1);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseBackup("not json")).toThrow("not valid JSON");
  });

  it("rejects payloads that are not lists", () => {
    expect(() => parseBackup(JSON.stringify({ reminders: "nope" }))).toThrow(
      "must contain a list",
    );
  });

  it("rejects reminders without an id or title", () => {
    expect(() => parseBackup(JSON.stringify([{ title: "no id" }]))).toThrow(
      "Invalid reminder",
    );
  });

  it("rejects duplicate ids", () => {
    expect(() =>
      parseBackup(JSON.stringify([reminder, { ...reminder }])),
    ).toThrow("Duplicate reminder id");
  });
});

describe("buildBackup", () => {
  it("wraps reminders with meta", () => {
    const raw = buildBackup([reminder]);
    const parsed = JSON.parse(raw);
    expect(parsed.meta.version).toBe(1);
    expect(parsed.meta.exportedAt).toBeTruthy();
    expect(parsed.reminders).toHaveLength(1);
  });
});
