import { getAuth, request } from "./sync.js";

function authed(path, apiUrl) {
  const auth = getAuth();
  if (!auth.token) throw new Error("Not logged in");
  return request({ url: apiUrl, path, token: auth.token });
}

export async function fetchAdminUsers({ apiUrl }) {
  const data = await authed("/api/admin/users", apiUrl);
  return data.users || [];
}

export async function fetchAdminReminders({ apiUrl }) {
  const data = await authed("/api/admin/reminders", apiUrl);
  return data.reminders || [];
}
