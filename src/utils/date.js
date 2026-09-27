export function formatDateTime(value) {
  const d = new Date(value);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function classifyDue(date, now = Date.now()) {
  const diff = new Date(date).getTime() - now;
  if (diff < 0) return "overdue";
  if (diff <= 5 * 60 * 1000) return "soon";
  return "future";
}

export function isValidDate(value) {
  return !isNaN(new Date(value).getTime());
}
