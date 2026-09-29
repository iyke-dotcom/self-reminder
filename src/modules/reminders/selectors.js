import { classifyDue } from "../../utils/date.js";

export const STATUS_FILTERS = ["all", "active", "done", "overdue", "soon"];

export function filterReminders(
  reminders,
  { query = "", status = "all", tag = null, now = Date.now() } = {},
) {
  const normalizedQuery = query.trim().toLowerCase();

  return reminders.filter((reminder) => {
    if (status === "active" && reminder.done) return false;
    if (status === "done" && !reminder.done) return false;

    const state = classifyDue(reminder.date, now);
    if (status === "overdue" && state !== "overdue") return false;
    if (status === "soon" && state !== "soon") return false;

    if (normalizedQuery) {
      const inTitle = reminder.title.toLowerCase().includes(normalizedQuery);
      const inTags = (reminder.tags || []).some((t) =>
        t.toLowerCase().includes(normalizedQuery),
      );
      if (!inTitle && !inTags) return false;
    }

    if (tag && !(reminder.tags || []).includes(tag)) return false;

    return true;
  });
}

export function sortReminders(reminders, sortBy = "date") {
  const dateAsc = (a, b) => new Date(a.date) - new Date(b.date);
  const priorityWeight = { high: 0, medium: 1, low: 2 };

  return [...reminders].sort((a, b) => {
    if (sortBy === "priority") {
      return (
        priorityWeight[a.priority ?? "medium"] -
        priorityWeight[b.priority ?? "medium"]
      );
    }
    if (sortBy === "title") {
      return a.title.localeCompare(b.title);
    }
    return dateAsc(a, b);
  });
}

export function collectTags(reminders) {
  const tags = new Set();
  reminders.forEach((r) => (r.tags || []).forEach((t) => tags.add(t)));
  return [...tags].sort();
}
