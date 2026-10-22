import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "./database.js";

export const SESSION_COOKIE = "chat_session";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
const DUMMY_PASSWORD_HASH = bcrypt.hash(randomBytes(32).toString("hex"), BCRYPT_ROUNDS);

export function normalizeUsername(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function validateUsername(value) {
  const username = normalizeUsername(value);
  return /^[a-z0-9][a-z0-9_.-]{2,23}$/.test(username)
    ? null
    : "Username must be 3–24 characters and use letters, numbers, dots, underscores, or hyphens.";
}

export function validatePassword(value) {
  if (typeof value !== "string") return "Password is required.";
  const bytes = Buffer.byteLength(value, "utf8");
  if (value.length < 10 || bytes > 72) {
    return "Password must be at least 10 characters and no more than 72 UTF-8 bytes.";
  }
  return null;
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenFromCookieHeader(cookieHeader = "") {
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");
    if (separator < 0 || entry.slice(0, separator).trim() !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(entry.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export async function getSession(token) {
  if (typeof token !== "string" || token.length < 40 || token.length > 100) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      csrfToken: true,
      userId: true,
      expiresAt: true,
      user: { select: { id: true, username: true } },
    },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session;
}

export async function createSession(userId, database = prisma) {
  const token = randomBytes(32).toString("base64url");
  const csrfToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const session = await database.session.create({
    data: {
      tokenHash: hashToken(token),
      csrfToken,
      userId,
      expiresAt,
    },
    select: { id: true, user: { select: { id: true, username: true } } },
  });
  return { ...session, token, csrfToken, expiresAt };
}

export async function verifyPassword(password, passwordHash) {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 72) return false;
  const hash = passwordHash ?? await DUMMY_PASSWORD_HASH;
  return bcrypt.compare(password, hash);
}

export function csrfTokenMatches(expected, supplied) {
  if (typeof expected !== "string" || typeof supplied !== "string") return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes);
}
