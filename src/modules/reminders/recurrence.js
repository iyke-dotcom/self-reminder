export const RECURRING_FREQUENCIES = ["daily", "weekly", "monthly"];

export function createRecurringRule({ freq = "daily", interval = 1 } = {}) {
  if (!RECURRING_FREQUENCIES.includes(freq)) {
    throw new Error(`Unsupported frequency: ${freq}`);
  }
  const normalized = Math.max(1, Math.floor(interval) || 1);
  return { freq, interval: normalized };
}

export function computeNextDate(date, rule, after = Date.now()) {
  let next = new Date(date);
  do {
    if (rule.freq === "daily") {
      next = addDays(next, rule.interval);
    } else if (rule.freq === "weekly") {
      next = addDays(next, 7 * rule.interval);
    } else if (rule.freq === "monthly") {
      next = addMonths(next, rule.interval);
    }
  } while (next.getTime() <= after);
  return next;
}

export function describeRecurring(rule) {
  if (!rule) return "";
  const every = rule.interval > 1 ? `every ${rule.interval} ` : "";
  const labels = { daily: "day", weekly: "week", monthly: "month" };
  return `Repeats ${every}${labels[rule.freq]}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}
