import { fetchFeed } from "../groups.js";
import { getSettings } from "../settings.js";

const FIRED_KEY = "self-reminder.groupNotified";

// Decision (spec leaves UX ambiguous): during quiet hours a due group event
// is marked fired and shown as a silent in-app toast only — no system ping,
// no sound, no vibration. Opted-out members (RSVP "declined") are never
// pinged, but the event stays in their list with their note attached.
export function inQuietHours(settings, now = new Date()) {
  const { quietFrom, quietTo } = settings;
  if (!quietFrom || !quietTo) return false;
  const toMin = (value) => {
    const [h, m] = String(value).split(":").map(Number);
    return h * 60 + m;
  };
  const current = now.getHours() * 60 + now.getMinutes();
  const from = toMin(quietFrom);
  const to = toMin(quietTo);
  return from <= to
    ? current >= from && current < to
    : current >= from || current < to;
}

function readFired() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(FIRED_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeFired(map) {
  try {
    globalThis.localStorage?.setItem(FIRED_KEY, JSON.stringify(map));
  } catch {
    // storage full/blocked: notifications still fire once per tick window
  }
}

export function startGroupChecker({
  canRun,
  onEvent,
  intervalMs = 60_000,
  now = () => Date.now(),
}) {
  async function tick() {
    if (!canRun()) return;
    let feed;
    try {
      feed = await fetchFeed();
    } catch {
      return;
    }
    const settings = getSettings();
    const quiet = inQuietHours(settings);
    const fired = readFired();
    let changed = false;
    for (const event of feed.upcoming || []) {
      if (event.myRsvp === "declined") continue;
      const at = new Date(event.date).getTime();
      if (Number.isNaN(at)) continue;
      for (const offset of event.reminderOffsets || []) {
        const fireAt = at - Number(offset) * 60_000;
        const key = `${event.id}:${offset}`;
        if (fired[key] || fireAt > now()) continue;
        fired[key] = true;
        changed = true;
        onEvent(event, { offset: Number(offset), quiet });
      }
    }
    if (changed) writeFired(fired);
  }

  tick();
  return setInterval(tick, intervalMs);
}

export function vibrate(pattern = 200) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // vibration unsupported — sound/toast still apply
  }
}
