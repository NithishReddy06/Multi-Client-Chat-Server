# Application architecture

## Component view

```text
React browser (localhost:5173)
  ├─ HTTP: /api/auth/* and /api/health
  └─ Socket.IO: join_chat, send_message, presence and message events
                 │ cookie credentials / JSON / event payloads
                 ▼
Node.js HTTP server + Express + Socket.IO (localhost:5000)
  ├─ Origin, CSRF, session, input and rate-limit middleware
  ├─ Authentication/authorization controllers
  ├─ Authenticated Socket.IO handshake middleware
  ├─ Socket event handlers
  └─ Prisma client and chat repository
                 │ parameterized ORM operations
                 ▼
             PostgreSQL
```

The HTTP server is shared by Express and Socket.IO. Express serves HTTP API routes; Socket.IO attaches its Engine.IO transport and event protocol to that same Node.js server. PostgreSQL is not exposed to the browser.

## Request and message processing

For registration/login, Express validates the body, hashes a new password with bcrypt (or compares the submitted password against the stored hash), then stores an opaque server-side session record. A random session token is put in an HttpOnly cookie; its SHA-256 hash is used for database lookup. Registration also creates membership in `general`.

For real-time messages:

1. Socket.IO middleware authenticates the handshake cookie against the active PostgreSQL session.
2. The browser asks to join a room; the handler rechecks the session and requires a matching `RoomMembership`.
3. The server validates that the message event is a plain object with nonempty text of no more than 2,000 characters and enforces its per-socket rate limit.
4. The server rechecks the session/membership and uses the verified user ID and username from server-side socket state. Client-provided identity fields are ignored.
5. Prisma creates the `Message` row in PostgreSQL.
6. Only after the write resolves does the server emit `receive_message` to the other members of the Socket.IO room and acknowledge the sender with the stored message.

Database errors are logged by safe error code/name, not credentials or request contents. A generic persistence failure is returned; the server does not broadcast an uncommitted message.

## Identity and access boundaries

- HTTP identity comes from the server-side session addressed by the HttpOnly cookie.
- Socket identity comes from the same cookie verified during the Socket.IO handshake and is stored in `socket.data`.
- Room authorization is membership-based and checked on both join and send.
- A `send_message` payload is not an identity assertion; only the content is used.
- Logout deletes the session, emits `auth_expired` to matching sockets, and disconnects them. A timer and database checks reject expired sessions.
- Online users are derived from currently connected sockets in the room. Multiple sockets belonging to one account are shown once.

## HTTP and Socket.IO are different authentication steps

The browser calls `/api/auth/login` using HTTP and receives an HttpOnly cookie. The browser then makes a separate Socket.IO Engine.IO handshake, automatically including eligible cookies because the client enables credentials. Socket middleware resolves the cookie and rejects the connection if there is no active session. A successful HTTP login alone does not authorize arbitrary socket events; room membership and session validity are checked on the socket path as well.

## Current boundaries and limitations

`general` is automatically assigned at registration and is the only room exposed by the current interface. The data model and handlers support per-room membership enforcement, but UI-driven room administration/switching is future work. The development rate limiter is in-memory and works per Node.js process. Production multi-instance operation needs a shared rate-limit store and Socket.IO adapter. See [test-plan.md](./test-plan.md) for what has and has not been verified in the current environment.
