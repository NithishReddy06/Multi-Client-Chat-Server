# Test plan and observed status

## Execution record

This report records only checks actually run in this workspace. The frontend production build and lint passed; Vite served the app and the browser rendered both login and registration modes; Prisma schema validation and client generation passed; backend started with a syntactically valid placeholder database URL; `/api/health` returned HTTP 503 because that placeholder database was not reachable. The browser's session request also failed with connection refused while the backend was stopped. No `backend/.env` was present. PostgreSQL-backed test cases were skipped and are **not** reported as passed.

Status meanings: **PASS** = executed and observed; **FAIL** = executed and failed; **PENDING** = not executed; **BLOCKED** = attempted but a required dependency/configuration was unavailable.

| Test ID | Test description | Preconditions | Steps | Expected result | Actual result | Status |
| --- | --- | --- | --- | --- | --- | --- |
| T01 | Frontend production build | Frontend dependencies installed | Run `npm run build` in `frontend` | Vite completes and emits `dist` | Vite build completed successfully | PASS |
| T02 | Frontend lint | Frontend dependencies installed | Run `npm run lint` in `frontend` | No lint errors | Oxlint completed without reported errors | PASS |
| T03 | Frontend development startup | Node/npm available | Run `npm run dev`, request the Vite page | Page served successfully | Vite served the app on port 5173; `curl.exe` received the Vite HTML | PASS |
| T04 | Backend startup | Backend environment has URL-shaped `DATABASE_URL` and `CLIENT_URL` | Run `npm run dev` | Server listens on configured port | Server logged listening on port 5000 with a placeholder URL | PASS |
| T05 | PostgreSQL connectivity and health | Real PostgreSQL service, valid credentials, configured `DATABASE_URL` | Request `/api/health` | HTTP 200 with connected database | Placeholder URL probe returned HTTP 503; no real credentials configured | BLOCKED |
| T06 | Prisma schema validation/client generation | Prisma dependencies installed; URL-shaped environment variable for config | Run `npm run db:check` and `npm run db:generate` | Schema valid and client generated | Both completed successfully | PASS |
| T07 | Apply both migrations | Reachable target PostgreSQL and valid `DATABASE_URL` | Run `npm run db:migrate` | Tables/indexes/FKs created and migrations recorded | Not run; no configured database URL | BLOCKED |
| T08 | Registration and password hashing | Migrations applied, reachable database | Register valid user; inspect selected database row | Unique user created, bcrypt hash stored, no hash in API response | Integration test added; not executed without DB URL | BLOCKED |
| T09 | Duplicate username and validation | Same as T08 | Register same normalized username twice; try invalid fields | Duplicate is 409; invalid input rejected | Integration assertions added; not executed without DB URL | BLOCKED |
| T10 | Login and generic errors | Registered account and database | Login correctly, then with wrong password and unknown account | Correct login sets cookie; failures have same generic response | Integration assertions added; not executed without DB URL | BLOCKED |
| T11 | Logout/CSRF/revocation | Authenticated session and socket | Omit CSRF, then logout correctly | Missing CSRF rejected; session deleted and sockets disconnected | Integration assertions added; not executed without DB URL | BLOCKED |
| T12 | HTTP auth/session protection | Auth API running with database | Request protected rooms with/without valid cookie | Unauthenticated request rejected; authorized room list returned | Integration assertions added; not executed without DB URL | BLOCKED |
| T13 | Socket handshake authentication | Valid DB session for positive case | Connect with no cookie and with valid cookie | Anonymous socket rejected; valid session accepted | Integration assertions added; not executed without DB URL | BLOCKED |
| T14 | Multiple authenticated clients/presence | Two valid accounts and DB | Connect/join both, observe online users and close one | Both clients listed; leave event/list update occurs | Integration assertions added; not executed without DB URL | BLOCKED |
| T15 | Broadcast and sender identity | Two authenticated clients in authorized room | Send content plus forged sender/user/room fields | Peer gets persisted message; DB sender/room come from server context; sender gets one copy | Integration assertions added; not executed without DB URL | BLOCKED |
| T16 | Persistence and recent history | Database migrated and running | Send messages, restart server, rejoin | Data survives restart; latest 50 are chronological | Repository test and socket test added; not executed without DB URL | BLOCKED |
| T17 | Room membership restrictions | At least one private room with no membership | Attempt `join_chat`, then attempt send after revocation | Join/send denied; no unauthorized room data delivered | Integration test covers unauthorized join; other live checks pending | BLOCKED |
| T18 | Invalid and oversized messages | Two valid sockets and DB | Send empty payload, malformed body, >2,000 characters | Rejected with safe event/ack; backend stays running | Code checks present; live integration execution not recorded | PENDING |
| T19 | Rate limiting | Repeated auth and message attempts | Exceed 10 auth attempts/window or 5 messages/5 sec | HTTP 429 or message rate error | Limits implemented; live threshold test not recorded | PENDING |
| T20 | Unit credential validation | Node dependencies installed | Run `npm test` without `DATABASE_URL` | Username/password/cookie/CSRF cases pass; DB tests skip | 3 unit tests passed; 2 database integration tests skipped | PASS |
| T21 | Database error handling | Database unavailable while server runs | Exercise health, auth and socket persistence paths | Safe 503/error result; server stays alive; no unsaved broadcast | Health returned 503 in placeholder probe; auth/socket error paths not independently exercised | PENDING |
| T22 | Session expiry/reconnect | Live database and active authenticated sockets | Expire/revoke session, reconnect or send | Old session rejected and existing socket disconnected | Integration assertions added; not executed without DB URL | BLOCKED |
| T23 | Unauthorized HTTP mutation/CORS | API running | Use untrusted Origin or omit logout CSRF | Mutation rejected | Middleware implemented; not independently exercised | PENDING |
| T24 | Auth UI rendering and mode switch | Frontend served | Load auth screen and switch between login and registration | Both forms render and switch without a UI crash | Browser rendered login form, then registration form after clicking “Create an account”; backend request failed with connection refused because backend was not running | PASS |
| T25 | Wireshark capture | Npcap/loopback capture adapter and live app | Capture TCP 5000/5173, inspect handshake and transport | Genuine packets captured and explained | No capture or screenshots taken | PENDING |

