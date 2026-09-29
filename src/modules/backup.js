export function validateBackup(payload) {
  if (!Array.isArray(payload)) {
    throw new Error("Backup must contain a list of reminders");
  }
  const seen = new Set();
  payload.forEach((value, index) => {
    if (!value || typeof value.id !== "string" || !value.title) {
      throw new Error(`Invalid reminder at position ${index + 1}`);
    }
    if (seen.has(value.id)) {
      throw new Error(`Duplicate reminder id ${value.id}`);
    }
    seen.add(value.id);
  });
  return payload;
}

export function parseBackup(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("File is not valid JSON");
  }
  const meta =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload.meta
      : null;
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    Array.isArray(payload.reminders)
  ) {
    payload = payload.reminders;
  }
  const reminders = validateBackup(payload || []);
  return {
    reminders,
    exportedAt: meta?.exportedAt || null,
    version: meta?.version || null,
  };
}

export function buildBackup(reminders) {
  return JSON.stringify(
    {
      meta: {
        exportedAt: new Date().toISOString(),
        version: 1,
      },
      reminders,
    },
    null,
    2,
  );
}

export function downloadBackup(reminders, filename) {
  const blob = new Blob([buildBackup(reminders)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || backupFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function backupFilename() {
  const stamp = new Date().toISOString().slice(0, 10);
  return `self-reminder-backup-${stamp}.json`;
}
