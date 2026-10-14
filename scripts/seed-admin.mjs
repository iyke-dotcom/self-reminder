// Seeds (or promotes) an admin account for the Self Reminder sync server.
// Usage:
//   ADMIN_USERNAME=admin ADMIN_PASSWORD='a-long-secret' npm run seed:admin
// Optional: ADMIN_EMAIL, ADMIN_NAME, DATA_DIR, JWT_SECRET (JWT_SECRET is not
// needed here but accepted for a uniform env file).
import "dotenv/config";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  createDb,
  createUser,
  findUserByUsername,
  setUserRole,
} from "../server/db.js";
import { hashPassword, newUserId } from "../server/auth.js";

const username = String(process.env.ADMIN_USERNAME || "admin").trim();
const password = String(process.env.ADMIN_PASSWORD || "");
const email = String(process.env.ADMIN_EMAIL || "").trim() || null;
const name = String(process.env.ADMIN_NAME || "Administrator").trim();

if (username.length < 3 || username.length > 40) {
  console.error("ADMIN_USERNAME must be 3-40 characters.");
  process.exit(1);
}
if (password.length < 8) {
  console.error(
    "Refusing to seed: set ADMIN_PASSWORD to at least 8 characters.",
  );
  process.exit(1);
}

const dataDir = process.env.DATA_DIR || "server/.pgdata";
mkdirSync(resolve(dataDir), { recursive: true });
const db = await createDb(resolve(dataDir));

const existing = await findUserByUsername(db, username);
if (existing) {
  await setUserRole(db, existing.id, "admin");
  console.log(`Promoted existing user "${username}" to admin.`);
} else {
  await createUser(db, {
    id: newUserId(),
    username,
    passwordHash: hashPassword(password),
    email,
    name,
    role: "admin",
  });
  console.log(`Created admin user "${username}".`);
}
await db.close?.();
