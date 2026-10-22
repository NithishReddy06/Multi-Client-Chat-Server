# Database design

The only application database is PostgreSQL. Prisma schema and migration files are under `backend/prisma/`; database access is kept in backend services/repositories.

## Entities and relationships

```text
User 1 ─── * Session
User 1 ─── * Message
Room 1 ─── * Message
User 1 ─── * RoomMembership * ─── 1 Room
                  (many-to-many User ↔ Room)
```

| Model | Important fields | Constraints and purpose |
| --- | --- | --- |
| `User` | `id`, `username`, `passwordHash`, `createdAt` | Primary key; unique normalized username. `passwordHash` is bcrypt output and is not returned to clients. |
| `Session` | `id`, `tokenHash`, `csrfToken`, `userId`, `expiresAt`, `createdAt` | Primary key; unique token hash; foreign key to `User` with cascade deletion; indexes on user and expiry. The actual opaque cookie token is never stored. |
| `Room` | `id`, `roomName`, `createdAt` | Primary key; unique room name. |
| `RoomMembership` | `id`, `userId`, `roomId`, `joinedAt` | Primary key; user/room foreign keys; unique `(userId, roomId)` to prevent duplicate memberships. |
| `Message` | `id`, `senderId`, `senderDisplayName`, `roomId`, `messageText`, `createdAt` | Primary key; room foreign key; optional sender foreign key retained for legacy rows; 2,000-character database limit. Index supports room history order. |

The registration transaction inserts a user, ensures the `general` room exists, creates membership, and creates a session. If any operation fails, the transaction rolls back. New message writes use the verified session's `userId` and username. The nullable `Message.senderId` only allows old rows from before authentication to remain compatible; new socket messages always supply an authenticated sender.

## Migrations

Prisma 7 reads the PostgreSQL URL through `backend/prisma.config.js` from `DATABASE_URL`. With `backend/.env` configured, run from `backend`:

```powershell
npm run db:check
npm run db:generate
npm run db:migrate
```

The first checked-in migration creates the original chat models. The auth migration makes password hashes required, handles legacy null hashes with a non-login-capable bcrypt value, and creates `Session`. Migration application and live foreign-key behavior are **pending verification** in the current workspace because it lacks a configured `DATABASE_URL`.
