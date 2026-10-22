# Authentication and chat data flow

## Registration

```text
React registration form
  → POST /api/auth/register { username, password } + Origin
  → Express body-size, origin, rate, username and password validation
  → bcrypt hash
  → Prisma transaction: User + general RoomMembership + Session
  → Set-Cookie: chat_session (HttpOnly, SameSite=Lax)
  ← { user: { id, username }, csrfToken }
```

The response never contains `passwordHash`. The random session token is only in the cookie; the database stores its SHA-256 hash. The CSRF value is returned for logout and is never an identity credential.

## Login and session restore

Login looks up a normalized username, compares passwords with bcrypt, and returns the same generic `Invalid username or password` result for a missing user or bad password. A valid login creates a new session. On application load, `GET /api/auth/session` sends the cookie and returns the minimal user view and CSRF value when that session is valid. Invalid/expired cookies are cleared.

## Socket connection and room join

```text
Browser Socket.IO client (withCredentials)
  → Engine.IO handshake carrying chat_session cookie
  → Socket.IO middleware hashes token and loads non-expired Session
  → socket.data receives verified session and user
  → join_chat { roomName: "general" }
  → session recheck + RoomMembership authorization
  → latest 50 messages + online users returned in acknowledgement
```

The socket is not opened until the frontend has restored or established an authenticated HTTP session. It still has an independent handshake check. A client cannot establish access by submitting a username or ID in `join_chat`.

## Message send and delivery

```text
Browser A
  → send_message { content, optional forged fields }
  → validate payload, text, size, rate
  → recheck cookie session + room membership
  → derive senderId/username from verified server-side socket state
  → Prisma INSERT Message → PostgreSQL commit
  → Socket.IO room broadcast to other members
  ← acknowledgement to sender with the same persisted message
Browser B
  ← receive_message (stored message)
```

The sender does not receive a second broadcast copy. If the database write fails, no peer receives the message and the sender receives a safe error. Upon joining/rejoining a room, the server fetches at most the newest 50 records, then returns them in chronological order.

## Presence, leave, logout, expiry

Joining/leaving a Socket.IO room updates in-memory online presence and produces `user_joined`, `user_left`, and `online_users` events. Presence is transient and is rebuilt after reconnects; messages and users remain in PostgreSQL. Logout requires the session cookie, expected Origin, and `X-CSRF-Token`. The server deletes that session and disconnects its sockets. A socket expiry timer and session lookups before a join/send prevent continued use of expired/revoked credentials.

## HTTP API summary

| Method | Path | Access | Behavior |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Reports API and database health. |
| `POST` | `/api/auth/register` | Public + trusted Origin + rate limit | Validates, creates account, joins `general`, creates session. |
| `POST` | `/api/auth/login` | Public + trusted Origin + rate limit | Verifies password and creates session. |
| `GET` | `/api/auth/session` | Cookie optional | Restores minimal authenticated identity or reports anonymous. |
| `POST` | `/api/auth/logout` | Session + Origin + CSRF | Revokes session and matching sockets. |
| `GET` | `/api/auth/rooms` | Session | Lists only rooms the account belongs to. |

No API response includes a password hash or database connection string.
