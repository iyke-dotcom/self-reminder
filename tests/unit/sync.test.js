import { describe, expect, it } from "vitest";
import { mergeReminders } from "../../src/modules/sync.js";

const local = (id, title, updatedAt) => ({
  id,
  title,
  date: "2026-10-01T09:00:00.000Z",
  updatedAt,
});

describe("mergeReminders", () => {
  it("takes the newest version of a reminder", () => {
    const merged = mergeReminders(
      [local("a", "local-new", 2000)],
      [local("a", "server-old", 1000)],
      [],
    );
    expect(merged[0].title).toBe("local-new");
  });

  it("keeps the server version when the local copy is stale", () => {
    const merged = mergeReminders(
      [local("a", "local-old", 500)],
      [local("a", "server-new", 2000)],
      [],
    );
    expect(merged[0].title).toBe("server-new");
  });

  it("includes reminders only present on the server", () => {
    const merged = mergeReminders([], [local("b", "from-server", 2000)], []);
    expect(merged.map((r) => r.id)).toEqual(["b"]);
  });

  it("keeps reminders only present locally", () => {
    const merged = mergeReminders([local("c", "local-only", 2000)], [], []);
    expect(merged.map((r) => r.id)).toEqual(["c"]);
  });

  it("removes local reminders shadowed by a server tombstone", () => {
    const merged = mergeReminders(
      [local("d", "deleted-locally-later?", 900)],
      [],
      [{ id: "d", updatedAt: 1000 }],
    );
    expect(merged).toEqual([]);
  });

  it("keeps local reminders that survive a stale tombstone", () => {
    const merged = mergeReminders(
      [local("d", "local-wins", 1500)],
      [],
      [{ id: "d", updatedAt: 1000 }],
    );
    expect(merged.map((r) => r.id)).toEqual(["d"]);
  });
});
