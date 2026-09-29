export function createStore({ adapter, initial = [] }) {
  let state = { reminders: [...initial].map(withDefaults) };
  let tombstones = [];
  const listeners = new Set();

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  function setReminders(reminders) {
    const stamp = Date.now();
    const prev = new Map(state.reminders.map((r) => [r.id, r]));
    state = {
      reminders: reminders.map((item) =>
        prev.get(item.id) === item ? item : { ...item, updatedAt: stamp },
      ),
    };
    adapter.save(state.reminders);
    if (adapter.saveAsync) {
      adapter.saveAsync(state.reminders).catch((error) => {
        console.error("Async persistence failed", error);
      });
    }
    emit();
  }

  function updateMap(mapper) {
    setReminders(mapper(state.reminders));
  }

  return {
    getState() {
      return state;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    addReminder(reminder) {
      setReminders([...state.reminders, withDefaults(reminder)]);
    },
    replaceAll(reminders) {
      state = { reminders: reminders.map(withDefaults) };
      adapter.save(state.reminders);
      if (adapter.saveAsync) {
        adapter.saveAsync(state.reminders).catch((error) => {
          console.error("Async persistence failed", error);
        });
      }
      emit();
    },
    updateReminder(id, patch) {
      updateMap((items) =>
        items.map((item) =>
          item.id === id ? withDefaults({ ...item, ...patch, id }) : item,
        ),
      );
    },
    deleteReminder(id) {
      const item = state.reminders.find((r) => r.id === id);
      if (item) {
        tombstones = tombstones.filter((t) => t.id !== id);
        tombstones.push({ id, updatedAt: Date.now() });
      }
      updateMap((items) => items.filter((item) => item.id !== id));
    },
    toggleDone(id) {
      updateMap((items) =>
        items.map((item) =>
          item.id === id ? { ...item, done: !item.done } : item,
        ),
      );
    },
    markNotified(id) {
      updateMap((items) =>
        items.map((item) =>
          item.id === id ? { ...item, notified: true } : item,
        ),
      );
    },
    reschedule(id, nextDate) {
      updateMap((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                date: new Date(nextDate).toISOString(),
                notified: false,
              }
            : item,
        ),
      );
    },
    snooze(id, amountMs) {
      updateMap((items) =>
        items.map((item) =>
          item.id === id
            ? {
                ...item,
                date: new Date(Date.now() + amountMs).toISOString(),
                notified: false,
              }
            : item,
        ),
      );
    },
    getTombstones() {
      return [...tombstones];
    },
    ackTombstones(ids) {
      const acked = new Set(ids);
      tombstones = tombstones.filter((t) => !acked.has(t.id));
    },
  };
}

function withDefaults(reminder) {
  return {
    notified: false,
    done: false,
    priority: "medium",
    tags: [],
    recurring: null,
    updatedAt: Date.now(),
    ...reminder,
  };
}
