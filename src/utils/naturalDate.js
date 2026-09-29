const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const UNITS = {
  minute: 60_000,
  minutes: 60_000,
  hour: 3_600_000,
  hours: 3_600_000,
  day: 86_400_000,
  days: 86_400_000,
  week: 604_800_000,
  weeks: 604_800_000,
};
const TIME_PATTERN = /(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;

const pad = (n) => String(n).padStart(2, "0");
const toInput = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function parseNaturalDate(text, now = new Date()) {
  const input = String(text || "")
    .trim()
    .toLowerCase();
  if (!input) return null;

  const base = new Date(now);
  base.setSeconds(0, 0);

  if (input === "now") return toInput(base);

  const relative = input.match(
    /^in\s+(\d+)\s*(minute|minutes|hour|hours|day|days|week|weeks)$/,
  );
  if (relative) {
    return toInput(
      new Date(base.getTime() + Number(relative[1]) * UNITS[relative[2]]),
    );
  }

  if (input.includes("tonight")) {
    return toInput(new Date(base.setHours(19, 0, 0, 0)));
  }

  let day = new Date(base);
  let matched = true;
  if (input.includes("tomorrow")) {
    day.setDate(day.getDate() + 1);
  } else if (input.includes("today")) {
    // keep today
  } else if (
    input.startsWith("next ") &&
    DAY_NAMES.some((n) => input.includes(n))
  ) {
    const target = DAY_NAMES.findIndex((n) => input.includes(n));
    let delta = (target - base.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    day.setDate(day.getDate() + delta);
  } else if (DAY_NAMES.includes(input)) {
    const target = DAY_NAMES.indexOf(input);
    const delta = (target - base.getDay() + 7) % 7;
    day.setDate(day.getDate() + delta);
  } else {
    matched = false;
  }

  const m = input.match(TIME_PATTERN);
  const hasTime = m && /\d/.test(m[0]);
  if (hasTime && !matched) {
    day = new Date(base);
    matched = true;
  }

  if (!matched) return null;

  let hours;
  let minutes = 0;
  if (hasTime) {
    hours = Number(m[1]) % 24;
    if (m[2] !== undefined) minutes = Number(m[2]);
    const suffix = m[3]?.toLowerCase();
    if (suffix === "pm" && hours < 12) hours += 12;
    if (suffix === "am" && hours === 12) hours = 0;
  } else {
    hours = 9;
  }

  day.setHours(hours, minutes, 0, 0);
  return toInput(day);
}
