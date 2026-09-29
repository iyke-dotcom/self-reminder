import { describe, expect, it } from "vitest";
import { createLocalStorageAdapter } from "../../src/modules/reminders/storage.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
  };
}

describe("createLocalStorageAdapter", () => {
  it("returns an empty list when nothing is stored", () => {
    const adapter = createLocalStorageAdapter({ storage: memoryStorage() });
    expect(adapter.load()).toEqual([]);
  });

  it("round-trips reminders", () => {
    const adapter = createLocalStorageAdapter({ storage: memoryStorage() });
    const reminders = [
      { id: "1", title: "Call", date: "2026-09-27T12:00:00.000Z" },
    ];
    adapter.save(reminders);
    expect(adapter.load()).toEqual(reminders);
  });

  it("returns an empty list for invalid JSON", () => {
    const storage = memoryStorage();
    storage.setItem("self-reminder.reminders", "{not-json");
    const adapter = createLocalStorageAdapter({ storage });
    expect(adapter.load()).toEqual([]);
  });
});
