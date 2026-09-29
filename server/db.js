import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at bigint NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  uid text NOT NULL,
  owner text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  date text NOT NULL,
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
`;

export async function createDb(dataDir = null) {
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  await db.exec(SCHEMA);
  return db;
}

export function rowToReminder(row) {
  return {
    id: row.uid,
    title: row.title,
    date: row.date,
    priority: row.priority,
    tags: row.tags ?? [],
    recurring: row.recurring,
    notified: row.notified,
    done: row.done,
    updatedAt: Number(row.updated_at),
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

export async function createUser(
  db,
  { id = randomUUID(), username, passwordHash, now = Date.now() },
) {
  await db.query(
    "INSERT INTO users (id, username, password_hash, created_at) VALUES ($1, $2, $3, $4)",
    [id, username, passwordHash, now],
  );
  return id;
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
  "date",
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
    date: reminder.date,
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
    "date",
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
