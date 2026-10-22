import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { prisma } from "./services/database.js";
import { configureSockets } from "./sockets/index.js";

const app = createApp();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.clientUrl,
    credentials: true,
    methods: ["GET", "POST"],
  },
});

app.locals.io = io;
configureSockets(io);

httpServer.listen(config.port, () => {
  console.log(`API and Socket.IO listening at http://localhost:${config.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received; shutting down.`);
  await new Promise((resolve) => io.close(resolve));
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
