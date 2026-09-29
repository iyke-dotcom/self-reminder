import { computeNextDate } from "../reminders/recurrence.js";

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
  effectiveAt = (reminder) => new Date(reminder.date).getTime(),
  soundEnabled = () => true,
}) {
  function tick() {
    store.getState().reminders.forEach((reminder) => {
      if (reminder.done) return;

      const dueAt = effectiveAt(reminder);
      if (reminder.notified || dueAt - now() > 0) return;

      if (reminder.recurring) {
        const next = computeNextDate(reminder.date, reminder.recurring, now());
        store.reschedule(reminder.id, next);
        onDue(reminder);
        if (soundEnabled()) playBeep();
        return;
      }

      store.markNotified(reminder.id);
      onDue(reminder);
      if (soundEnabled()) playBeep();
    });
  }

  tick();
  return setInterval(tick, intervalMs);
}
