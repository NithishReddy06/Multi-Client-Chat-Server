import { randomUUID } from "node:crypto";
import { chatRepository } from "../services/chat.repository.js";
import {
  getSession,
  SESSION_TTL_MS,
  tokenFromCookieHeader,
} from "../services/auth.service.js";

const DEFAULT_ROOM = "general";
const MAX_MESSAGE_LENGTH = 2000;
const MESSAGE_WINDOW_MS = 5000;
const MAX_MESSAGES_PER_WINDOW = 5;

function sendError(socket, message, code) {
  const event = { message, code };
  socket.emit("error_message", event);
  return { ok: false, ...event };
}

function validPayload(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function authenticationError(message, code) {
  const error = new Error(message);
  error.data = { code };
  return error;
}

function expireSocket(socket, code) {
  socket.emit("auth_expired", { code });
  const disconnectTimer = setTimeout(() => socket.disconnect(true), 50);
  disconnectTimer.unref?.();
}

async function verifyLiveSession(socket) {
  const session = await getSession(tokenFromCookieHeader(socket.handshake.headers.cookie));
  if (!session || session.id !== socket.data.sessionId ||
      session.userId !== socket.data.authenticatedUser.id) {
    expireSocket(socket, "SESSION_EXPIRED");
    return null;
  }
  socket.data.sessionExpiresAt = session.expiresAt;
  return session;
}

function getOnlineUsers(io, room) {
  const users = new Map();
  for (const socketId of io.of("/").adapter.rooms.get(room) ?? []) {
    const user = io.of("/").sockets.get(socketId)?.data.chatUser;
    if (user) users.set(user.id, { id: user.id, username: user.username });
  }
  return Array.from(users.values()).sort((first, second) =>
    first.username.localeCompare(second.username),
  );
}

function storageError(socket, acknowledge, error, operation) {
  console.error(`Chat ${operation} failed:`, error?.code ?? error?.name ?? "unknown");
  const response = sendError(
    socket,
    "The chat database is temporarily unavailable. Please try again.",
    "PERSISTENCE_UNAVAILABLE",
  );
  acknowledge?.(response);
}

export function configureSockets(io, repository = chatRepository) {
  io.use(async (socket, next) => {
    try {
      const token = tokenFromCookieHeader(socket.handshake.headers.cookie);
      const session = await getSession(token);
      if (!session) {
        next(authenticationError("Authentication required.", "UNAUTHORIZED"));
        return;
      }
      socket.data.sessionId = session.id;
      socket.data.authenticatedUser = session.user;
      socket.data.sessionExpiresAt = session.expiresAt;
      next();
    } catch (error) {
      console.error("Socket authentication failed:", error?.code ?? error?.name ?? "unknown");
      next(authenticationError("Authentication is temporarily unavailable.", "AUTH_UNAVAILABLE"));
    }
  });

  io.on("connection", (socket) => {
    const expiryTimer = setTimeout(() => {
      expireSocket(socket, "SESSION_EXPIRED");
    }, Math.min(
      Math.max(0, socket.data.sessionExpiresAt.getTime() - Date.now()),
      SESSION_TTL_MS,
    ));
    expiryTimer.unref?.();

    console.log(`Authenticated Socket.IO client connected: ${socket.id}`);
    const sentAt = [];

    socket.on("join_chat", async (payload, acknowledge) => {
      if (typeof acknowledge !== "function") {
        sendError(socket, "A join acknowledgement callback is required.", "INVALID_REQUEST");
        return;
      }
      if (!validPayload(payload) ||
          (payload.roomName !== undefined && typeof payload.roomName !== "string")) {
        acknowledge(sendError(socket, "The room request is invalid.", "INVALID_REQUEST"));
        return;
      }

      let activeSession;
      try {
        activeSession = await verifyLiveSession(socket);
      } catch (error) {
        storageError(socket, acknowledge, error, "session verification");
        return;
      }
      if (!activeSession) {
        acknowledge({ ok: false, message: "Your session has expired.", code: "SESSION_EXPIRED" });
        return;
      }
      const user = activeSession.user;
      const roomName = (payload.roomName ?? DEFAULT_ROOM).trim();
      if (!roomName || roomName.length > 64) {
        acknowledge(sendError(socket, "The room name is invalid.", "INVALID_ROOM"));
        return;
      }

      try {
        const roomRecord = await repository.getRoomForMember(user.id, roomName);
        if (!roomRecord) {
          acknowledge(sendError(socket, "You do not have access to that room.", "ROOM_FORBIDDEN"));
          return;
        }
        const history = await repository.getLatestMessages(roomRecord.id);
        if (!socket.connected) return;

        const previousUser = socket.data.chatUser;
        if (previousUser?.room !== roomName) {
          if (previousUser) {
            await socket.leave(previousUser.room);
            socket.to(previousUser.room).emit("user_left", {
              id: randomUUID(),
              username: previousUser.username,
              room: previousUser.room,
              createdAt: new Date().toISOString(),
            });
            io.to(previousUser.room).emit(
              "online_users",
              getOnlineUsers(io, previousUser.room),
            );
          }

          socket.data.chatUser = {
            id: user.id,
            username: user.username,
            room: roomName,
            roomId: roomRecord.id,
          };
          await socket.join(roomName);
          socket.to(roomName).emit("user_joined", {
            id: randomUUID(),
            username: user.username,
            room: roomName,
            createdAt: new Date().toISOString(),
          });
        }

        const users = getOnlineUsers(io, roomName);
        io.to(roomName).emit("online_users", users);
        acknowledge({
          ok: true,
          user: { id: user.id, username: user.username },
          room: { id: roomRecord.id, roomName: roomRecord.roomName },
          users,
          messages: history,
        });
      } catch (error) {
        storageError(socket, acknowledge, error, "room join");
      }
    });

    socket.on("send_message", async (payload, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : undefined;
      const user = socket.data.chatUser;
      if (!user) {
        reply?.(sendError(socket, "Join an authorized room before sending messages.", "NOT_IN_CHAT"));
        return;
      }
      if (!validPayload(payload) || typeof payload.content !== "string") {
        reply?.(sendError(socket, "The message payload is invalid.", "INVALID_MESSAGE"));
        return;
      }

      const messageText = payload.content.trim();
      if (!messageText) {
        reply?.(sendError(socket, "Messages cannot be empty.", "EMPTY_MESSAGE"));
        return;
      }
      if (messageText.length > MAX_MESSAGE_LENGTH) {
        reply?.(sendError(
          socket,
          `Messages cannot exceed ${MAX_MESSAGE_LENGTH} characters.`,
          "MESSAGE_TOO_LONG",
        ));
        return;
      }

      const now = Date.now();
      while (sentAt.length && now - sentAt[0] >= MESSAGE_WINDOW_MS) sentAt.shift();
      if (sentAt.length >= MAX_MESSAGES_PER_WINDOW) {
        reply?.(sendError(
          socket,
          "You are sending messages too quickly. Please wait a few seconds.",
          "RATE_LIMITED",
        ));
        return;
      }
      sentAt.push(now);

      try {
        const activeSession = await verifyLiveSession(socket);
        if (!activeSession) {
          reply?.({ ok: false, message: "Your session has expired.", code: "SESSION_EXPIRED" });
          return;
        }
        const hasAccess = await repository.getRoomForMember(user.id, user.room);
        if (!hasAccess || hasAccess.id !== user.roomId) {
          reply?.(sendError(socket, "You no longer have access to that room.", "ROOM_FORBIDDEN"));
          socket.leave(user.room);
          socket.data.chatUser = null;
          return;
        }

        const message = await repository.createMessage({
          senderId: activeSession.userId,
          senderDisplayName: activeSession.user.username,
          roomId: user.roomId,
          messageText,
        });
        if (!socket.connected) {
          reply?.({
            ok: false,
            message: "The message was saved, but this client disconnected before delivery.",
            code: "CLIENT_DISCONNECTED",
          });
          return;
        }
        socket.to(user.room).emit("receive_message", message);
        reply?.({ ok: true, message });
      } catch (error) {
        storageError(socket, reply, error, "message save");
      }
    });

    socket.on("disconnect", (reason) => {
      clearTimeout(expiryTimer);
      const user = socket.data.chatUser;
      if (user) {
        socket.to(user.room).emit("user_left", {
          id: randomUUID(),
          username: user.username,
          room: user.room,
          createdAt: new Date().toISOString(),
        });
        io.to(user.room).emit("online_users", getOnlineUsers(io, user.room));
      }
      console.log(`Authenticated Socket.IO client disconnected: ${socket.id} (${reason})`);
    });
  });
}