## Manual execution sequence

After configuring PostgreSQL in `backend/.env`, apply migrations, then run:

```powershell
Set-Location .\backend
npm test
```

The integration suite creates unique test accounts/rooms and cleans them up. Run against a dedicated development/test database because tests create and delete rows. Then start both applications and follow the browser steps in the root README demo. Record outcomes and evidence in this table only after observing them.

## Before-review issues and limitations

- **Must address before claiming a complete demo:** configure a real database URL, apply migrations, and execute the PostgreSQL integration suite. Until then, core user/chat functionality is implemented but runtime behavior is unverified in this workspace.
- Confirm a genuine two-browser demo including logout, refresh/history, sender spoof attempt, unauthorized room, disconnect/reconnect, and invalid/oversized messages.
- Obtain genuine Wireshark evidence if the review requires screenshots. Do not fabricate screenshots or claim TLS-protected payloads are visible.
- Current auth rate limiting is per-process memory; disclose that it is for local/demo use and use a shared store for horizontal deployment.
- Room switching/administration UI is not implemented. New accounts are assigned to `general`.

No confirmed code regression was observed in the executed static/build checks. The items above are environment/test coverage blockers and documented scope limitations, not assertions of an observed failing code path.

## Evidence to capture

For each live test, record date/time, browser/session used, expected versus observed behavior, and a genuine screenshot or sanitized log excerpt. Do not include passwords, session cookie values, database URLs, or CSRF values in evidence.
