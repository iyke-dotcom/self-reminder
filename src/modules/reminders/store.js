export function createStore({ adapter, initial = [] }) {
  let state = { reminders: [...initial].map(withDefaults) };
  const listeners = new Set();

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  function setReminders(reminders) {
    state = { reminders };
    adapter.save(reminders);
    if (adapter.saveAsync) {
      adapter.saveAsync(reminders).catch((error) => {
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
      setReminders(reminders.map(withDefaults));
    },
    updateReminder(id, patch) {
      updateMap((items) =>
        items.map((item) =>
          item.id === id ? withDefaults({ ...item, ...patch, id }) : item,
        ),
      );
    },
    deleteReminder(id) {
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
  };
}

function withDefaults(reminder) {
  return {
    notified: false,
    done: false,
    priority: "medium",
    tags: [],
    recurring: null,
    ...reminder,
  };
}
