const AUTH_KEY = "self-reminder.auth";
const SYNC_KEY = "self-reminder.sync";
export const DEFAULT_API_URL = "http://localhost:3000";

export function getAuth() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(AUTH_KEY) || "{}");
  } catch {
    return {};
  }
}

export function setAuth(auth) {
  globalThis.localStorage?.setItem(AUTH_KEY, JSON.stringify(auth || {}));
}

export function clearAuth() {
  globalThis.localStorage?.removeItem(AUTH_KEY);
  globalThis.localStorage?.removeItem(SYNC_KEY);
}

function getSyncMeta() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(SYNC_KEY) || "{}");
  } catch {
    return {};
  }
}

function setSyncMeta(meta) {
  globalThis.localStorage?.setItem(SYNC_KEY, JSON.stringify(meta || {}));
}

export async function request({
  url,
  path,
  method = "GET",
  body,
  token,
  timeoutMs = 10_000,
}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        data.error || `Request failed (${response.status})`,
      );
      error.status = response.status;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export async function register({ apiUrl, username, password }) {
  const { token } = await request({
    url: apiUrl,
    path: "/api/register",
    method: "POST",
    body: { username, password },
  });
  setAuth({ token, username, apiUrl });
  setSyncMeta({ lastSyncedAt: 0 });
}

export async function login({ apiUrl, username, password }) {
  const { token } = await request({
    url: apiUrl,
    path: "/api/login",
    method: "POST",
    body: { username, password },
  });
  setAuth({ token, username, apiUrl });
  setSyncMeta({ lastSyncedAt: 0 });
}

export function logout() {
  clearAuth();
}

export function mergeReminders(local, server, tombstones) {
  const tomb = new Map(tombstones.map((t) => [t.id, Number(t.updatedAt)]));
  const out = new Map(server.map((r) => [r.id, r]));

  for (const next of local) {
    const localTs = Number(next.updatedAt) || 0;
    if (tomb.has(next.id)) {
      if (tomb.get(next.id) >= localTs) {
        out.delete(next.id);
      } else {
        out.set(next.id, next);
      }
      continue;
    }
    const serverVersion = out.get(next.id);
    if (!serverVersion || localTs > (Number(serverVersion.updatedAt) || 0)) {
      out.set(next.id, next);
    }
  }
  return [...out.values()];
}

export async function syncNow({ store, apiUrl }) {
  const auth = getAuth();
  if (!auth.token) return { synced: false, reason: "no-auth" };

  const meta = getSyncMeta();
  const lastSyncedAt = Number(meta.lastSyncedAt) || 0;
  const local = store.getState().reminders;
  const tombstones = store.getTombstones();

  const updates = local.filter((r) => Number(r.updatedAt) > lastSyncedAt);
  const deletes = tombstones.filter((t) => Number(t.updatedAt) > lastSyncedAt);

  const data = await request({
    url: apiUrl,
    path: "/api/sync",
    method: "POST",
    body: { updates, deletes, lastSyncedAt },
    token: auth.token,
  });

  const merged = mergeReminders(local, data.reminders, data.tombstones);
  store.replaceAll(merged);
  store.ackTombstones(
    data.tombstones
      .map((t) => t.id)
      .filter((id) => tombstones.some((t) => t.id === id)),
  );

  setSyncMeta({ lastSyncedAt: Number(data.serverNow) || Date.now() });
  return { synced: true, count: merged.length };
}
