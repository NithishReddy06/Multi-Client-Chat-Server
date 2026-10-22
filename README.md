# Multi Client Chat Server

A Computer Networks project demonstrating a full-stack, authenticated, real-time chat application. React clients communicate with a Node.js/Express server over HTTP and Socket.IO. PostgreSQL stores accounts, sessions, room memberships, and messages through Prisma. The original Python TCP chat is kept separately as a raw-socket comparison.

> **Review status:** the frontend production build/lint passed; Vite served the app and the browser rendered and switched between login and registration; Prisma schema validation/client generation, backend startup, and isolated authentication-unit tests were executed. PostgreSQL-backed functional tests are present but were **not run** because this workspace has no `backend/.env` or configured `DATABASE_URL`. See [docs/test-plan.md](./docs/test-plan.md); no pending test is represented as a pass.

## Problem statement

Basic terminal chat examples demonstrate sockets but do not provide account identity, durable history, or a web interface. This project demonstrates how a server can authenticate multiple clients, authorize room membership, validate and persist messages, and distribute them in real time while exposing the underlying network concepts.

## Objectives

- Demonstrate a client-server application with concurrent connected clients.
- Provide account registration, login, logout, and protected chat.
- Hash passwords and keep session credentials out of frontend storage.
- Authenticate Socket.IO handshakes and verify room access server-side.
- Persist accepted messages before broadcasting and restore recent history.
- Use Wireshark to examine local TCP, HTTP polling, and WebSocket traffic.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite |
| HTTP backend | Node.js, Express 5 |
| Real-time events | Socket.IO |
| Database | PostgreSQL |
| ORM and migrations | Prisma 7 |
| Password hashing | bcrypt |
| Network analysis | Wireshark |

## Architecture

```text
React browser
  ├── HTTP API (registration, login, session, logout)
  └── Socket.IO (authenticated room events and messages)
          ↓
Node.js + Express
  ├── Authentication and authorization
  ├── Socket.IO connection/event handlers
  └── Prisma ORM
          ↓
       PostgreSQL
```

The browser sends credentials to Express over HTTP. The server validates input, stores a bcrypt hash, and issues an opaque session cookie marked HttpOnly. Once authenticated, the browser opens Socket.IO; handshake middleware validates the cookie against the server-side session table. Before a room join or message send, the server checks the current session and room membership. It takes the sender ID from the verified session/socket state, validates the content, commits the message through Prisma, and only then broadcasts it to the other authorized room members.

Detailed diagrams and explanations:

- [Architecture](./docs/architecture.md)
- [Message and authentication data flow](./docs/data-flow.md)
- [Database design](./docs/database-design.md)
- [Test plan and honest results](./docs/test-plan.md)
- [Computer Networks concepts](./docs/cn-concepts.md)

## Project directory structure

```text
Multi_Client_Chat_Server/
├── backend/
│   ├── config/                 # Environment validation
│   ├── controllers/            # Authentication and health handlers
│   ├── middleware/             # Session, CSRF, origin, rate-limit checks
│   ├── prisma/
│   │   ├── migrations/         # PostgreSQL schema history
│   │   └── schema.prisma       # User, Session, Room, membership, Message
│   ├── routes/                 # HTTP endpoints
│   ├── services/               # Auth, Prisma client, chat repository
│   ├── sockets/                # Authenticated Socket.IO event handlers
│   ├── tests/                  # Unit and PostgreSQL integration tests
│   ├── app.js
│   ├── server.js
│   ├── prisma.config.js
│   └── .env.example
├── frontend/
│   ├── src/components/         # Auth, sidebar, message and chat UI
│   ├── src/hooks/              # Socket lifecycle and message state
│   ├── src/services/           # HTTP API and Socket.IO client
│   └── .env.example
├── docs/
│   ├── architecture.md
│   ├── data-flow.md
│   ├── database-design.md
│   ├── test-plan.md
│   └── cn-concepts.md
├── client.py                   # Separate raw TCP client demonstration
├── server.py                   # Separate raw TCP server demonstration
└── README.md
```

## Database schema

| Model | Purpose and relationships |
| --- | --- |
| `User` | Unique normalized username, bcrypt `passwordHash`, creation time; owns sessions, room memberships, and messages. |
| `Session` | Unique SHA-256 hash of an opaque session token, CSRF value, user foreign key, expiry and creation times. |
| `Room` | Unique room name, creation time; has memberships and messages. |
| `RoomMembership` | User-to-room join model with a unique `(userId, roomId)` pair and join timestamp. |
| `Message` | Room foreign key, nullable sender foreign key for legacy history, sender display name, text and timestamp. New messages always use an authenticated account. |

See [docs/database-design.md](./docs/database-design.md) and [backend/prisma/schema.prisma](./backend/prisma/schema.prisma). Legacy users whose password hash was null are assigned an unguessable bcrypt hash by the authentication migration before `passwordHash` becomes required; they cannot log in using an unknown password.

## Installation and environment

Requirements: Node.js 20.19+ (or a current supported LTS), npm, and PostgreSQL.

From the project root in PowerShell, install dependencies and create the backend environment file:

```powershell
Set-Location .\backend
npm install
Copy-Item .env.example .env
```

Edit `backend/.env` locally. Do not commit it or put database credentials in `frontend/.env`.

```dotenv
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL="postgresql://<user>:<password>@localhost:5432/multiclient_chat?schema=public"
```

Create the PostgreSQL database `multiclient_chat` first using pgAdmin or `createdb`. URL-encode reserved characters in the username/password. `NODE_ENV=production` enables the cookie's `Secure` attribute; production must use HTTPS. The frontend may copy `frontend/.env.example` to `frontend/.env` to set `VITE_API_URL`; its default is `http://localhost:5000`.

