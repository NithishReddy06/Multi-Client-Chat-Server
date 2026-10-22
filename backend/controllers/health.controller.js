import { prisma } from "../services/database.js";

export async function getHealth(_request, response) {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({
      status: "ok",
      database: "connected",
      service: "multi-client-chat-api",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const safeMessage = message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://[redacted]");
    console.error("Database health check failed:", safeMessage);
    response.status(503).json({
      status: "error",
      database: "disconnected",
      service: "multi-client-chat-api",
    });
  }
}
