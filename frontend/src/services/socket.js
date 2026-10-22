import { io } from "socket.io-client";

const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

export function createChatSocket() {
  return io(apiUrl, {
    autoConnect: false,
    withCredentials: true,
    reconnection: true,
  });
}
