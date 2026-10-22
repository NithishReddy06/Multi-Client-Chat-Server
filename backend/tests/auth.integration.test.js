import "dotenv/config";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { io as createSocketClient } from "socket.io-client";

process.env.CLIENT_URL ??= "http://localhost:5173";

test(
  "authentication protects HTTP and Socket.IO chat and binds saved messages to the session user",
  { skip: !process.env.DATABASE_URL && "Set DATABASE_URL in backend/.env to run PostgreSQL authentication tests." },
  async () => {
    const [{ Server }, { createApp }, { configureSockets }, { prisma }] = await Promise.all([
      import("socket.io"),
      import("../app.js"),
      import("../sockets/index.js"),
      import("../services/database.js"),
    ]);
    const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
    const usernameOne = `auth${suffix}a`;
    const usernameTwo = `auth${suffix}b`;
    const password = "a-safe-password-123";
    const privateRoomName = `private-${suffix}`;
    const messageContent = `persisted-auth-${suffix}`;
    const app = createApp();
    const httpServer = createServer(app);
    const ioServer = new Server(httpServer, {
      cors: { origin: process.env.CLIENT_URL, credentials: true },
    });
    app.locals.io = ioServer;
    configureSockets(ioServer);

    let userOne;
    let userTwo;
    let privateRoom;
    let firstSocket;
    let secondSocket;
    let expiringSocket;

    const request = async (path, { method = "GET", cookie, csrfToken, body } = {}) => {
      const response = await fetch(`http://127.0.0.1:${httpServer.address().port}${path}`, {
        method,
        headers: {
          Origin: process.env.CLIENT_URL,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const result = response.status === 204 ? null : await response.json();
      const setCookie = response.headers.get("set-cookie");
      return {
        response,
        result,
        cookie: setCookie?.split(";")[0],
      };
    };

    const connectSocket = (cookie) => new Promise((resolve, reject) => {
      const socket = createSocketClient(
        `http://127.0.0.1:${httpServer.address().port}`,
        {
          autoConnect: false,
          reconnection: false,
          transports: ["websocket"],
          extraHeaders: cookie ? { Cookie: cookie } : {},
        },
      );
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error("Timed out connecting the test socket."));
      }, 5000);
      socket.once("connect", () => {
        clearTimeout(timeout);
        resolve(socket);
      });
      socket.once("connect_error", (error) => {
        clearTimeout(timeout);
        resolve({ error, socket });
      });
      socket.connect();
    });

    const emitAck = (socket, event, payload) => new Promise((resolve, reject) => {
      socket.timeout(5000).emit(event, payload, (timeoutError, result) => {
        if (timeoutError) reject(timeoutError);
        else resolve(result);
      });
    });

    try {
      await prisma.$connect();
      await new Promise((resolve) => httpServer.listen(0, "127.0.0.1", resolve));

      const unauthenticated = await connectSocket();
      assert.equal(unauthenticated.error.data.code, "UNAUTHORIZED");
      unauthenticated.socket.disconnect();

      const registration = await request("/api/auth/register", {
        method: "POST",
        body: { username: usernameOne, password },
      });
      assert.equal(registration.response.status, 201);
      assert.equal(registration.result.user.username, usernameOne);
      assert.equal("passwordHash" in registration.result.user, false);
      const cookieOne = registration.cookie;
      const csrfOne = registration.result.csrfToken;
      assert.ok(cookieOne?.startsWith("chat_session="));
      assert.match(registration.response.headers.get("set-cookie"), /HttpOnly/i);
      assert.match(registration.response.headers.get("set-cookie"), /SameSite=Lax/i);
      userOne = await prisma.user.findUnique({ where: { username: usernameOne } });
      assert.notEqual(userOne.passwordHash, password);
      assert.ok(userOne.passwordHash.startsWith("$2"));

      const invalidRegistration = await request("/api/auth/register", {
        method: "POST",
        body: { username: "bad user", password: "short" },
      });
      assert.equal(invalidRegistration.response.status, 400);

      const duplicate = await request("/api/auth/register", {
        method: "POST",
        body: { username: usernameOne.toUpperCase(), password },
      });
      assert.equal(duplicate.response.status, 409);

      const wrongPassword = await request("/api/auth/login", {
        method: "POST",
        body: { username: usernameOne, password: "incorrect-password" },
      });
      assert.equal(wrongPassword.response.status, 401);
      assert.equal(wrongPassword.result.error, "Invalid username or password.");
      const unknownUser = await request("/api/auth/login", {
        method: "POST",
        body: { username: `missing${suffix}`, password },
      });
      assert.equal(unknownUser.response.status, 401);
      assert.equal(unknownUser.result.error, wrongPassword.result.error);

      const rooms = await request("/api/auth/rooms", { cookie: cookieOne });
      assert.equal(rooms.response.status, 200);
      assert.ok(rooms.result.rooms.some(({ roomName }) => roomName === "general"));

      privateRoom = await prisma.room.create({ data: { roomName: privateRoomName } });
      firstSocket = await connectSocket(cookieOne);
      assert.ok(firstSocket.connected);
      const joined = await emitAck(firstSocket, "join_chat", { roomName: "general" });
      assert.equal(joined.ok, true);
      const deniedRoom = await emitAck(firstSocket, "join_chat", { roomName: privateRoomName });
      assert.equal(deniedRoom.code, "ROOM_FORBIDDEN");

      const registrationTwo = await request("/api/auth/register", {
        method: "POST",
        body: { username: usernameTwo, password },
      });
      assert.equal(registrationTwo.response.status, 201);
      const cookieTwo = registrationTwo.cookie;
      userTwo = await prisma.user.findUnique({ where: { username: usernameTwo } });
      secondSocket = await connectSocket(cookieTwo);
      assert.ok(secondSocket.connected);
      assert.equal((await emitAck(secondSocket, "join_chat", { roomName: "general" })).ok, true);

      const received = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Peer did not receive the message.")), 5000);
        secondSocket.once("receive_message", (message) => {
          clearTimeout(timeout);
          resolve(message);
        });
      });
      const accepted = await emitAck(firstSocket, "send_message", {
        content: messageContent,
        senderId: userTwo.id,
        username: usernameTwo,
        roomId: privateRoom.id,
      });
      assert.equal(accepted.ok, true);
      assert.equal(accepted.message.senderId, userOne.id);
      assert.equal(accepted.message.username, usernameOne);
      assert.deepEqual(await received, accepted.message);
      const persisted = await prisma.message.findUnique({
        where: { id: accepted.message.id },
        select: { senderId: true, senderDisplayName: true, roomId: true },
      });
      assert.deepEqual(persisted, {
        senderId: userOne.id,
        senderDisplayName: usernameOne,
        roomId: joined.room.id,
      });

      const loggedOut = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Socket did not receive logout notification.")), 5000);
        firstSocket.once("auth_expired", (event) => {
          clearTimeout(timeout);
          resolve(event);
        });
      });
      const disconnected = new Promise((resolve) => firstSocket.once("disconnect", resolve));
      const missingCsrf = await request("/api/auth/logout", {
        method: "POST",
        cookie: cookieOne,
      });
      assert.equal(missingCsrf.response.status, 403);
      const logoutResponse = await request("/api/auth/logout", {
        method: "POST",
        cookie: cookieOne,
        csrfToken: csrfOne,
      });
      assert.equal(logoutResponse.response.status, 204);
      await loggedOut;
      await disconnected;
      assert.equal(firstSocket.connected, false);

      const sessionAfterLogout = await request("/api/auth/session", { cookie: cookieOne });
      assert.equal(sessionAfterLogout.result.authenticated, false);
      const protectedAfterLogout = await request("/api/auth/rooms", { cookie: cookieOne });
      assert.equal(protectedAfterLogout.response.status, 401);

      const loginResponse = await request("/api/auth/login", {
        method: "POST",
        body: { username: usernameOne, password },
      });
      assert.equal(loginResponse.response.status, 200);
      assert.equal(loginResponse.result.user.id, userOne.id);
      assert.equal("passwordHash" in loginResponse.result.user, false);
      expiringSocket = await connectSocket(loginResponse.cookie);
      assert.ok(expiringSocket.connected);
      assert.equal((await emitAck(expiringSocket, "join_chat", { roomName: "general" })).ok, true);
      const expiredNotification = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Expired socket was not notified.")), 5000);
        expiringSocket.once("auth_expired", (event) => {
          clearTimeout(timeout);
          resolve(event);
        });
      });
      const expiredDisconnect = new Promise((resolve) => expiringSocket.once("disconnect", resolve));
      const loginSession = await prisma.session.findFirst({
        where: { userId: userOne.id },
        select: { id: true },
      });
      await prisma.session.update({
        where: { id: loginSession.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const expiredMessage = await emitAck(expiringSocket, "send_message", {
        content: `after-expiry-${suffix}`,
      });
      assert.equal(expiredMessage.code, "SESSION_EXPIRED");
      await expiredNotification;
      await expiredDisconnect;
    } finally {
      firstSocket?.disconnect();
      secondSocket?.disconnect();
      expiringSocket?.disconnect();
      if (ioServer) await new Promise((resolve) => ioServer.close(resolve));
      if (httpServer.listening) {
        await new Promise((resolve) => httpServer.close(resolve));
      }
      if (userOne || userTwo || privateRoom) {
        await prisma.$transaction(async (transaction) => {
          if (userOne || userTwo) {
            await transaction.message.deleteMany({
              where: { messageText: messageContent },
            });
            await transaction.user.deleteMany({
              where: { id: { in: [userOne?.id, userTwo?.id].filter(Boolean) } },
            });
          }
          if (privateRoom) {
            await transaction.room.deleteMany({ where: { id: privateRoom.id } });
          }
        });
      }
      await prisma.$disconnect();
    }
  },
);
