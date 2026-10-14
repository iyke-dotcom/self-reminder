import { DEFAULT_API_URL, getAuth, request } from "./sync.js";

function apiUrl() {
  return getAuth().apiUrl || DEFAULT_API_URL;
}

function token() {
  const auth = getAuth();
  if (!auth.token) throw new Error("Not logged in");
  return auth.token;
}

function call({ path, method = "GET", body }) {
  return request({ url: apiUrl(), path, method, body, token: token() });
}

// True only for a real backend session. Offline local-fallback sessions can
// use solo reminders but not groups (membership lives on the server).
export function canUseGroups() {
  return Boolean(getAuth().token);
}

// Backend user id for UI-only decisions (author/admin-self). The server
// re-enforces every permission; this just hides irrelevant buttons.
export function getUserId() {
  const auth = getAuth();
  if (auth.userId) return auth.userId;
  if (!auth.token) return null;
  try {
    const payload = JSON.parse(
      atob(auth.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return payload.sub || null;
  } catch {
    return null;
  }
}

export async function fetchFeed() {
  return call({ path: "/api/groups/feed" });
}

export async function createGroup({ name, description, type }) {
  const data = await call({
    path: "/api/groups",
    method: "POST",
    body: { name, description, type },
  });
  return data.group;
}

export async function getGroup(id) {
  const data = await call({ path: `/api/groups/${id}` });
  return data;
}

export async function updateGroup(id, patch) {
  const data = await call({
    path: `/api/groups/${id}`,
    method: "PATCH",
    body: patch,
  });
  return data.group;
}

export async function deleteGroup(id) {
  await call({ path: `/api/groups/${id}`, method: "DELETE" });
}

export async function leaveGroup(id) {
  await call({ path: `/api/groups/${id}/leave`, method: "POST", body: {} });
}

export async function refreshInvite(id) {
  const data = await call({
    path: `/api/groups/${id}/invite/refresh`,
    method: "POST",
    body: {},
  });
  return data.group;
}

export async function joinGroup(code) {
  const data = await call({
    path: "/api/groups/join",
    method: "POST",
    body: { code },
  });
  return data;
}

export async function previewInvite(code) {
  const data = await request({
    url: apiUrl(),
    path: `/api/invites/${encodeURIComponent(code)}`,
  });
  return data.invite;
}

export async function searchUsers(q) {
  const data = await call({
    path: `/api/users/search?q=${encodeURIComponent(q)}`,
  });
  return data.users || [];
}

export async function addMemberById(groupId, userId) {
  await call({
    path: `/api/groups/${groupId}/members`,
    method: "POST",
    body: { userId },
  });
}

export async function promoteMember(groupId, userId) {
  await call({
    path: `/api/groups/${groupId}/members/${userId}/promote`,
    method: "POST",
    body: {},
  });
}

export async function removeMember(groupId, userId) {
  await call({
    path: `/api/groups/${groupId}/members/${userId}`,
    method: "DELETE",
  });
}

export async function createEvent(groupId, payload) {
  const data = await call({
    path: `/api/groups/${groupId}/events`,
    method: "POST",
    body: payload,
  });
  return data;
}

export async function deleteEvent(groupId, eventId) {
  await call({
    path: `/api/groups/${groupId}/events/${eventId}`,
    method: "DELETE",
  });
}

export async function rsvp(groupId, eventId, status) {
  const data = await call({
    path: `/api/groups/${groupId}/events/${eventId}/rsvp`,
    method: "POST",
    body: { status },
  });
  return data;
}

export async function addNote(groupId, eventId, { body, privateToAdmins }) {
  const data = await call({
    path: `/api/groups/${groupId}/events/${eventId}/notes`,
    method: "POST",
    body: { body, privateToAdmins },
  });
  return data;
}

export async function editNote(groupId, eventId, noteId, body) {
  await call({
    path: `/api/groups/${groupId}/events/${eventId}/notes/${noteId}`,
    method: "PATCH",
    body: { body },
  });
}

export async function deleteNote(groupId, eventId, noteId) {
  const data = await call({
    path: `/api/groups/${groupId}/events/${eventId}/notes/${noteId}`,
    method: "DELETE",
  });
  return data;
}

export async function unhideNote(groupId, eventId, noteId) {
  await call({
    path: `/api/groups/${groupId}/events/${eventId}/notes/${noteId}/unhide`,
    method: "POST",
    body: {},
  });
}

export async function markSeen(groupId) {
  await call({
    path: `/api/groups/${groupId}/seen`,
    method: "POST",
    body: {},
  });
}

export function inviteLink(code) {
  return `${location.origin}/#/app/groups/join/${encodeURIComponent(code)}`;
}
