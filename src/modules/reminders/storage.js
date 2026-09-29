export const STORAGE_KEY = "self-reminder.reminders";

export function createLocalStorageAdapter({
  key = STORAGE_KEY,
  storage = globalThis.localStorage,
} = {}) {
  return {
    load() {
      if (!storage) return [];
      try {
        return JSON.parse(storage.getItem(key)) || [];
      } catch {
        return [];
      }
    },
    save(reminders) {
      if (!storage) return;
      storage.setItem(key, JSON.stringify(reminders));
    },
  };
}
