import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";

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
`;

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
