import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../server/app.js";
import { addMember, createDb, createUser } from "../../server/db.js";
import { hashPassword, newUserId } from "../../server/auth.js";

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

  it("registers customers and never trusts client-supplied roles", async () => {
    const reg = await api(base, "/api/register", {
      method: "POST",
      body: {
        username: "dave",
        password: "correct-horse",
        email: "dave@example.com",
        name: "Dave",
        role: "admin",
      },
    });
    expect(reg.status).toBe(201);
    expect(reg.data.user.role).toBe("customer");

    const me = await api(base, "/api/me", { token: reg.data.token });
    expect(me.data.user).toMatchObject({
      username: "dave",
      email: "dave@example.com",
      name: "Dave",
      role: "customer",
    });

    const dupEmail = await api(base, "/api/register", {
      method: "POST",
      body: {
        username: "dave2",
        password: "correct-horse",
        email: "dave@example.com",
      },
    });
    expect(dupEmail.status).toBe(409);
  }, 30_000);

  it("enforces customer/admin guards and per-user isolation", async () => {
    await createUser(db, {
      id: newUserId(),
      username: "root",
      passwordHash: hashPassword("correct-horse"),
      role: "admin",
    });
    const adminLogin = await api(base, "/api/login", {
      method: "POST",
      body: { username: "root", password: "correct-horse" },
    });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.data.token;

    const custReg = await api(base, "/api/register", {
      method: "POST",
      body: { username: "erin", password: "correct-horse" },
    });
    const custToken = custReg.data.token;

    // Customer routes
    const custOk = await api(base, "/api/customer/reminders", {
      token: custToken,
    });
    expect(custOk.status).toBe(200);
    const adminOnCustomer = await api(base, "/api/customer/reminders", {
      token: adminToken,
    });
    expect(adminOnCustomer.status).toBe(403);
    const anonOnCustomer = await api(base, "/api/customer/reminders");
    expect(anonOnCustomer.status).toBe(401);

    // Admin routes
    const custOnAdmin = await api(base, "/api/admin/users", {
      token: custToken,
    });
    expect(custOnAdmin.status).toBe(403);
    const adminOk = await api(base, "/api/admin/users", {
      token: adminToken,
    });
    expect(adminOk.status).toBe(200);
    expect(adminOk.data.users.map((u) => u.username)).toContain("root");
    expect(adminOk.data.users.find((u) => u.username === "root").role).toBe(
      "admin",
    );
    expect(adminOk.data.users.every((u) => u.password_hash === undefined)).toBe(
      true,
    );

    // Per-user isolation: erin's reminder invisible to others
    await api(base, "/api/sync", {
      method: "POST",
      body: {
        updates: [
          {
            id: "erin-only",
            title: "Erin private",
            date: "2026-11-01T09:00:00.000Z",
            priority: "medium",
            tags: [],
            recurring: null,
            notified: false,
            done: false,
            updatedAt: 5000,
          },
        ],
        deletes: [],
      },
      token: custToken,
    });
    const adminView = await api(base, "/api/admin/reminders", {
      token: adminToken,
    });
    expect(adminView.data.reminders.map((r) => r.id)).toContain("erin-only");
    const otherReg = await api(base, "/api/register", {
      method: "POST",
      body: { username: "frank", password: "correct-horse" },
    });
    const otherView = await api(base, "/api/reminders", {
      token: otherReg.data.token,
    });
    expect(otherView.data.reminders.map((r) => r.id)).not.toContain(
      "erin-only",
    );
  }, 30_000);
});

