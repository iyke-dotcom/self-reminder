export function createStore({ adapter, initial = [] }) {
  let state = { reminders: [...initial] };
  const listeners = new Set();

  function emit() {
    listeners.forEach((listener) => listener(state));
  }

  function setReminders(reminders) {
    state = { reminders };
    adapter.save(reminders);
    emit();
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
      setReminders([...state.reminders, reminder]);
    },
    deleteReminder(id) {
      setReminders(state.reminders.filter((item) => item.id !== id));
    },
    markNotified(id) {
      setReminders(
        state.reminders.map((item) =>
          item.id === id ? { ...item, notified: true } : item,
        ),
      );
    },
  };
}
