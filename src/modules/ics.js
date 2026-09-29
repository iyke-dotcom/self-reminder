function escapeText(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function toUtcIso(date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

const FREQUENCY = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};

function buildEvent(reminder) {
  const lines = ["BEGIN:VEVENT"];
  lines.push(`UID:${reminder.id}@self-reminder`);
  lines.push(`DTSTAMP:${toUtcIso(new Date())}`);
  lines.push(`DTSTART:${toUtcIso(new Date(reminder.date))}`);
  lines.push(`SUMMARY:${escapeText(reminder.title)}`);
  if (reminder.recurring) {
    const frequency =
      FREQUENCY[reminder.recurring.freq || reminder.recurring.frequency];
    if (frequency) {
      const interval =
        (reminder.recurring.interval || 1) > 1
          ? `;INTERVAL=${reminder.recurring.interval}`
          : "";
      lines.push(`RRULE:FREQ=${frequency}${interval}`);
    }
  }
  if (reminder.tags?.length) {
    lines.push(`CATEGORIES:${reminder.tags.map(escapeText).join(",")}`);
  }
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

export function buildIcs(reminders) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Self Reminder//EN",
    "CALSCALE:GREGORIAN",
    ...reminders.map(buildEvent),
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function downloadIcs(reminders, filename) {
  const blob = new Blob([buildIcs(reminders)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || "self-reminder.ics";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
