import express from "express";
import {
  applyDelete,
  applyUpdate,
  createUser,
  findUserById,
  findUserByUsername,
  listReminders,
  listTombstones,
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

  function bearerAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const payload = token ? verifyToken(token, secret) : null;
    if (!payload) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.userId = payload.sub;
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
      const existing = await findUserByUsername(db, credentials.username);
      if (existing) {
        res.status(409).json({ error: "Username already taken" });
        return;
      }
      const id = await createUser(db, {
        id: newUserId(),
        username: credentials.username,
        passwordHash: hashPassword(credentials.password),
      });
      res.status(201).json({
        token: issueToken({ id, username: credentials.username }, secret),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    try {
      const username = String(req.body?.username || "").trim();
      const password = String(req.body?.password || "");
      const user = await findUserByUsername(db, username);
      if (!user || !verifyPassword(password, user.password_hash)) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }
      res.json({ token: issueToken(user, secret) });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/me", bearerAuth, async (req, res) => {
    const user = await findUserById(db, req.userId);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    res.json({ username: user.username });
  });

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
