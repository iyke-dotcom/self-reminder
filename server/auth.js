import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  randomUUID,
} from "node:crypto";

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(":");
  const candidate = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(
    Buffer.from(hash, "hex"),
    Buffer.from(candidate, "hex"),
  );
}

const b64url = (value) => Buffer.from(value).toString("base64url");
const b64urlDecode = (value) => Buffer.from(value, "base64url").toString();

export function signToken(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token, secret) {
  try {
    const [header, body, signature] = String(token).split(".");
    if (!header || !body || !signature) return null;
    const expected = createHmac("sha256", secret)
      .update(`${header}.${body}`)
      .digest("base64url");
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      return null;
    const payload = JSON.parse(b64urlDecode(body));
    if (typeof payload.sub !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}

export function issueToken(user, secret) {
  return signToken({ sub: user.id, username: user.username }, secret);
}

export function newUserId() {
  return randomUUID();
}
