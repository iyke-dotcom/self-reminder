import { describe, expect, it } from "vitest";
import { createStore } from "../../src/modules/reminders/store.js";

function memoryAdapter(initial = []) {
  let saved = [...initial];
  return {
    load: () => saved,
    save: (reminders) => {
      saved = reminders;
    },
    getSaved: () => saved,
  };
}

describe("createStore", () => {
  it("adds, deletes, and marks notified reminders", () => {
    const adapter = memoryAdapter();
    const store = createStore({ adapter });
    const reminder = {
      id: "1",
      title: "Call",
      date: "2026-09-27T12:00:00.000Z",
      notified: false,
    };

    store.addReminder(reminder);
    expect(store.getState().reminders).toHaveLength(1);
    expect(adapter.getSaved()).toHaveLength(1);

    store.markNotified("1");
    expect(store.getState().reminders[0].notified).toBe(true);

    store.deleteReminder("1");
    expect(store.getState().reminders).toEqual([]);
  });
});
