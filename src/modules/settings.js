const SETTINGS_KEY = "self-reminder.settings";

export const DEFAULT_SETTINGS = {
  sound: true,
  preReminderMinutes: 0,
  theme: "system",
};

let cached = null;

export function getSettings() {
  if (cached) return { ...cached };
  try {
    const raw = JSON.parse(
      globalThis.localStorage?.getItem(SETTINGS_KEY) || "{}",
    );
    cached = { ...DEFAULT_SETTINGS, ...raw };
  } catch {
    cached = { ...DEFAULT_SETTINGS };
  }
  return { ...cached };
}

export function setSettings(patch) {
  cached = { ...getSettings(), ...patch };
  globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(cached));
  return { ...cached };
}

export function effectiveDueDate(reminderDateIso, settings = getSettings()) {
  const date = new Date(reminderDateIso).getTime();
  return date - (settings.preReminderMinutes || 0) * 60 * 1000;
}
