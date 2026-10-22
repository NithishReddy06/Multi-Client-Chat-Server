import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { config } from "../config/env.js";
import { prisma } from "../services/database.js";
import {
  createSession,
  normalizeUsername,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "../services/auth.service.js";

function setSessionCookie(response, token) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

function clearSessionCookie(response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: config.secureCookies,
    sameSite: "lax",
    path: "/",
  });
}

function validBody(body) {
  return body !== null && typeof body === "object" && !Array.isArray(body);
}

function logAuthFailure(operation, error) {
  console.error(`${operation} failed:`, error?.code ?? error?.name ?? "unknown");
}

export async function register(request, response) {
  if (!validBody(request.body)) {
    response.status(400).json({ error: "Invalid request body.", code: "INVALID_REQUEST" });
    return;
  }
  const username = normalizeUsername(request.body.username);
  const usernameError = validateUsername(username);
  const passwordError = validatePassword(request.body.password);
  if (usernameError || passwordError) {
    response.status(400).json({
      error: usernameError ?? passwordError,
      code: usernameError ? "INVALID_USERNAME" : "INVALID_PASSWORD",
    });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(request.body.password, 12);
    const session = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: { username, passwordHash },
        select: { id: true, username: true },
      });
      const room = await transaction.room.upsert({
        where: { roomName: "general" },
        create: { roomName: "general" },
        update: {},
        select: { id: true },
      });
      await transaction.roomMembership.create({
        data: { userId: createdUser.id, roomId: room.id },
      });
      return createSession(createdUser.id, transaction);
    });
    setSessionCookie(response, session.token);
    response.status(201).json({
      user: session.user,
      csrfToken: session.csrfToken,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      response.status(409).json({ error: "That username is already taken.", code: "USERNAME_TAKEN" });
      return;
    }
    logAuthFailure("Registration", error);
    response.status(503).json({ error: "Registration is temporarily unavailable." });
  }
}

export async function login(request, response) {
  if (!validBody(request.body) || typeof request.body.username !== "string" ||
      typeof request.body.password !== "string") {
    response.status(400).json({ error: "Username and password are required.", code: "INVALID_REQUEST" });
    return;
  }
  if (validateUsername(request.body.username) || validatePassword(request.body.password)) {
    response.status(400).json({
      error: "Username or password format is invalid.",
      code: "INVALID_CREDENTIAL_FORMAT",
    });
    return;
  }

  try {
    const username = normalizeUsername(request.body.username);
    const user = /^[a-z0-9][a-z0-9_.-]{2,23}$/.test(username)
      ? await prisma.user.findUnique({
          where: { username },
          select: { id: true, username: true, passwordHash: true },
        })
      : null;
    const passwordMatches = await verifyPassword(request.body.password, user?.passwordHash);
    if (!user || !passwordMatches) {
      response.status(401).json({ error: "Invalid username or password.", code: "INVALID_CREDENTIALS" });
      return;
    }

    const session = await createSession(user.id);
    setSessionCookie(response, session.token);
    response.status(200).json({
      user: session.user,
      csrfToken: session.csrfToken,
    });
  } catch (error) {
    logAuthFailure("Login", error);
    response.status(503).json({ error: "Login is temporarily unavailable." });
  }
}

export function getCurrentSession(request, response) {
  if (!request.auth) {
    clearSessionCookie(response);
    response.status(200).json({ authenticated: false });
    return;
  }
  response.status(200).json({
    authenticated: true,
    user: request.auth.user,
    csrfToken: request.auth.csrfToken,
  });
}

export async function logout(request, response) {
  try {
    await prisma.session.delete({ where: { id: request.auth.id } });
    const sockets = await request.app.locals.io.fetchSockets();
    for (const socket of sockets) {
      if (socket.data.sessionId === request.auth.id) {
        socket.emit("auth_expired", { code: "SESSION_REVOKED" });
        const disconnectTimer = setTimeout(() => socket.disconnect(true), 50);
        disconnectTimer.unref?.();
      }
    }
    clearSessionCookie(response);
    response.status(204).end();
  } catch (error) {
    logAuthFailure("Logout", error);
    response.status(503).json({ error: "Logout is temporarily unavailable." });
  }
}

export async function listRooms(request, response) {
  try {
    const memberships = await prisma.roomMembership.findMany({
      where: { userId: request.auth.userId },
      select: { room: { select: { id: true, roomName: true } } },
      orderBy: { joinedAt: "asc" },
    });
    response.status(200).json({ rooms: memberships.map(({ room }) => room) });
  } catch (error) {
    logAuthFailure("Room listing", error);
    response.status(503).json({ error: "Rooms are temporarily unavailable." });
  }
}