describe("groups & shared events", () => {
  let gdb;
  let gserver;
  let gbase;

  beforeAll(async () => {
    gdb = await createDb();
    const app = createApp({ db: gdb, secret: "group-test-secret" });
    gserver = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    gbase = `http://127.0.0.1:${gserver.address().port}`;
  }, 60_000);

  afterAll(async () => {
    await gserver?.close();
    await gdb?.close();
  });

  async function user(name) {
    const reg = await api(gbase, "/api/register", {
      method: "POST",
      body: { username: name, password: "correct-horse" },
    });
    expect(reg.status).toBe(201);
    return { name, token: reg.data.token };
  }

  it("creates a group with the creator as admin and an invite code", async () => {
    const alice = await user("galice");
    const created = await api(gbase, "/api/groups", {
      method: "POST",
      body: { name: "Study Crew", type: "study" },
      token: alice.token,
    });
    expect(created.status).toBe(201);
    expect(created.data.group.inviteCode).toBeTruthy();
    expect(created.data.group.type).toBe("study");

    const detail = await api(gbase, `/api/groups/${created.data.group.id}`, {
      token: alice.token,
    });
    expect(detail.status).toBe(200);
    expect(detail.data.myRole).toBe("admin");
    expect(detail.data.members.map((m) => m.username)).toEqual(["galice"]);
  }, 30_000);

  it("joins via invite code and hides groups from strangers", async () => {
    const a = await user("gali2");
    const b = await user("gbob2");
    const created = await api(gbase, "/api/groups", {
      method: "POST",
      body: { name: "Pair", type: "pair" },
      token: a.token,
    });
    const group = created.data.group;

    const preview = await api(gbase, `/api/invites/${group.inviteCode}`);
    expect(preview.status).toBe(200);
    expect(preview.data.invite.name).toBe("Pair");

    const bad = await api(gbase, "/api/groups/join", {
      method: "POST",
      body: { code: "nope-nope" },
      token: b.token,
    });
    expect(bad.status).toBe(404);

    const joined = await api(gbase, "/api/groups/join", {
      method: "POST",
      body: { code: group.inviteCode },
      token: b.token,
    });
    expect(joined.status).toBe(200);

    const stranger = await user("gmallory");
    const peek = await api(gbase, `/api/groups/${group.id}`, {
      token: stranger.token,
    });
    expect(peek.status).toBe(404);
  }, 30_000);

  it("adds members directly from username search", async () => {
    const adder = await user("gadder");
    const added = await user("gadded");
    const created = await api(gbase, "/api/groups", {
      method: "POST",
      body: { name: "Search adds" },
      token: adder.token,
    });
    const gid = created.data.group.id;
    const found = await api(gbase, "/api/users/search?q=gadded", {
      token: adder.token,
    });
    expect(found.data.users.map((u) => u.username)).toContain("gadded");
    expect(found.data.users.every((u) => u.password_hash === undefined)).toBe(
      true,
    );
    const target = found.data.users.find((u) => u.username === "gadded");
    const res = await api(gbase, `/api/groups/${gid}/members`, {
      method: "POST",
      body: { userId: target.id },
      token: adder.token,
    });
    expect(res.status).toBe(201);
    const detail = await api(gbase, `/api/groups/${gid}`, {
      token: added.token,
    });
    expect(detail.status).toBe(200);
  }, 30_000);

  it("enforces the 50-member cap with a clear message", async () => {
    const owner = await user("gowner");
    const created = await api(gbase, "/api/groups", {
      method: "POST",
      body: { name: "Big Fam" },
      token: owner.token,
    });
    const group = created.data.group;
    // owner + 49 direct inserts = 50 members
    for (let i = 0; i < 49; i += 1) {
      const id = newUserId();
      await createUser(gdb, {
        id,
        username: `fill${i}`,
        passwordHash: hashPassword("correct-horse"),
      });
      await addMember(gdb, { groupId: group.id, userId: id });
    }
    const extra = await user("gextra");
    const over = await api(gbase, "/api/groups/join", {
      method: "POST",
      body: { code: group.inviteCode },
      token: extra.token,
    });
    expect(over.status).toBe(400);
    expect(over.data.error).toMatch(/max 50 members/);
  }, 30_000);

  it("runs the pair flow: shared event, RSVPs, opt-out note", async () => {
    const ann = await user("gann");
    const ben = await user("gben");
    const created = await api(gbase, "/api/groups", {
      method: "POST",
      body: { name: "Dentist run", type: "medical" },
      token: ann.token,
    });
    const gid = created.data.group.id;
    await api(gbase, "/api/groups/join", {
      method: "POST",
      body: { code: created.data.group.inviteCode },
      token: ben.token,
    });

    const event = await api(gbase, `/api/groups/${gid}/events`, {
      method: "POST",
      body: {
        title: "Checkup",
        date: "2030-05-01T09:00:00.000Z",
        location: "Clinic",
        reminderOffsets: [1440, 60],
      },
      token: ann.token,
    });
    expect(event.status).toBe(201);
    const eid = event.data.event.id;

    await api(gbase, `/api/groups/${gid}/events/${eid}/rsvp`, {
      method: "POST",
      body: { status: "going" },
      token: ann.token,
    });
    const benRsvp = await api(gbase, `/api/groups/${gid}/events/${eid}/rsvp`, {
      method: "POST",
      body: { status: "declined" },
      token: ben.token,
    });
    expect(benRsvp.data.summary).toEqual({ going: 1, maybe: 0, declined: 1 });
    expect(benRsvp.data.myRsvp).toBe("declined");

    const note = await api(gbase, `/api/groups/${gid}/events/${eid}/notes`, {
      method: "POST",
      body: { body: "Down with flu, will reschedule." },
      token: ben.token,
    });
    expect(note.status).toBe(201);

    // the other member sees the note with the author attached
    const annView = await api(gbase, `/api/groups/${gid}/events/${eid}`, {
      token: ann.token,
    });
    expect(annView.data.notes.map((n) => `${n.author}: ${n.body}`)).toContain(
      "gben: Down with flu, will reschedule.",
    );

    // feed: ben opted out but the event is still listed for him
    const feed = await api(gbase, "/api/groups/feed", { token: ben.token });
    expect(feed.data.upcoming.map((e) => e.id)).toContain(eid);
  }, 30_000);

  it("restricts admin actions and honors private/hidden notes", async () => {
    const amy = await user("gamy");
    const zed = await user("gzed");
    const created = await api(gbase, "/api/groups", {
      method: "POST",
      body: { name: "Team", type: "corporate" },
      token: amy.token,
    });
    const gid = created.data.group.id;
    await api(gbase, "/api/groups/join", {
      method: "POST",
      body: { code: created.data.group.inviteCode },
      token: zed.token,
    });

    // member cannot rename / remove / promote
    const rename = await api(gbase, `/api/groups/${gid}`, {
      method: "PATCH",
      body: { name: "Hijacked" },
      token: zed.token,
    });
    expect(rename.status).toBe(403);

    // admin-only event creation setting
    await api(gbase, `/api/groups/${gid}`, {
      method: "PATCH",
      body: { memberEventCreate: false },
      token: amy.token,
    });
    const blocked = await api(gbase, `/api/groups/${gid}/events`, {
      method: "POST",
      body: { title: "Sneaky", date: "2030-06-01T09:00:00.000Z" },
      token: zed.token,
    });
    expect(blocked.status).toBe(403);
    const allowed = await api(gbase, `/api/groups/${gid}/events`, {
      method: "POST",
      body: { title: "Standup", date: "2030-06-01T09:00:00.000Z" },
      token: amy.token,
    });
    expect(allowed.status).toBe(201);
    const eid = allowed.data.event.id;

    // private note: visible to admin, invisible to the other member
    await api(gbase, `/api/groups/${gid}/events/${eid}/notes`, {
      method: "POST",
      body: { body: "Budget talk first", privateToAdmins: true },
      token: amy.token,
    });
    const zedView = await api(gbase, `/api/groups/${gid}/events/${eid}`, {
      token: zed.token,
    });
    expect(zedView.data.notes).toHaveLength(0);
    const amyView = await api(gbase, `/api/groups/${gid}/events/${eid}`, {
      token: amy.token,
    });
    expect(amyView.data.notes).toHaveLength(1);

    // member note: stranger to the authorship cannot delete; admin hides
    const pub = await api(gbase, `/api/groups/${gid}/events/${eid}/notes`, {
      method: "POST",
      body: { body: "Running 10 minutes late" },
      token: zed.token,
    });
    const noteId = pub.data.noteId;
    const amyDelete = await api(
      gbase,
      `/api/groups/${gid}/events/${eid}/notes/${noteId}`,
      {
        method: "DELETE",
        token: amy.token,
      },
    );
    expect(amyDelete.data.hidden).toBe(true);
    const afterHide = await api(gbase, `/api/groups/${gid}/events/${eid}`, {
      token: zed.token,
    });
    expect(afterHide.data.notes.map((n) => n.id)).not.toContain(noteId);
    // ...but the admin can still see + recover it
    const adminSees = await api(gbase, `/api/groups/${gid}/events/${eid}`, {
      token: amy.token,
    });
    expect(adminSees.data.notes.map((n) => n.id)).toContain(noteId);
    const unhide = await api(
      gbase,
      `/api/groups/${gid}/events/${eid}/notes/${noteId}/unhide`,
      { method: "POST", token: amy.token },
    );
    expect(unhide.status).toBe(200);

    // promote flow: zed becomes admin and can rename afterwards
    const members = await api(gbase, `/api/groups/${gid}/members`, {
      token: amy.token,
    });
    const zedId = members.data.members.find(
      (m) => m.username === "gzed",
    ).userId;
    const promote = await api(
      gbase,
      `/api/groups/${gid}/members/${zedId}/promote`,
      { method: "POST", token: amy.token },
    );
    expect(promote.status).toBe(200);
    const renamed = await api(gbase, `/api/groups/${gid}`, {
      method: "PATCH",
      body: { name: "Team Renamed" },
      token: zed.token,
    });
    expect(renamed.status).toBe(200);

    // remove flow + last-admin guard: amy (admin) removes... first amy
    // leaves while zed is admin (allowed), tested on a fresh group below
    const removed = await api(gbase, `/api/groups/${gid}/members/${zedId}`, {
      method: "DELETE",
      token: amy.token,
    });
    expect(removed.status).toBe(200);

    // last admin cannot leave or be removed
    const solo = await user("gsolo");
    const soloGroup = await api(gbase, "/api/groups", {
      method: "POST",
      body: { name: "Solo" },
      token: solo.token,
    });
    const sgid = soloGroup.data.group.id;
    const lastLeave = await api(gbase, `/api/groups/${sgid}/leave`, {
      method: "POST",
      token: solo.token,
    });
    expect(lastLeave.status).toBe(400);
  }, 30_000);
});
