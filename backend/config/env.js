import "dotenv/config";

const port = Number(process.env.PORT ?? 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

if (!process.env.CLIENT_URL) {
  throw new Error("CLIENT_URL must be set in backend/.env.");
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set in backend/.env.");
}

const clientUrl = new URL(process.env.CLIENT_URL);

export const config = {
  port,
  clientUrl: clientUrl.origin,
  secureCookies: process.env.NODE_ENV === "production",
  databaseUrl: process.env.DATABASE_URL,
};
