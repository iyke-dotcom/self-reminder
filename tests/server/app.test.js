import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { createDb } from "../../server/db.js";

let db;
let server;
let base;

beforeAll(async () => {
  db = await createDb();
  const app = createApp({ db, secret: "test-secret" });
  server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
}, 60_000);

afterAll(async () => {
  await server?.close();
  await db?.close();
});

async function api(base, path, { method = "GET", body, token } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, data };
}

describe("sync server (PostgreSQL via PGlite)", () => {
  it("rejects weak credentials and registers a user", async () => {
    const weak = await api(base, "/api/register", {
      method: "POST",
      body: { username: "ab", password: "short" },
    });
    expect(weak.status).toBe(400);

    const ok = await api(base, "/api/register", {
      method: "POST",
      body: { username: "alice", password: "correct-horse" },
    });
    expect(ok.status).toBe(201);
    expect(ok.data.token).toBeTruthy();

    const dup = await api(base, "/api/register", {
      method: "POST",
      body: { username: "alice", password: "another-pass" },
    });
    expect(dup.status).toBe(409);
  }, 30_000);

  it("logs in and reports identity", async () => {
    await api(base, "/api/register", {
      method: "POST",
      body: { username: "bob", password: "correct-horse" },
    });
    const bad = await api(base, "/api/login", {
      method: "POST",
      body: { username: "bob", password: "wrong-password" },
    });
    expect(bad.status).toBe(401);

    const login = await api(base, "/api/login", {
      method: "POST",
      body: { username: "bob", password: "correct-horse" },
    });
    expect(login.status).toBe(200);
    expect(login.data.token).toBeTruthy();

    const me = await api(base, "/api/me", { token: login.data.token });
    expect(me.data.username).toBe("bob");

    const denied = await api(base, "/api/me");
    expect(denied.status).toBe(401);
  }, 30_000);

  it("syncs updates, deletes and merges last-write-wins", async () => {
    const reg = await api(base, "/api/register", {
      method: "POST",
      body: { username: "carol", password: "correct-horse" },
    });
    const token = reg.data.token;

    const first = await api(base, "/api/sync", {
      method: "POST",
      body: {
        updates: [
          {
            id: "r1",
            title: "First",
            date: "2026-10-01T09:00:00.000Z",
            priority: "high",
            tags: [],
            recurring: null,
            notified: false,
            done: false,
            updatedAt: 1000,
          },
          {
            id: "r2",
            title: "Second",
            date: "2026-10-02T09:00:00.000Z",
            priority: "low",
            tags: ["work"],
            recurring: { freq: "daily" },
            notified: false,
            done: false,
            updatedAt: 1500,
          },
        ],
        deletes: [],
      },
      token,
    });
    expect(first.status).toBe(200);
    expect(first.data.reminders).toHaveLength(2);

    const stale = await api(base, "/api/sync", {
      method: "POST",
      body: {
        updates: [
          {
            id: "r1",
            title: "Stale overwrite",
            date: "2026-10-01T09:00:00.000Z",
            priority: "high",
            tags: [],
            recurring: null,
            notified: false,
            done: false,
            updatedAt: 500,
          },
        ],
        deletes: [],
      },
      token,
    });
    expect(stale.data.reminders.find((r) => r.id === "r1").title).toBe("First");

    const newer = await api(base, "/api/sync", {
      method: "POST",
      body: {
        updates: [
          {
            id: "r1",
            title: "Fresh",
            date: "2026-10-01T09:00:00.000Z",
            priority: "high",
            tags: [],
            recurring: null,
            notified: false,
            done: false,
            updatedAt: 2000,
          },
        ],
        deletes: [],
      },
      token,
    });
    expect(newer.data.reminders.find((r) => r.id === "r1").title).toBe("Fresh");

    const afterDelete = await api(base, "/api/sync", {
      method: "POST",
      body: { updates: [], deletes: [{ id: "r2", updatedAt: 2500 }] },
      token,
    });
    expect(afterDelete.data.reminders.map((r) => r.id)).toEqual(["r1"]);
    expect(afterDelete.data.tombstones).toEqual([
      { id: "r2", updatedAt: 2500 },
    ]);

    const relisted = await api(base, "/api/reminders", { token });
    expect(relisted.data.reminders.map((r) => r.id)).toEqual(["r1"]);

    const resurrect = await api(base, "/api/sync", {
      method: "POST",
      body: {
        updates: [
          {
            id: "r2",
            title: "Back again",
            date: "2026-10-03T09:00:00.000Z",
            priority: "low",
            tags: [],
            recurring: null,
            notified: false,
            done: false,
            updatedAt: 3000,
          },
        ],
        deletes: [],
      },
      token,
    });
    expect(resurrect.data.reminders.map((r) => r.id).sort()).toEqual([
      "r1",
      "r2",
    ]);
  }, 30_000);
});
