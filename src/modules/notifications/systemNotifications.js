export function notificationPermission() {
  return globalThis.Notification?.permission ?? "unsupported";
}

export async function requestNotificationPermission() {
  if (!globalThis.Notification) return "unsupported";
  if (notificationPermission() === "granted") return "granted";
  if (notificationPermission() === "denied") return "denied";
  try {
    const result = await globalThis.Notification.requestPermission();
    return result;
  } catch {
    return "unsupported";
  }
}

export function notify(title, options = {}) {
  if (globalThis.Notification?.permission !== "granted") return false;
  try {
    new Notification(title, {
      tag: options.tag || "self-reminder",
      body: options.body || "",
      icon: options.icon || "/icon-192.png",
      ...options,
    });
    return true;
  } catch {
    return false;
  }
}
