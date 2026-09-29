const DUE_BEEP =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAA=";

function playBeep() {
  const audio = new Audio(DUE_BEEP);
  audio.play().catch(() => {});
}

export function startDueChecker({
  store,
  onDue,
  intervalMs = 2000,
  now = () => Date.now(),
}) {
  function tick() {
    store.getState().reminders.forEach((reminder) => {
      const dueAt = new Date(reminder.date).getTime();
      if (!reminder.notified && dueAt - now() <= 0) {
        store.markNotified(reminder.id);
        onDue(reminder);
        playBeep();
      }
    });
  }

  tick();
  return setInterval(tick, intervalMs);
}
