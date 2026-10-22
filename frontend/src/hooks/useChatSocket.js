import { useCallback, useEffect, useRef, useState } from "react";
import { getHealth } from "../services/api.js";
import { createChatSocket } from "../services/socket.js";

function systemMessage(event, username, createdAt, id) {
  return {
    id: id ?? `${event}-${crypto.randomUUID()}`,
    type: "system",
    username,
    content:
      event === "user_joined"
        ? `${username} joined the chat`
        : `${username} left the chat`,
    createdAt: createdAt ?? new Date().toISOString(),
  };
}

function mergeMessages(currentMessages, newMessages) {
  const byId = new Map(currentMessages.map((message) => [message.id, message]));
  for (const message of newMessages) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort((first, second) => {
    const timeDifference =
      new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
    return timeDifference || first.id.localeCompare(second.id);
  });
}

export function useChatSocket(user, onSessionExpired) {
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const [messages, setMessages] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [healthError, setHealthError] = useState("");
  const [socketError, setSocketError] = useState("");
  const socketRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    const socket = createChatSocket();
    let active = true;
    socketRef.current = socket;

    getHealth(controller.signal)
      .then((health) => {
        if (!active) return;

        if (!health.ok) {
          setHealthError(
            health.database === "disconnected"
              ? "The API is available, but its configured database connection is currently unavailable."
              : "The backend health check did not succeed.",
          );
          return;
        }

        setHealthError("");
      })
      .catch(() => {
        if (active) {
          setHealthError(
            "The backend health endpoint could not be reached. Real-time chat will still attempt to connect.",
          );
        }
      });

    socket.on("connect", () => {
      if (!active) return;
      setConnectionStatus("connecting");
      setSocketError("");
      socket.emit("join_chat", { roomName: "general" }, (result) => {
        if (!active) return;
        if (!result?.ok) {
          setConnectionStatus("unavailable");
          setMessagesLoading(false);
          setSocketError(result?.message ?? "Could not join the chat room.");
          if (result?.code === "SESSION_EXPIRED" || result?.code === "UNAUTHORIZED") {
            onSessionExpired();
          }
          return;
        }

        setConnectionStatus("connected");
        setMessagesLoading(false);
        setOnlineUsers(result.users);
        if (Array.isArray(result.messages)) {
          setMessages((currentMessages) =>
            mergeMessages(currentMessages, result.messages),
          );
        }
      });
    });

    socket.on("disconnect", (reason) => {
      if (!active) return;
      setConnectionStatus(socket.active ? "connecting" : "disconnected");
      if (reason !== "io client disconnect") {
        setSocketError("The real-time connection was interrupted. Reconnecting…");
      }
    });

    socket.on("connect_error", (error) => {
      if (!active) return;
      if (error?.data?.code === "UNAUTHORIZED") {
        setConnectionStatus("unavailable");
        setMessagesLoading(false);
        onSessionExpired();
        return;
      }
      setConnectionStatus(socket.active ? "connecting" : "unavailable");
      setMessagesLoading(false);
      setSocketError("Could not connect to the chat server. Retrying automatically…");
    });

    socket.on("auth_expired", () => {
      if (active) onSessionExpired();
    });

    socket.on("receive_message", (message) => {
      if (
        !active ||
        !message ||
        typeof message.id !== "string" ||
        typeof message.username !== "string" ||
        typeof message.content !== "string" ||
        typeof message.createdAt !== "string"
      ) {
        return;
      }

      setMessages((currentMessages) => mergeMessages(currentMessages, [message]));
    });

    socket.on("user_joined", (event) => {
      if (!active || typeof event?.username !== "string") return;
      setMessages((currentMessages) => [
        ...currentMessages,
        systemMessage("user_joined", event.username, event.createdAt, event.id),
      ]);
    });

    socket.on("user_left", (event) => {
      if (!active || typeof event?.username !== "string") return;
      setMessages((currentMessages) => [
        ...currentMessages,
        systemMessage("user_left", event.username, event.createdAt, event.id),
      ]);
    });

    socket.on("online_users", (users) => {
      if (
        !active ||
        !Array.isArray(users) ||
        users.some((user) => !user || typeof user.username !== "string")
      ) {
        return;
      }
      setOnlineUsers(users);
    });

    socket.on("error_message", (error) => {
      if (active && typeof error?.message === "string") {
        setSocketError(error.message);
      }
    });

    socket.connect();

    return () => {
      active = false;
      controller.abort();
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [user.id, user.username, onSessionExpired]);

  const sendMessage = useCallback((content) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      return Promise.reject(new Error("You are not connected to the chat server."));
    }

    return new Promise((resolve, reject) => {
      socket.timeout(5000).emit("send_message", { content }, (timeoutError, result) => {
        if (socketRef.current !== socket) {
          reject(new Error("You left the chat before the message could be sent."));
          return;
        }
        if (timeoutError) {
          reject(new Error("The server did not respond. Check your connection and try again."));
          return;
        }
        if (!result?.ok) {
          reject(new Error(result?.message ?? "The message could not be sent."));
          return;
        }

        setMessages((currentMessages) =>
          mergeMessages(currentMessages, [result.message]),
        );
        setSocketError("");
        resolve(result.message);
      });
    });
  }, []);

  return {
    connectionStatus,
    messages,
    onlineUsers,
    messagesLoading,
    healthError,
    socketError,
    sendMessage,
  };
}
