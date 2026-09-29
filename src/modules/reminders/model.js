import { createId } from "../../utils/id.js";
import { isValidDate } from "../../utils/date.js";

export function createReminder({ title, date, id = createId() }) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) {
    throw new Error("Title is required");
  }
  if (!isValidDate(date)) {
    throw new Error("A valid date is required");
  }

  return {
    id,
    title: trimmed,
    date: new Date(date).toISOString(),
    notified: false,
  };
}
