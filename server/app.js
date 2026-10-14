import express from "express";
import {
  MAX_GROUP_MEMBERS,
  RSVP_STATUSES,
  addMember,
  applyDelete,
  applyUpdate,
  countGroupAdmins,
  countMembers,
  createEventNote,
  createGroup,
  createGroupEvent,
  createUser,
  deleteEventNote,
  deleteGroup,
  deleteGroupEvent,
  findGroupByInviteCode,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  getEventNote,
  getGroup,
  getGroupEvent,
  getGroupsFeed,
  getMembership,
  listAllReminders,
  listEventNotes,
  listGroupEvents,
  listMembers,
  listMyGroups,
  listReminders,
  listRsvps,
  listTombstones,
  listUsers,
  refreshInviteCode,
  removeMember,
  rowToUser,
  searchUsers,
  setEventNoteHidden,
  setMemberRole,
  setRsvp,
  summarizeRsvps,
  touchLastSeen,
  updateEventNoteBody,
  updateGroup,
} from "./db.js";
import {
  hashPassword,
  issueToken,
  newUserId,
  verifyPassword,
  verifyToken,
} from "./auth.js";

export const DEFAULT_ORIGINS = "http://localhost:5173,http://localhost:4173";

export function createApp({ db, secret, origins = DEFAULT_ORIGINS }) {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const allowed = String(origins)
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowed.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Vary", "Origin");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // requireAuth: blocks unauthenticated users (401). Loads the fresh user
  // record (including role) so role changes take effect without re-login.
  async function requireAuth(req, res, next) {
    try {
      const header = req.headers.authorization || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : null;
      const payload = token ? verifyToken(token, secret) : null;
      if (!payload) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      const row = await findUserById(db, payload.sub);
      const user = rowToUser(row);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      req.userId = user.id;
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  }

  // Backwards-compatible alias (existing routes use bearerAuth semantics).
  const bearerAuth = requireAuth;

  // requireCustomer: only role === "customer". Logged-in admins get 403
  // (frontend sends them to /admin instead).
  function requireCustomer(req, res, next) {
    if (!req.user || req.user.role !== "customer") {
      res.status(403).json({ error: "Customers only" });
      return;
    }
    next();
  }

  // requireAdmin: only role === "admin". Never reachable from customer UI.
  function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
      res.status(403).json({ error: "Admins only" });
      return;
    }
    next();
  }

  function validateEmail(value) {
    const email = String(value || "")
      .trim()
      .toLowerCase();
    if (
      email.length < 5 ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return null;
    }
    return email;
  }

  // Usernames stay the internal unique handle; when the client only sends an
  // email (the login screen), derive a unique username from it.
  async function deriveUsername(email) {
    const local = email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "")
      .slice(0, 30);
    const base = local.length >= 3 ? local : "user";
    for (let n = 0; n < 100; n += 1) {
      const candidate = n === 0 ? base : `${base}${n + 1}`.slice(0, 40);
      const taken = await findUserByUsername(db, candidate);
      if (!taken) return candidate;
    }
    return `user${Date.now().toString(36)}`;
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, engine: "postgresql" });
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Role is NEVER taken from the client: public registration always
      // creates a customer. Admins are created via the seed script.
      // Email is required; username is optional and derived when omitted.
      const email = validateEmail(req.body?.email);
      if (!email) {
        res.status(400).json({ error: "A valid email address is required" });
        return;
      }
      const password = String(req.body?.password || "");
      if (password.length < 8) {
        res
          .status(400)
          .json({ error: "Password must be at least 8 characters" });
        return;
      }
      const emailTaken = await findUserByEmail(db, email);
      if (emailTaken) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }
      let username = String(req.body?.username || "").trim();
      if (username) {
        if (username.length < 3 || username.length > 40) {
          res.status(400).json({ error: "Username must be 3-40 characters" });
          return;
        }
        if (await findUserByUsername(db, username)) {
          res.status(409).json({ error: "Username already taken" });
          return;
        }
      } else {
        username = await deriveUsername(email);
      }
      const name = String(req.body?.name || "")
        .trim()
        .slice(0, 80);
      const id = await createUser(db, {
        id: newUserId(),
        username,
        passwordHash: hashPassword(password),
        email,
        name,
        role: "customer",
      });
      const user = rowToUser(await findUserById(db, id));
      res.status(201).json({
        token: issueToken(user, secret),
        user,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      // Accepts an email address or a username in either field.
      const login = String(req.body?.email || req.body?.username || "").trim();
      const password = String(req.body?.password || "");
      let row =
        login && login.includes("@")
          ? await findUserByEmail(db, login.toLowerCase())
          : null;
      if (!row && login) row = await findUserByUsername(db, login);
      if (!row || !verifyPassword(password, row.password_hash)) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }
      const user = rowToUser(row);
      res.json({ token: issueToken(user, secret), user });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/me", bearerAuth, async (req, res) => {
    // `username` kept for backwards compatibility with older clients.
    res.json({ username: req.user.username, user: req.user });
  });

  // Customer reminder endpoints: requireAuth already scopes every query to
  // req.userId, and requireCustomer keeps admins on their own /admin routes.
  app.get(
    "/api/customer/reminders",
    bearerAuth,
    requireCustomer,
    async (req, res, next) => {
      try {
        const reminders = await listReminders(db, req.userId);
        const tombstones = await listTombstones(db, req.userId);
        res.json({ reminders, tombstones, serverNow: Date.now() });
      } catch (error) {
        next(error);
      }
    },
  );

  // Admin-only endpoints. Never linked from customer UI.
  app.get(
    "/api/admin/users",
    bearerAuth,
    requireAdmin,
    async (req, res, next) => {
      try {
        res.json({ users: await listUsers(db) });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    "/api/admin/reminders",
    bearerAuth,
    requireAdmin,
    async (req, res, next) => {
      try {
        res.json({ reminders: await listAllReminders(db) });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get("/api/reminders", bearerAuth, async (req, res, next) => {
    try {
      const reminders = await listReminders(db, req.userId);
      const tombstones = await listTombstones(db, req.userId);
      res.json({ reminders, tombstones, serverNow: Date.now() });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sync", bearerAuth, async (req, res, next) => {
    try {
      const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];
      const deletes = Array.isArray(req.body?.deletes) ? req.body.deletes : [];
      for (const reminder of updates) {
        if (!reminder || typeof reminder.id !== "string") continue;
        await applyUpdate(db, req.userId, reminder);
      }
      for (const entry of deletes) {
        if (!entry || typeof entry.id !== "string") continue;
        await applyDelete(db, req.userId, entry);
      }
      const reminders = await listReminders(db, req.userId);
      const tombstones = await listTombstones(db, req.userId);
      res.json({ reminders, tombstones, serverNow: Date.now() });
    } catch (error) {
      next(error);
    }
  });

  // -------------------------------------------------------------------------
  // Groups & shared reminders (customer segment; admins stay on /admin).
  // A member only ever sees groups they belong to (non-members get 404).
  // -------------------------------------------------------------------------

  async function loadGroup(req, res, next) {
    try {
      const group = await getGroup(db, req.params.groupId);
      if (!group) {
        res.status(404).json({ error: "Group not found" });
        return;
      }
      req.group = group;
      req.membership = await getMembership(db, group.id, req.userId);
      next();
    } catch (error) {
      next(error);
    }
  }

  function requireGroupMember(req, res, next) {
    if (!req.membership) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    next();
  }

  function requireGroupAdmin(req, res, next) {
    if (!req.membership) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    if (req.membership.role !== "admin") {
      res.status(403).json({ error: "Group admins only" });
      return;
    }
    next();
  }

  function validIsoDate(value) {
    const time = new Date(String(value || "")).getTime();
    return Number.isNaN(time) ? null : new Date(time).toISOString();
  }

  async function eventDetail(group, eventId, viewerId, isGroupAdmin) {
    const event = await getGroupEvent(db, eventId);
    if (!event || event.groupId !== group.id) return null;
    const rsvps = await listRsvps(db, eventId);
    const notes = await listEventNotes(db, eventId, {
      isGroupAdmin,
      viewerId,
    });
    const mine = rsvps.find((r) => r.userId === viewerId);
    return {
      event,
      summary: summarizeRsvps(rsvps),
      rsvps,
      myRsvp: mine ? mine.status : null,
      notes,
    };
  }

  const groupRoutes = express.Router({ mergeParams: true });
  groupRoutes.use(bearerAuth, requireCustomer, loadGroup);

  groupRoutes.get("/", requireGroupMember, async (req, res, next) => {
    try {
      const [members, events] = await Promise.all([
        listMembers(db, req.group.id),
        listGroupEvents(db, req.group.id),
      ]);
      const detailed = await Promise.all(
        events.map((event) =>
          eventDetail(
            req.group,
            event.id,
            req.userId,
            req.membership.role === "admin",
          ),
        ),
      );
      await touchLastSeen(db, req.group.id, req.userId);
      res.json({
        group: req.group,
        myRole: req.membership.role,
        members,
        events: detailed,
      });
    } catch (error) {
      next(error);
    }
  });

  groupRoutes.patch("/", requireGroupAdmin, async (req, res, next) => {
    try {
      const group = await updateGroup(db, req.group.id, {
        name: req.body?.name,
        description: req.body?.description,
        type: req.body?.type,
        memberEventCreate: req.body?.memberEventCreate,
      });
      res.json({ group });
    } catch (error) {
      next(error);
    }
  });

  groupRoutes.delete("/", requireGroupAdmin, async (req, res, next) => {
    try {
      await deleteGroup(db, req.group.id);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  groupRoutes.post("/seen", requireGroupMember, async (req, res, next) => {
    try {
      await touchLastSeen(db, req.group.id, req.userId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  groupRoutes.post("/leave", requireGroupMember, async (req, res, next) => {
    try {
      if (req.membership.role === "admin") {
        const admins = await countGroupAdmins(db, req.group.id);
        if (admins <= 1) {
          res.status(400).json({
            error: "Promote another admin first, or delete the group.",
          });
          return;
        }
      }
      await removeMember(db, req.group.id, req.userId);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  groupRoutes.post(
    "/invite/refresh",
    requireGroupAdmin,
    async (req, res, next) => {
      try {
        const group = await refreshInviteCode(db, req.group.id);
        res.json({ group });
      } catch (error) {
        next(error);
      }
    },
  );

  groupRoutes.get("/members", requireGroupMember, async (req, res, next) => {
    try {
      res.json({ members: await listMembers(db, req.group.id) });
    } catch (error) {
      next(error);
    }
  });

  // Direct add from username/email search results (any member can invite).
  groupRoutes.post("/members", requireGroupMember, async (req, res, next) => {
    try {
      const userId = String(req.body?.userId || "");
      const target = userId ? await findUserById(db, userId) : null;
      if (!target) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const existing = await getMembership(db, req.group.id, userId);
      if (existing) {
        res.json({ ok: true, alreadyMember: true });
        return;
      }
      if ((await countMembers(db, req.group.id)) >= MAX_GROUP_MEMBERS) {
        res.status(400).json({
          error: `Group is full (max ${MAX_GROUP_MEMBERS} members)`,
        });
        return;
      }
      await addMember(db, { groupId: req.group.id, userId });
      res.status(201).json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  groupRoutes.post(
    "/members/:userId/promote",
    requireGroupAdmin,
    async (req, res, next) => {
      try {
        const target = await getMembership(db, req.group.id, req.params.userId);
        if (!target) {
          res.status(404).json({ error: "Member not found" });
          return;
        }
        await setMemberRole(db, req.group.id, req.params.userId, "admin");
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  groupRoutes.delete(
    "/members/:userId",
    requireGroupAdmin,
    async (req, res, next) => {
      try {
        const target = await getMembership(db, req.group.id, req.params.userId);
        if (!target) {
          res.status(404).json({ error: "Member not found" });
          return;
        }
        if (target.role === "admin") {
          const admins = await countGroupAdmins(db, req.group.id);
          if (admins <= 1) {
            res.status(400).json({ error: "Cannot remove the last admin." });
            return;
          }
        }
        await removeMember(db, req.group.id, req.params.userId);
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  function canCreateEvent(group, membership) {
    // Default decision (spec leaves it to us): every member can create
    // events unless the group admin restricted it to admins only.
    return (
      group.memberEventCreate || (membership && membership.role === "admin")
    );
  }

  groupRoutes.get("/events", requireGroupMember, async (req, res, next) => {
    try {
      const events = await listGroupEvents(db, req.group.id);
      const detailed = await Promise.all(
        events.map((event) =>
          eventDetail(
            req.group,
            event.id,
            req.userId,
            req.membership.role === "admin",
          ),
        ),
      );
      res.json({ events: detailed });
    } catch (error) {
      next(error);
    }
  });

  groupRoutes.post("/events", requireGroupMember, async (req, res, next) => {
    try {
      if (!canCreateEvent(req.group, req.membership)) {
        res.status(403).json({ error: "Only group admins can create events" });
        return;
      }
      const title = String(req.body?.title || "").trim();
      if (!title) {
        res.status(400).json({ error: "Title is required" });
        return;
      }
      const date = validIsoDate(req.body?.date);
      if (!date) {
        res.status(400).json({ error: "A valid date is required" });
        return;
      }
      const id = await createGroupEvent(db, {
        groupId: req.group.id,
        title: title.slice(0, 200),
        description: String(req.body?.description || "").slice(0, 2000),
        location: String(req.body?.location || "").slice(0, 200),
        date,
        reminderOffsets: req.body?.reminderOffsets,
        recurring: req.body?.recurring ?? null,
        createdBy: req.userId,
      });
      const detail = await eventDetail(
        req.group,
        id,
        req.userId,
        req.membership.role === "admin",
      );
      res.status(201).json(detail);
    } catch (error) {
      next(error);
    }
  });

  groupRoutes.get(
    "/events/:eventId",
    requireGroupMember,
    async (req, res, next) => {
      try {
        const detail = await eventDetail(
          req.group,
          req.params.eventId,
          req.userId,
          req.membership.role === "admin",
        );
        if (!detail) {
          res.status(404).json({ error: "Event not found" });
          return;
        }
        res.json(detail);
      } catch (error) {
        next(error);
      }
    },
  );

  groupRoutes.delete(
    "/events/:eventId",
    requireGroupMember,
    async (req, res, next) => {
      try {
        const event = await getGroupEvent(db, req.params.eventId);
        if (!event || event.groupId !== req.group.id) {
          res.status(404).json({ error: "Event not found" });
          return;
        }
        const isGroupAdmin = req.membership.role === "admin";
        if (!isGroupAdmin && event.createdBy !== req.userId) {
          res
            .status(403)
            .json({ error: "Only the creator or a group admin can delete" });
          return;
        }
        await deleteGroupEvent(db, event.id);
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  groupRoutes.post(
    "/events/:eventId/rsvp",
    requireGroupMember,
    async (req, res, next) => {
      try {
        const event = await getGroupEvent(db, req.params.eventId);
        if (!event || event.groupId !== req.group.id) {
          res.status(404).json({ error: "Event not found" });
          return;
        }
        const status = String(req.body?.status || "");
        if (!RSVP_STATUSES.includes(status)) {
          res.status(400).json({
            error: `Status must be one of: ${RSVP_STATUSES.join(", ")}`,
          });
          return;
        }
        await setRsvp(db, {
          eventId: event.id,
          userId: req.userId,
          status,
        });
        const detail = await eventDetail(
          req.group,
          event.id,
          req.userId,
          req.membership.role === "admin",
        );
        res.json(detail);
      } catch (error) {
        next(error);
      }
    },
  );

  groupRoutes.post(
    "/events/:eventId/notes",
    requireGroupMember,
    async (req, res, next) => {
      try {
        const event = await getGroupEvent(db, req.params.eventId);
        if (!event || event.groupId !== req.group.id) {
          res.status(404).json({ error: "Event not found" });
          return;
        }
        const body = String(req.body?.body || "").trim();
        if (!body) {
          res.status(400).json({ error: "Note text is required" });
          return;
        }
        const id = await createEventNote(db, {
          eventId: event.id,
          userId: req.userId,
          body: body.slice(0, 2000),
          privateToAdmins: Boolean(req.body?.privateToAdmins),
        });
        const detail = await eventDetail(
          req.group,
          event.id,
          req.userId,
          req.membership.role === "admin",
        );
        res.status(201).json({ ...detail, noteId: id });
      } catch (error) {
        next(error);
      }
    },
  );

  groupRoutes.patch(
    "/events/:eventId/notes/:noteId",
    requireGroupMember,
    async (req, res, next) => {
      try {
        const note = await getEventNote(db, req.params.noteId);
        if (!note || note.eventId !== req.params.eventId) {
          res.status(404).json({ error: "Note not found" });
          return;
        }
        if (note.userId !== req.userId) {
          res.status(403).json({ error: "Only the author can edit" });
          return;
        }
        const body = String(req.body?.body || "").trim();
        if (!body) {
          res.status(400).json({ error: "Note text is required" });
          return;
        }
        await updateEventNoteBody(db, note.id, body.slice(0, 2000));
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  groupRoutes.delete(
    "/events/:eventId/notes/:noteId",
    requireGroupMember,
    async (req, res, next) => {
      try {
        const note = await getEventNote(db, req.params.noteId);
        if (!note || note.eventId !== req.params.eventId) {
          res.status(404).json({ error: "Note not found" });
          return;
        }
        const isGroupAdmin = req.membership.role === "admin";
        if (note.userId === req.userId) {
          await deleteEventNote(db, note.id);
          res.json({ ok: true, removed: true });
          return;
        }
        if (isGroupAdmin) {
          // Soft-hide so it stays recoverable.
          await setEventNoteHidden(db, note.id, true);
          res.json({ ok: true, hidden: true });
          return;
        }
        res.status(403).json({ error: "Only the author can delete" });
      } catch (error) {
        next(error);
      }
    },
  );

  groupRoutes.post(
    "/events/:eventId/notes/:noteId/unhide",
    requireGroupAdmin,
    async (req, res, next) => {
      try {
        const note = await getEventNote(db, req.params.noteId);
        if (!note || note.eventId !== req.params.eventId) {
          res.status(404).json({ error: "Note not found" });
          return;
        }
        await setEventNoteHidden(db, note.id, false);
        res.json({ ok: true });
      } catch (error) {
        next(error);
      }
    },
  );

  // NOTE: the :groupId router is mounted AFTER the specific /api/groups/*
  // routes below — otherwise "join"/"feed" would match :groupId first.
  const mountGroupRoutes = () => app.use("/api/groups/:groupId", groupRoutes);

  app.get(
    "/api/groups",
    bearerAuth,
    requireCustomer,
    async (req, res, next) => {
      try {
        res.json({ groups: await listMyGroups(db, req.userId) });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/groups",
    bearerAuth,
    requireCustomer,
    async (req, res, next) => {
      try {
        const name = String(req.body?.name || "").trim();
        if (!name) {
          res.status(400).json({ error: "Group name is required" });
          return;
        }
        const id = await createGroup(db, {
          name: name.slice(0, 120),
          description: String(req.body?.description || "").slice(0, 2000),
          type: req.body?.type,
          createdBy: req.userId,
        });
        await addMember(db, { groupId: id, userId: req.userId, role: "admin" });
        res.status(201).json({ group: await getGroup(db, id) });
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    "/api/groups/feed",
    bearerAuth,
    requireCustomer,
    async (req, res, next) => {
      try {
        res.json(await getGroupsFeed(db, req.userId));
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/api/groups/join",
    bearerAuth,
    requireCustomer,
    async (req, res, next) => {
      try {
        const code = String(req.body?.code || "").trim();
        const group = code ? await findGroupByInviteCode(db, code) : null;
        if (!group) {
          res.status(404).json({ error: "Invalid invite code" });
          return;
        }
        if (group.inviteExpiresAt <= Date.now()) {
          res.status(410).json({ error: "Invite code expired" });
          return;
        }
        const existing = await getMembership(db, group.id, req.userId);
        if (existing) {
          res.json({ group, alreadyMember: true });
          return;
        }
        if ((await countMembers(db, group.id)) >= MAX_GROUP_MEMBERS) {
          res.status(400).json({
            error: `Group is full (max ${MAX_GROUP_MEMBERS} members)`,
          });
          return;
        }
        await addMember(db, { groupId: group.id, userId: req.userId });
        res.json({ group });
      } catch (error) {
        next(error);
      }
    },
  );

  mountGroupRoutes();

  // Shareable invite preview (public: name/type/count only, never members).
  app.get("/api/invites/:code", async (req, res, next) => {
    try {
      const group = await findGroupByInviteCode(db, req.params.code);
      if (!group || group.inviteExpiresAt <= Date.now()) {
        res.status(404).json({ error: "Invalid or expired invite" });
        return;
      }
      res.json({
        invite: {
          name: group.name,
          type: group.type,
          memberCount: await countMembers(db, group.id),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get(
    "/api/users/search",
    bearerAuth,
    requireCustomer,
    async (req, res, next) => {
      try {
        const q = String(req.query?.q || "").trim();
        if (q.length < 2) {
          res.json({ users: [] });
          return;
        }
        res.json({ users: await searchUsers(db, q, req.userId) });
      } catch (error) {
        next(error);
      }
    },
  );

  app.use((error, _req, res, _next) => {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
