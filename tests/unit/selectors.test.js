import { describe, expect, it } from "vitest";
import {
  collectTags,
  filterReminders,
  sortReminders,
} from "../../src/modules/reminders/selectors.js";

function reminder(overrides = {}) {
  return {
    id: "id",
    title: "Task",
    date: "2026-09-27T12:00:00",
    done: false,
    priority: "medium",
    tags: [],
    recurring: null,
    notified: false,
    ...overrides,
  };
}

describe("filterReminders", () => {
  const NOW = new Date("2026-09-27T12:00:00").getTime();
  const many = [
    reminder({ id: "a", title: "Call dentist", date: "2026-09-26T12:00:00" }),
    reminder({ id: "b", title: "Buy milk", date: "2026-09-27T12:02:00" }),
    reminder({
      id: "c",
      title: "Read book",
      date: "2026-10-01T09:00:00",
      done: true,
    }),
    reminder({
      id: "d",
      title: "Gym",
      date: "2026-11-01T09:00:00",
      tags: ["health"],
    }),
  ];

  it("filters by done status", () => {
    expect(filterReminders(many, { status: "done", now: NOW })).toHaveLength(1);
    expect(filterReminders(many, { status: "active", now: NOW })).toHaveLength(
      3,
    );
  });

  it("filters overdue and due-soon", () => {
    expect(filterReminders(many, { status: "overdue", now: NOW })[0].id).toBe(
      "a",
    );
    expect(filterReminders(many, { status: "soon", now: NOW })[0].id).toBe("b");
  });

  it("searches by title and tags", () => {
    expect(filterReminders(many, { query: "dentist", now: NOW })).toHaveLength(
      1,
    );
    expect(filterReminders(many, { query: "health", now: NOW })).toHaveLength(
      1,
    );
  });

  it("filters by a specific tag", () => {
    expect(filterReminders(many, { tag: "health", now: NOW })[0].id).toBe("d");
  });
});

describe("sortReminders", () => {
  const list = [
    reminder({
      id: "a",
      title: "Zebra",
      date: "2026-10-01T09:00:00",
      priority: "low",
    }),
    reminder({
      id: "b",
      title: "Alpha",
      date: "2026-09-01T09:00:00",
      priority: "high",
    }),
    reminder({
      id: "c",
      title: "Middle",
      date: "2026-09-15T09:00:00",
      priority: "medium",
    }),
  ];

  it("sorts by date ascending by default", () => {
    const sorted = sortReminders(list);
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by priority then existing order", () => {
    const sorted = sortReminders(list, "priority");
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts by title", () => {
    const sorted = sortReminders(list, "title");
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });
});

describe("collectTags", () => {
  it("collects unique sorted tags", () => {
    const tags = collectTags([
      reminder({ id: "1", tags: ["health", "work"] }),
      reminder({ id: "2", tags: ["work"] }),
    ]);
    expect(tags).toEqual(["health", "work"]);
  });
});
