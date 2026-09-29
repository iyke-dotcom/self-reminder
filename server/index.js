import "dotenv/config";
import { mkdirSync } from "node:fs";
import { createApp } from "./app.js";
import { createDb } from "./db.js";

const port = Number(process.env.PORT) || 3000;
const dataDir = process.env.DATA_DIR || ".pgdata";
const secret = process.env.JWT_SECRET || "dev-only-secret-change-me";

if (dataDir === ".") {
  throw new Error("DATA_DIR must point to a writable directory (use .pgdata)");
}
if (!secret) {
  throw new Error("JWT_SECRET must be set");
}

mkdirSync(dataDir, { recursive: true });
const db = await createDb(dataDir);
const app = createApp({ db, secret });

app.listen(port, () => {
  console.log(
    `Self Reminder sync server listening on http://localhost:${port}`,
  );
  console.log(`Database engine: PostgreSQL (PGlite) at ${dataDir}`);
});