## Prisma setup and migrations

Run from `backend` after configuring `DATABASE_URL`:

```powershell
npm run db:check
npm run db:generate
npm run db:migrate
```

`db:migrate` applies the checked-in migrations to a development database and records them in `_prisma_migrations`. After a schema change, create a named migration with:

```powershell
npm run db:migrate -- --name <migration_name>
```

The migration history includes the initial chat schema and the session/authentication schema update. To inspect local rows:

```powershell
npm run db:studio
```

## Start the frontend and backend

Backend terminal:

```powershell
Set-Location .\backend
npm run dev
```

Frontend terminal:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Open `http://localhost:5173`, register an account, then sign in. The application health endpoint is `GET http://localhost:5000/api/health`. For production, use `npm start` for the backend and `npm run build` for the frontend.

## Implemented features

- React authentication screen with registration/login and server validation feedback.
- Unique usernames, bcrypt password hashing, generic invalid-credential response.
- Opaque database-backed 12-hour sessions in HttpOnly, SameSite cookies; logout revocation.
- CSRF token requirement on logout and trusted-Origin checks on authentication mutations.
- Per-IP registration/login limiting (10 attempts per 15 minutes per backend process).
- Authenticated Socket.IO handshakes, server-derived sender identity, session expiry/revocation handling.
- `general` room membership assigned to new accounts; room listing and server-side authorization.
- Message validation (nonempty, 2,000-character cap, five messages per socket per five seconds).
- Message write before broadcast; latest 50 messages returned chronologically on room join.
- Online presence and join/leave notifications; no duplicate sender copy.
- Separate preserved Python raw-TCP demonstration.

## Features planned for future reviews

- Private conversations, invitation/admin controls, and user-managed room creation.
- Password change/reset and account-recovery flow.
- Production-grade shared rate limiting and operational monitoring.
- Deployment hardening, HTTPS configuration, and multi-instance Socket.IO scaling/adapter.
- Review presentation screenshots and actual Wireshark capture evidence.

## Testing instructions and status

Automated checks:

```powershell
# Frontend
Set-Location .\frontend
npm run build
npm run lint

# Backend
Set-Location ..\backend
npm run db:check
npm run db:generate
npm test
```

With PostgreSQL reachable and the migrations applied, `npm test` runs the integration tests for account lifecycle, cookie/session security, authenticated sockets, room restrictions, sender identity, multi-client delivery, persistence, history, concurrent writes and foreign-key validation. Without a real `DATABASE_URL`, those integration tests are explicitly skipped. Refer to [docs/test-plan.md](./docs/test-plan.md) for executed results and remaining cases.

## Known limitations

- This workspace currently has no `backend/.env`; PostgreSQL connectivity, migrations, account flows, and end-to-end chat could not be confirmed here. Do not describe these database-backed scenarios as passed until the test plan is run with a configured database.
- The auth rate limiter is in-memory and per process; it is not suitable for horizontally scaled production.
- The current authenticated interface connects to `general`; room switching UI and room administration are not implemented even though server-side membership checks exist.
- Cookies are secure only when `NODE_ENV=production`; production requires HTTPS and a frontend/backend deployment whose cookie SameSite policy is compatible with their domains.
- The original Python server/client are independent and do not share accounts, rooms, or messages with the web application.
- Wireshark evidence and genuine screenshots must be captured from a live run; none are fabricated or committed by this documentation.

## Five-minute review demonstration

Use two separate browser profiles (or one normal and one private window) and have PostgreSQL configured/migrated:

1. Register two distinct users.
2. Sign in from each separate browser session.
3. Show both clients in the `general` room and the online-user list.
4. Send a message from each browser; show that it appears once per client.
5. Close one browser and show the leave notification and updated presence.
6. Reload the remaining browser and show message history loaded from PostgreSQL.
7. Explain the HTTP login/session cookie, Socket.IO handshake, server identity verification, Prisma save-before-broadcast flow.
8. If a live capture is available, show the Wireshark TCP handshake and HTTP polling/WebSocket frames without claiming encrypted TLS payloads are readable.

## Likely faculty questions

1. **Why use Socket.IO rather than repeatedly polling HTTP?** It supports event-driven bidirectional communication, reconnection and transport fallback with less application-level polling work.
2. **Is Socket.IO the same as a raw TCP socket?** No. Socket.IO is an event protocol over Engine.IO; it can use WebSocket or HTTP long-polling, typically carried over TCP in this app.
3. **How is a user authenticated?** HTTP login creates a random opaque session cookie; the server looks up its stored token hash and expiry.
4. **How is a Socket.IO connection authenticated?** Handshake middleware reads the cookie and verifies the active server-side session before accepting the socket.
5. **Can a client spoof a sender ID?** No. The server ignores sender identity fields in event payloads and derives the user ID from verified socket state.
6. **Why save before broadcasting?** So peers are not shown a message that failed to persist; an error is returned if the database write fails.
7. **Why hash passwords with bcrypt?** A salted, deliberately expensive password hash reduces the impact of a database leak; plaintext passwords are never stored.
8. **How does the room membership model work?** `RoomMembership` is a join table implementing the many-to-many User/Room relation, and it is checked before room entry and sending.
9. **What does TCP guarantee?** It provides reliable, ordered byte-stream delivery between endpoints; it does not define the application's chat message format.
10. **What is the difference between TCP ACK and Socket.IO ACK?** A TCP ACK acknowledges received transport bytes; an optional Socket.IO acknowledgement is an application event callback after server-side processing.
