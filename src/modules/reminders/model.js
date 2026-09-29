import { createId } from "../../utils/id.js";
import { isValidDate } from "../../utils/date.js";
import { createRecurringRule } from "./recurrence.js";

export const PRIORITIES = ["low", "medium", "high"];

export function createReminder({
  title,
  date,
  id = createId(),
  priority = "medium",
  tags = [],
  recurring = null,
  done = false,
}) {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) {
    throw new Error("Title is required");
  }
  if (!isValidDate(date)) {
    throw new Error("A valid date is required");
  }
  if (!PRIORITIES.includes(priority)) {
    throw new Error(`Priority must be one of: ${PRIORITIES.join(", ")}`);
  }

  const rule =
    recurring == null
      ? null
      : typeof recurring === "object"
        ? createRecurringRule(recurring)
        : createRecurringRule();

  return {
    id,
    title: trimmed,
    date: new Date(date).toISOString(),
    notified: false,
    done: Boolean(done),
    priority,
    tags: normalizeTags(tags),
    recurring: rule,
  };
}

export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [
    ...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean)),
  ];
}
