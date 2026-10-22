import cors from "cors";
import express from "express";
import { config } from "./config/env.js";
import { notFound } from "./middleware/not-found.js";
import authRoutes from "./routes/auth.routes.js";
import healthRoutes from "./routes/health.routes.js";

export function createApp(io) {
  const app = express();
  app.locals.clientUrl = config.clientUrl;
  app.locals.io = io;

  app.use(
    cors({
      origin: config.clientUrl,
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "X-CSRF-Token"],
    }),
  );
  app.use(express.json({ limit: "8kb" }));
  app.use("/api/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use(notFound);
  app.use((error, _request, response, _next) => {
    if (error?.type === "entity.too.large") {
      response.status(413).json({ error: "Request body is too large." });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "Malformed JSON request." });
      return;
    }
    console.error("Unhandled API error:", error?.code ?? error?.name ?? "unknown");
    response.status(500).json({ error: "An internal server error occurred." });
  });

  return app;
}
