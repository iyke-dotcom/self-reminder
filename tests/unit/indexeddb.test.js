import { describe, expect, it } from "vitest";
import "fake-indexeddb/auto";
import { createIndexedDbAdapter } from "../../src/modules/reminders/indexeddb.js";

let sequence = 0;
function freshDb() {
  sequence += 1;
  return `test-db-${sequence}`;
}

describe("createIndexedDbAdapter", () => {
  it("loads an empty list on a fresh database", async () => {
    const adapter = createIndexedDbAdapter({ dbName: freshDb() });
    await expect(adapter.load()).resolves.toEqual([]);
  });

  it("round-trips reminders through saveAll/load", async () => {
    const adapter = createIndexedDbAdapter({ dbName: freshDb() });
    const reminders = [
      { id: "a", title: "First", date: "2026-09-27T12:00:00.000Z" },
      { id: "b", title: "Second", date: "2026-09-28T12:00:00.000Z" },
    ];
    await adapter.saveAll(reminders);
    const loaded = await adapter.load();
    expect(loaded).toHaveLength(2);
    expect(loaded.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("replaces all data on subsequent saveAll", async () => {
    const adapter = createIndexedDbAdapter({ dbName: freshDb() });
    await adapter.saveAll([{ id: "a", title: "Old", date: "" }]);
    await adapter.saveAll([{ id: "b", title: "New", date: "" }]);
    const loaded = await adapter.load();
    expect(loaded.map((r) => r.id)).toEqual(["b"]);
  });
});
