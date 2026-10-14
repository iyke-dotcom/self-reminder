import express from "express";
import {
  applyDelete,
  applyUpdate,
  createUser,
  findUserByEmail,
  findUserById,
  findUserByUsername,
  listAllReminders,
  listReminders,
  listTombstones,
  listUsers,
  rowToUser,
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

  function validateCredentials(req, res) {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (username.length < 3 || username.length > 40) {
      res.status(400).json({ error: "Username must be 3-40 characters" });
      return null;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return null;
    }
    return { username, password };
  }

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, engine: "postgresql" });
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const credentials = validateCredentials(req, res);
      if (!credentials) return;
      // Role is NEVER taken from the client: public registration always
      // creates a customer. Admins are created via the seed script.
      const email = String(req.body?.email || "").trim() || null;
      const name = String(req.body?.name || "")
        .trim()
        .slice(0, 80);
      const existing = await findUserByUsername(db, credentials.username);
      if (existing) {
        res.status(409).json({ error: "Username already taken" });
        return;
      }
      if (email) {
        const emailTaken = await findUserByEmail(db, email);
        if (emailTaken) {
          res.status(409).json({ error: "Email already registered" });
          return;
        }
      }
      const id = await createUser(db, {
        id: newUserId(),
        username: credentials.username,
        passwordHash: hashPassword(credentials.password),
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
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");
      const row = await findUserByUsername(db, username);
      if (!row || !verifyPassword(password, row.password_hash)) {
        res.status(401).json({ error: "Invalid username or password" });
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

  app.use((error, _req, res, _next) => {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
