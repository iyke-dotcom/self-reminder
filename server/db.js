import { PGlite } from "@electric-sql/pglite";
import { randomBytes, randomUUID } from "node:crypto";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  email text,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'customer',
  created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  uid text NOT NULL,
  owner text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  date text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  priority text NOT NULL DEFAULT 'medium',
  tags jsonb NOT NULL DEFAULT '[]',
  recurring jsonb,
  notified boolean NOT NULL DEFAULT false,
  done boolean NOT NULL DEFAULT false,
  updated_at bigint NOT NULL,
  deleted_at bigint,
  PRIMARY KEY (owner, uid)
);

CREATE INDEX IF NOT EXISTS reminders_owner_updated ON reminders (owner, updated_at);

CREATE TABLE IF NOT EXISTS tombstones (
  owner text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uid text NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (owner, uid)
);

-- Groups & shared events. One engine for solo/pair/study/medical/corporate:
-- only labels/templates differ (see GROUP_TYPES / client template map).
CREATE TABLE IF NOT EXISTS groups (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'custom',
  invite_code text NOT NULL UNIQUE,
  invite_expires_at bigint NOT NULL,
  member_event_create boolean NOT NULL DEFAULT true,
  created_by text REFERENCES users(id),
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  label text NOT NULL DEFAULT '',
  last_seen_at bigint NOT NULL DEFAULT 0,
  created_at bigint NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_events (
  id text PRIMARY KEY,
  group_id text NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  date text NOT NULL,
  reminder_offsets jsonb NOT NULL DEFAULT '[1440, 60]',
  recurring jsonb,
  created_by text REFERENCES users(id),
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS rsvps (
  event_id text NOT NULL REFERENCES group_events(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL,
  updated_at bigint NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_notes (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES group_events(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body text NOT NULL,
  private_to_admins boolean NOT NULL DEFAULT false,
  hidden boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS group_members_user ON group_members (user_id);
CREATE INDEX IF NOT EXISTS group_events_group_date ON group_events (group_id, date);
CREATE INDEX IF NOT EXISTS event_notes_event ON event_notes (event_id);
`;

// Named limits so v1 caps can be raised without hunting through the code.
export const MAX_GROUP_MEMBERS = 50;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const GROUP_TYPES = [
  "solo",
  "pair",
  "study",
  "medical",
  "corporate",
  "custom",
];
export const RSVP_STATUSES = ["going", "maybe", "declined"];

// Additive migration for databases created before the role/segmentation
// refactor (e.g. the on-disk server/.pgdata). Fresh databases already get the
// new columns from SCHEMA above; the ALTERs are no-ops there.
const MIGRATIONS = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS email text",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT ''",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'customer'",
  "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT ''",
  "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'",
];

export async function createDb(dataDir = null) {
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.exec(SCHEMA);
  for (const sql of MIGRATIONS) {
    await db.exec(sql);
  }
  return db;
}

export function rowToReminder(row) {
  return {
    id: row.uid,
    title: row.title,
    description: row.description ?? "",
    date: row.date,
    status: row.status ?? "active",
    priority: row.priority,
    tags: row.tags ?? [],
    recurring: row.recurring,
    notified: row.notified,
    done: row.done,
    updatedAt: Number(row.updated_at),
  };
}

export function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? null,
    name: row.name ?? "",
    role: row.role ?? "customer",
    created_at: Number(row.created_at),
  };
}

export async function findUserByUsername(db, username) {
  const result = await db.query("SELECT * FROM users WHERE username = $1", [
    username,
  ]);
  return result.rows[0] || null;
}

export async function findUserById(db, id) {
  const result = await db.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function findUserByEmail(db, email) {
  const result = await db.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  return result.rows[0] || null;
}

export async function createUser(
  db,
  {
    id = randomUUID(),
    username,
    passwordHash,
    email = null,
    name = "",
    role = "customer",
    now = Date.now(),
  },
) {
  await db.query(
    "INSERT INTO users (id, username, password_hash, email, name, role, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [id, username, passwordHash, email, name, role, now],
  );
  return id;
}

export async function setUserRole(db, id, role) {
  await db.query("UPDATE users SET role = $2 WHERE id = $1", [id, role]);
}

export async function listUsers(db) {
  const result = await db.query(
    "SELECT id, username, email, name, role, created_at FROM users ORDER BY created_at ASC",
  );
  return result.rows.map(rowToUser);
}

export async function listAllReminders(db) {
  const result = await db.query(
    "SELECT * FROM reminders WHERE deleted_at IS NULL ORDER BY updated_at DESC",
  );
  return result.rows.map((row) => ({
    ...rowToReminder(row),
    owner: row.owner,
  }));
}

export async function listReminders(db, owner) {
  const result = await db.query(
    "SELECT * FROM reminders WHERE owner = $1 AND deleted_at IS NULL",
    [owner],
  );
  return result.rows.map(rowToReminder);
}

export async function listTombstones(db, owner) {
  const result = await db.query(
    "SELECT uid, updated_at FROM tombstones WHERE owner = $1",
    [owner],
  );
  return result.rows.map((r) => ({
    id: r.uid,
    updatedAt: Number(r.updated_at),
  }));
}

const UPDATE_FIELDS = [
  "title",
  "description",
  "date",
  "status",
  "priority",
  "tags",
  "recurring",
  "notified",
  "done",
];

export async function applyUpdate(db, owner, reminder) {
  const values = {
    uid: reminder.id,
    owner,
    title: reminder.title,
    description: reminder.description ?? "",
    date: reminder.date,
    status: reminder.status === "cancelled" ? "cancelled" : "active",
    priority: reminder.priority || "medium",
    tags: reminder.tags || [],
    recurring: reminder.recurring ?? null,
    notified: Boolean(reminder.notified),
    done: Boolean(reminder.done),
    updated_at: Number(reminder.updatedAt),
  };
  const columns = [
    "uid",
    "owner",
    "title",
    "description",
    "date",
    "status",
    "priority",
    "tags",
    "recurring",
    "notified",
    "done",
    "updated_at",
  ];
  const conflict = UPDATE_FIELDS.map((f) => `${f} = EXCLUDED.${f}`).join(", ");
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  await db.query(
    `INSERT INTO reminders (${columns.join(", ")}) VALUES (${placeholders})
     ON CONFLICT (owner, uid) DO UPDATE SET ${conflict}, updated_at = EXCLUDED.updated_at, deleted_at = NULL
     WHERE reminders.updated_at <= EXCLUDED.updated_at`,
    columns.map((c) => values[c]),
  );
}

export async function applyDelete(db, owner, { id, updatedAt }) {
  const ts = Number(updatedAt);
  await db.query(
    `INSERT INTO tombstones (owner, uid, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (owner, uid) DO UPDATE SET updated_at = GREATEST(tombstones.updated_at, EXCLUDED.updated_at)`,
    [owner, id, ts],
  );
  await db.query(
    `UPDATE reminders SET deleted_at = $3, updated_at = GREATEST(updated_at, $3)
     WHERE owner = $1 AND uid = $2 AND (deleted_at IS NULL OR updated_at <= $3)`,
    [owner, id, ts],
  );
}

// ---------------------------------------------------------------------------
// Groups & shared events
// ---------------------------------------------------------------------------

export function newInviteCode() {
  return randomBytes(6).toString("base64url");
}

export function rowToGroup(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    type: row.type ?? "custom",
    inviteCode: row.invite_code,
    inviteExpiresAt: Number(row.invite_expires_at),
    memberEventCreate: Boolean(row.member_event_create),
    createdBy: row.created_by,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function createGroup(
  db,
  {
    id = randomUUID(),
    name,
    description = "",
    type = "custom",
    createdBy,
    now = Date.now(),
  },
) {
  const groupType = GROUP_TYPES.includes(type) ? type : "custom";
  // Retry on the (astronomically unlikely) invite-code collision.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.query(
        `INSERT INTO groups
           (id, name, description, type, invite_code, invite_expires_at,
            member_event_create, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $8)`,
        [
          id,
          name,
          description,
          groupType,
          newInviteCode(),
          now + INVITE_TTL_MS,
          createdBy,
          now,
        ],
      );
      return id;
    } catch (error) {
      const unique = error?.code === "23505";
      if (!unique || attempt === 4) throw error;
    }
  }
  throw new Error("Could not issue an invite code");
}

export async function getGroup(db, id) {
  const result = await db.query("SELECT * FROM groups WHERE id = $1", [id]);
  return result.rows[0] ? rowToGroup(result.rows[0]) : null;
}

export async function findGroupByInviteCode(db, code) {
  const result = await db.query("SELECT * FROM groups WHERE invite_code = $1", [
    code,
  ]);
  return result.rows[0] ? rowToGroup(result.rows[0]) : null;
}

export async function refreshInviteCode(db, groupId, now = Date.now()) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await db.query(
        `UPDATE groups SET invite_code = $2, invite_expires_at = $3,
         updated_at = $3 WHERE id = $1`,
        [groupId, newInviteCode(), now + INVITE_TTL_MS, now],
      );
      return getGroup(db, groupId);
    } catch (error) {
      if (error?.code !== "23505" || attempt === 4) throw error;
    }
  }
  throw new Error("Could not issue an invite code");
}

export async function updateGroup(db, id, patch, now = Date.now()) {
  const sets = [];
  const values = [id];
  if (typeof patch.name === "string" && patch.name.trim()) {
    values.push(patch.name.trim().slice(0, 120));
    sets.push(`name = $${values.length}`);
  }
  if (typeof patch.description === "string") {
    values.push(patch.description.slice(0, 2000));
    sets.push(`description = $${values.length}`);
  }
  if (typeof patch.type === "string" && GROUP_TYPES.includes(patch.type)) {
    values.push(patch.type);
    sets.push(`type = $${values.length}`);
  }
  if (typeof patch.memberEventCreate === "boolean") {
    values.push(patch.memberEventCreate);
    sets.push(`member_event_create = $${values.length}`);
  }
  if (sets.length === 0) return getGroup(db, id);
  values.push(now);
  sets.push(`updated_at = $${values.length}`);
  await db.query(`UPDATE groups SET ${sets.join(", ")} WHERE id = $1`, values);
  return getGroup(db, id);
}

export async function deleteGroup(db, id) {
  await db.query("DELETE FROM groups WHERE id = $1", [id]);
}

export async function countMembers(db, groupId) {
  const result = await db.query(
    "SELECT COUNT(*)::int AS n FROM group_members WHERE group_id = $1",
    [groupId],
  );
  return result.rows[0]?.n ?? 0;
}

export async function countGroupAdmins(db, groupId) {
  const result = await db.query(
    "SELECT COUNT(*)::int AS n FROM group_members WHERE group_id = $1 AND role = 'admin'",
    [groupId],
  );
  return result.rows[0]?.n ?? 0;
}

export async function getMembership(db, groupId, userId) {
  const result = await db.query(
    "SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId],
  );
  return result.rows[0] || null;
}

export async function addMember(
  db,
  { groupId, userId, role = "member", label = "", now = Date.now() },
) {
  await db.query(
    `INSERT INTO group_members
       (group_id, user_id, role, label, last_seen_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $5)
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [groupId, userId, role, label, now],
  );
}

export async function removeMember(db, groupId, userId) {
  await db.query(
    "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2",
    [groupId, userId],
  );
}

export async function setMemberRole(db, groupId, userId, role) {
  await db.query(
    "UPDATE group_members SET role = $3 WHERE group_id = $1 AND user_id = $2",
    [groupId, userId, role],
  );
}

export async function setMemberLabel(db, groupId, userId, label) {
  await db.query(
    "UPDATE group_members SET label = $3 WHERE group_id = $1 AND user_id = $2",
    [groupId, userId, String(label || "").slice(0, 40)],
  );
}

export async function touchLastSeen(db, groupId, userId, now = Date.now()) {
  await db.query(
    "UPDATE group_members SET last_seen_at = $3 WHERE group_id = $1 AND user_id = $2",
    [groupId, userId, now],
  );
}

export async function listMembers(db, groupId) {
  const result = await db.query(
    `SELECT m.user_id, m.role, m.label, m.last_seen_at, m.created_at,
            u.username, u.name
     FROM group_members m JOIN users u ON u.id = m.user_id
     WHERE m.group_id = $1 ORDER BY m.created_at ASC`,
    [groupId],
  );
  return result.rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    name: r.name ?? "",
    role: r.role,
    label: r.label ?? "",
  }));
}

export async function listMyGroups(db, userId) {
  const result = await db.query(
    `SELECT g.*, m.role AS my_role,
            (SELECT COUNT(*)::int FROM group_members WHERE group_id = g.id) AS member_count
     FROM groups g JOIN group_members m ON m.group_id = g.id
     WHERE m.user_id = $1 ORDER BY g.updated_at DESC`,
    [userId],
  );
  return result.rows.map((r) => ({
    ...rowToGroup(r),
    myRole: r.my_role,
    memberCount: r.member_count ?? 0,
  }));
}

export function rowToGroupEvent(row) {
  return {
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    description: row.description ?? "",
    location: row.location ?? "",
    date: row.date,
    reminderOffsets: Array.isArray(row.reminder_offsets)
      ? row.reminder_offsets
          .map(Number)
          .filter((n) => Number.isFinite(n) && n >= 0)
      : [1440, 60],
    recurring: row.recurring ?? null,
    createdBy: row.created_by,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function createGroupEvent(
  db,
  {
    id = randomUUID(),
    groupId,
    title,
    description = "",
    location = "",
    date,
    reminderOffsets = [10080, 1440, 60],
    recurring = null,
    createdBy,
    now = Date.now(),
  },
) {
  const offsets = (
    Array.isArray(reminderOffsets) ? reminderOffsets : [reminderOffsets]
  )
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 0)
    .slice(0, 10);
  await db.query(
    `INSERT INTO group_events
       (id, group_id, title, description, location, date, reminder_offsets,
        recurring, created_by, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [
      id,
      groupId,
      title,
      description,
      location,
      date,
      JSON.stringify(offsets.length ? offsets : [60]),
      recurring ? JSON.stringify(recurring) : null,
      createdBy,
      now,
    ],
  );
  return id;
}

export async function getGroupEvent(db, id) {
  const result = await db.query("SELECT * FROM group_events WHERE id = $1", [
    id,
  ]);
  return result.rows[0] ? rowToGroupEvent(result.rows[0]) : null;
}

export async function listGroupEvents(db, groupId, limit = 200) {
  const result = await db.query(
    "SELECT * FROM group_events WHERE group_id = $1 ORDER BY date ASC LIMIT $2",
    [groupId, limit],
  );
  return result.rows.map(rowToGroupEvent);
}

export async function deleteGroupEvent(db, id) {
  await db.query("DELETE FROM group_events WHERE id = $1", [id]);
}

export async function setRsvp(
  db,
  { eventId, userId, status, now = Date.now() },
) {
  await db.query(
    `INSERT INTO rsvps (event_id, user_id, status, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (event_id, user_id)
     DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at`,
    [eventId, userId, status, now],
  );
}

export async function listRsvps(db, eventId) {
  const result = await db.query(
    `SELECT r.user_id, r.status, r.updated_at, u.username
     FROM rsvps r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = $1`,
    [eventId],
  );
  return result.rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    status: r.status,
    updatedAt: Number(r.updated_at),
  }));
}

export function summarizeRsvps(rsvps) {
  const summary = { going: 0, maybe: 0, declined: 0 };
  for (const r of rsvps) {
    if (summary[r.status] !== undefined) summary[r.status] += 1;
  }
  return summary;
}

export function rowToEventNote(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    author: row.username ?? "",
    body: row.body,
    privateToAdmins: Boolean(row.private_to_admins),
    hidden: Boolean(row.hidden),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function createEventNote(
  db,
  {
    id = randomUUID(),
    eventId,
    userId,
    body,
    privateToAdmins = false,
    now = Date.now(),
  },
) {
  await db.query(
    `INSERT INTO event_notes
       (id, event_id, user_id, body, private_to_admins, hidden,
        created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, false, $6, $6)`,
    [id, eventId, userId, body, Boolean(privateToAdmins), now],
  );
  return id;
}

// Visible notes for a viewer: hidden notes only for group admins;
// private notes for group admins + the author; the rest for all members.
export async function listEventNotes(db, eventId, { isGroupAdmin, viewerId }) {
  const result = await db.query(
    `SELECT n.*, u.username FROM event_notes n
     JOIN users u ON u.id = n.user_id
     WHERE n.event_id = $1 ORDER BY n.created_at ASC`,
    [eventId],
  );
  return result.rows.map(rowToEventNote).filter((note) => {
    if (note.hidden) return isGroupAdmin;
    if (note.privateToAdmins) return isGroupAdmin || note.userId === viewerId;
    return true;
  });
}

export async function getEventNote(db, id) {
  const result = await db.query(
    "SELECT n.*, u.username FROM event_notes n JOIN users u ON u.id = n.user_id WHERE n.id = $1",
    [id],
  );
  return result.rows[0] ? rowToEventNote(result.rows[0]) : null;
}

export async function updateEventNoteBody(db, id, body, now = Date.now()) {
  await db.query(
    "UPDATE event_notes SET body = $2, updated_at = $3 WHERE id = $1",
    [id, body, now],
  );
}

export async function setEventNoteHidden(db, id, hidden, now = Date.now()) {
  await db.query(
    "UPDATE event_notes SET hidden = $2, updated_at = $3 WHERE id = $1",
    [id, Boolean(hidden), now],
  );
}

export async function deleteEventNote(db, id) {
  await db.query("DELETE FROM event_notes WHERE id = $1", [id]);
}

// Home feed: my groups, upcoming events across them (soonest first) with my
// RSVP attached, plus badge counts (pending RSVPs, notes newer than my visit).
export async function getGroupsFeed(db, userId) {
  const groups = await listMyGroups(db, userId);
  const groupIds = groups.map((g) => g.id);
  let upcoming = [];
  let unreadNotes = 0;
  let pendingRsvps = 0;
  if (groupIds.length > 0) {
    const eventsResult = await db.query(
      `SELECT e.*, m.last_seen_at AS my_last_seen,
              r.status AS my_rsvp,
              (SELECT COUNT(*)::int FROM rsvps WHERE event_id = e.id AND status = 'going') AS going_n,
              (SELECT COUNT(*)::int FROM rsvps WHERE event_id = e.id AND status = 'maybe') AS maybe_n,
              (SELECT COUNT(*)::int FROM rsvps WHERE event_id = e.id AND status = 'declined') AS declined_n
       FROM group_events e
       JOIN group_members m ON m.group_id = e.group_id AND m.user_id = $1
       LEFT JOIN rsvps r ON r.event_id = e.id AND r.user_id = $1
       WHERE e.group_id = ANY($2)
       ORDER BY e.date ASC LIMIT 100`,
      [userId, groupIds],
    );
    upcoming = eventsResult.rows.map((row) => {
      const event = rowToGroupEvent(row);
      if (!row.my_rsvp) pendingRsvps += 1;
      return {
        ...event,
        myRsvp: row.my_rsvp || null,
        summary: {
          going: row.going_n ?? 0,
          maybe: row.maybe_n ?? 0,
          declined: row.declined_n ?? 0,
        },
      };
    });
    const notesResult = await db.query(
      `SELECT COUNT(*)::int AS n FROM event_notes n
       JOIN group_events e ON e.id = n.event_id
       JOIN group_members m ON m.group_id = e.group_id AND m.user_id = $1
       WHERE e.group_id = ANY($2) AND n.hidden = false
         AND n.created_at > m.last_seen_at AND n.user_id <> $1
         AND (n.private_to_admins = false OR m.role = 'admin')`,
      [userId, groupIds],
    );
    unreadNotes = notesResult.rows[0]?.n ?? 0;
  }
  return { groups, upcoming, unreadNotes, pendingRsvps };
}

export async function searchUsers(db, query, excludeId, limit = 20) {
  const q = `%${String(query || "")
    .trim()
    .toLowerCase()}%`;
  const result = await db.query(
    `SELECT id, username, name FROM users
     WHERE id <> $1 AND (LOWER(username) LIKE $2 OR LOWER(COALESCE(name, '')) LIKE $2
       OR LOWER(COALESCE(email, '')) LIKE $2)
     ORDER BY username ASC LIMIT $3`,
    [excludeId, q, limit],
  );
  return result.rows.map((r) => ({
    id: r.id,
    username: r.username,
    name: r.name ?? "",
  }));
}
