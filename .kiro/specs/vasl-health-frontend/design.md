# VASL Health Frontend — Design

## Architecture Overview

Three services work together:

| Service | Path | Runtime | Port |
|---------|------|---------|------|
| Express Backend | `frontend/BE/` | Node.js + TypeScript | 4000 |
| Next.js UI | `frontend/FE/` | Next.js 16 (React 19) | 3000 |
| BullMQ Worker | `frontend/FE/worker.mjs` | Node.js | — |

```
Browser
  │
  ├── HTTP/WS → Express BE (port 4000)
  │     ├── Prisma → PostgreSQL (vasl_ts DB)
  │     ├── Socket.IO /coach-chat namespace
  │     ├── sentimentForwarder → Python FastAPI (port 8000)
  │     └── vaslDb.ts → PostgreSQL (vasl DB — risk data)
  │
  └── HTTP → Next.js (port 3000)
        ├── POST /api/chat → BullMQ → worker.mjs → Python FastAPI
        └── GET /api/scores/stream → Redis sub → SSE
```

## Express Backend (`frontend/BE/`)

### Entry Point (`server.ts`)
- HTTP server wrapping Express app
- Socket.IO server with CORS from `FRONTEND_URL` env var
- `/coach-chat` namespace with `socketAuthMiddleware`
- `startOrgNotificationScheduler()` on startup (hourly poll)

### Middleware
- `cors()` — open CORS
- `helmet()` — security headers
- `express.json()` — body parsing
- `morgan("dev")` — request logging
- Static files: `/uploads` → `public/uploads/`

### Authentication (`middleware/auth.middleware.ts`)
- `authMiddleware`: validates `Authorization: Bearer {JWT}`, attaches `req.user = { id, role, orgId? }`
- `requireRole(...roles)`: role guard used after `authMiddleware`
- JWT payload: `{ id, role, orgId? }`, signed with `JWT_SECRET`, 7-day expiry
- Roles: `"member" | "coach" | "organization" | "superadmin"`

### Socket.IO Auth (`middleware/socketAuth.middleware.ts`)
- Reads JWT from `socket.handshake.auth.token`
- Attaches `socket.data.user = { id, role: "member" | "coach" }`

### Coach Chat Socket (`sockets/coachChat.ts`)
- Personal rooms: `user:{userId}` (member), `coach:{coachId}` (coach)
- Events handled: `join_thread`, `send_message`, `mark_read`
- `send_message` side effects: `forwardToSentiment()` + `maybeEmailCoachUnreadMessages()` for member messages

### Sentiment Forwarder (`services/sentimentForwarder.ts`)
- `forwardToSentiment(message, messageId)`: fire-and-forget POST to `PYTHON_BACKEND_URL/v1/ingest/chat`
- Text truncated to 500 chars before sending
- On success: publishes `ScoreUpdateEvent` to Redis channel `vasl_score_updates` via ioredis
- On crisis/high tier: calls `emailOrgCrisisAlert()`
- `forwardPeerPostToSentiment(post)`: fire-and-forget POST to `/v1/ingest/peer-post`
- Redis client: lazy singleton with reconnect strategy

### Cross-DB Risk Query (`lib/vaslDb.ts`)
- Connects to `DATABASE_URL_VASL` (Python backend's PostgreSQL)
- `queryMessageRiskData(messageIds[])`: fetches `risk_tier`, `risk_score`, `signal_codes` for coach message IDs
- Graceful degradation: returns `[]` if `DATABASE_URL_VASL` not set

### Org Notification Scheduler (`services/orgNotification.scheduler.ts`)
- Polls every hour
- Monday: sends weekly outcome reports to orgs with `notifyWeeklyReport: true`
- Daily: sends new member digest to orgs with `notifyNewMembers: true`

## Express API Routes

### Auth (`/api/auth/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | None | Create member, send OTP |
| POST | `/api/auth/verify-otp` | None | Verify OTP → JWT |
| POST | `/api/auth/resend-otp` | None | Resend OTP |
| POST | `/api/auth/login` | None | Member login |
| POST | `/api/auth/forgot-password` | None | Stub — always 200 |
| GET | `/api/auth/platform-settings` | None | Public platform settings |
| GET | `/api/auth/coaches` | JWT | Coaches (org-scoped for members) |
| GET | `/api/auth/profile` | JWT (member) | Profile + stats + notifications + assessments |
| PATCH | `/api/auth/profile` | JWT (member) | Update name/avatar/password |
| PATCH | `/api/auth/notifications` | JWT (member) | Update notification prefs |

### Coach (`/api/coach/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/coach/register` | None | Create coach |
| POST | `/api/coach/login` | None | Coach login |
| GET | `/api/coach/list` | JWT | Active coaches (org-scoped for members) |
| GET | `/api/coach/members` | JWT (coach) | Coach's assigned members |
| GET | `/api/coach/on-demand` | JWT (coach) | On-demand status |
| PATCH | `/api/coach/on-demand` | JWT (coach) | Set on-demand status |
| GET | `/api/coach/profile` | JWT (coach) | Coach profile + notification prefs |
| PATCH | `/api/coach/profile` | JWT (coach) | Update coach profile |
| PATCH | `/api/coach/notifications` | JWT (coach) | Update notification prefs |
| GET | `/api/coach/:coachId` | JWT | Public coach card (role-scoped) |
| POST | `/api/coach/assign` | JWT | Member assigns to coach |
| GET | `/api/coach/scores/history` | JWT (coach/superadmin) | Proxy to Python risk history |

### Coach Messages (`/api/coach-messages/`)
All require JWT.
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/coach-messages/` | Conversation list |
| GET | `/api/coach-messages/unread-count` | Unread count |
| GET | `/api/coach-messages/:partnerId` | Thread (cursor pagination, risk-enriched) |
| POST | `/api/coach-messages/:partnerId/read` | Mark as read |

Thread response enriches member messages with `risk_tier`, `risk_score`, `risk_label`, `signal_codes` from vasl DB.

### Groups (`/api/groups/`) — all JWT
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/groups/` | All groups |
| GET | `/api/groups/my-groups` | Joined groups |
| GET | `/api/groups/recent-posts` | Recent posts (notification source) |
| GET | `/api/groups/recent-joins` | Recent joins (notification source) |
| GET | `/api/groups/:id` | Group detail |
| POST | `/api/groups/:id/join` | Join group |
| POST | `/api/groups/:id/leave` | Leave group |
| POST | `/api/groups/` | Create group |
| GET | `/api/groups/:id/posts` | Group posts |
| POST | `/api/groups/:id/posts` | Create post (triggers sentiment) |

### Mood (`/api/mood/`) — all JWT
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/mood/` | Submit daily mood |
| GET | `/api/mood/today` | `{ logged: boolean }` |
| GET | `/api/mood/trends` | Trend for `?days=7|30|60` |
| GET | `/api/mood/all-trends` | All 3 trend periods |

### Sessions (`/api/sessions/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/sessions/availability/:coachId` | JWT | Coach availability + today's bookings |
| PATCH | `/api/sessions/availability` | JWT (coach) | Save availability slots |
| GET | `/api/sessions/coach` | JWT (coach) | Coach's sessions |
| POST | `/api/sessions/book` | JWT (member) | Book session |
| GET | `/api/sessions/member` | JWT | Member's sessions |
| PATCH | `/api/sessions/:id/cancel` | JWT | Cancel session |
| PATCH | `/api/sessions/:id/reschedule` | JWT | Reschedule session |

### Session Notes (`/api/session-notes/`) — all JWT + coach
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/session-notes/` | Create note |
| GET | `/api/session-notes/coach/:coachId` | Coach's notes |
| PATCH | `/api/session-notes/:id` | Update note |
| DELETE | `/api/session-notes/:id` | Delete note |

### Onboarding (`/api/onboarding/`) — all JWT
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/onboarding/` | Submit assessment |
| GET | `/api/onboarding/me` | Get own assessment |

### Organization (`/api/org/`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/org/login` | None | Org login |
| POST | `/api/org/register` | None | Org registration |
| GET | `/api/org/overview` | JWT (organization) | Overview metrics |
| GET | `/api/org/outcomes` | JWT (organization) | Outcomes metrics |
| GET | `/api/org/members` | JWT (organization) | Members list |
| GET | `/api/org/coaches` | JWT (organization) | Coaches list |
| GET | `/api/org/settings` | JWT (organization) | Org settings |
| PATCH | `/api/org/settings` | JWT (organization) | Update settings |

### Admin (`/api/admin/`) — all JWT + superadmin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/activity` | 30-day activity feed |
| GET | `/api/admin/mood-distribution` | Platform mood distribution |
| GET | `/api/admin/overview-stats` | Total users/coaches/sessions/pending |
| GET/POST | `/api/admin/users` | User list / create |
| GET/PUT/DELETE | `/api/admin/users/:id` | User detail / update / delete |
| GET/POST | `/api/admin/coaches` | Coach list / create |
| PUT/DELETE | `/api/admin/coaches/:id` | Update / soft-remove coach |
| GET/POST | `/api/admin/groups` | Group list / create |
| PUT | `/api/admin/groups/:id` | Update group |
| PATCH | `/api/admin/groups/:id/archive` | Archive group |
| GET | `/api/admin/orgs/stats` | Org aggregate stats |
| GET/POST | `/api/admin/orgs` | Org list / create |
| GET | `/api/admin/orgs/:id/overview` | Org overview |
| PUT | `/api/admin/orgs/:id` | Update org |
| GET/PATCH | `/api/admin/settings` | Platform settings |
| POST | `/api/admin/settings/upload-logo` | Upload logo (base64) |
| POST | `/api/admin/settings/upload-loader` | Upload loader (base64) |

## Socket.IO Events (`/coach-chat` namespace)

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join_thread` | `{ partnerId }` | Idempotent room join |
| `send_message` | `{ partnerId, content }` | Send message |
| `mark_read` | `{ partnerId }` | Mark messages as read |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `message_saved` | `CoachMessageDTO` | Sender acknowledgement |
| `new_message` | `CoachMessageDTO` | Delivered to partner's room |
| `read_receipt` | `{ partnerId, readAt }` | Read confirmation |
| `error` | `{ code, message }` | Error: `UNAUTHORIZED_THREAD`, `VALIDATION_ERROR`, `SAVE_FAILED` |

## Prisma Data Models (`frontend/BE/prisma/schema.prisma`)

### User
```
id, email (unique), name, password (bcrypt), role ("member"|"superadmin"),
avatar?, isVerified (default false), organizationId? FK→Organization,
notifyGroupActivity (true), notifySessionReminders (true),
notifyDailyCheckin (false), notifyWeeklySummary (true),
createdAt, updatedAt
Relations: sentMessages, receivedMessages, emailVerifications,
           coachAssignments, coachMessages, groupMemberships,
           peerGroupPosts, moods, sessionNotes, onboardingAssessments
```

### Coach
```
id, email (unique), name, password (bcrypt), avatar?, bio?, speciality?,
isActive (true) — also used as on-demand flag,
organizationId? FK→Organization (legacy — prefer OrganizationCoach),
notifySessionReminders (true), notifyNewClientAssigned (true),
notifyMessageAlerts (true), createdAt, updatedAt
Relations: members (CoachMember[]), coachMessages, orgAssignments, sessionNotes
```

### Organization
```
id, name, type ("University"), plan ("Starter"),
primaryContactName, primaryContactEmail (unique), primaryContactPassword (bcrypt),
domain?, monthlySpend (0), status ("active"),
notifyWeeklyReport (true), notifyCrisisAlerts (true), notifyNewMembers (false),
createdAt, updatedAt
Relations: members (User[]), coaches (Coach[]), coachAssignments (OrganizationCoach[])
```

### OrganizationCoach (many-to-many)
```
id, organizationId FK→Organization CASCADE, coachId FK→Coach CASCADE,
assignedAt (now)
@@unique([organizationId, coachId])
```

### CoachMember (assignment)
```
id, coachId FK→Coach CASCADE, userId FK→User CASCADE, assignedAt (now)
@@unique([coachId, userId])
```

### CoachMessage
```
id, userId FK→User CASCADE, coachId FK→Coach CASCADE,
content, senderRole ("member"|"coach"), read (false), createdAt
@@index([userId, coachId, createdAt])
@@index([coachId, read])
@@index([userId, read])
```

### Message (user-to-user DMs)
```
id, senderId FK→User, receiverId FK→User, content, read (false), createdAt
```

### CommunityGroup
```
id, name, emoji ("👥"), description?, tags (String[]),
mod?, status ("active"|"archived"), memberIds (String[] — legacy),
createdAt, updatedAt
Relations: memberships (GroupMembership[]), posts (PeerGroupPost[])
```

### GroupMembership
```
id, memberId FK→User CASCADE, groupId FK→CommunityGroup CASCADE,
joinedAt (now), isActive (true)
@@unique([memberId, groupId])
```

### PeerGroupPost
```
id, groupId FK→CommunityGroup CASCADE, memberId FK→User CASCADE,
body, replyCount (0), supportCount (0), isFlagged (false), createdAt
@@index([groupId, createdAt])
```

### Mood
```
id, userId FK→User CASCADE, mood ("GREAT"|"GOOD"|"OKAY"|"LOW"|"HARD"),
date (midnight UTC), createdAt, updatedAt
@@unique([userId, date])
@@index([userId, date(sort: Desc)])
```

### Session
```
id, coachId, memberId, scheduledAt, duration (50), type ("Weekly Check-in"),
status ("upcoming"|"rescheduled"|"cancelled"),
notes?, cancelledBy?, rescheduleRequest?, rescheduleBy?,
createdAt, updatedAt
```

### CoachAvailability
```
id, coachId (unique), slots (Json — SlotEntry[]: {day, start, end, enabled}),
duration (50), updatedAt
```

### SessionNote
```
id, coachId FK→Coach CASCADE, memberId FK→User CASCADE,
sessionType, notes (""), nextSessionGoal (""), status ("draft"),
createdAt, updatedAt
@@index([coachId, createdAt(sort: Desc)])
```

### OnboardingAssessment
```
id, userId FK→User CASCADE, age?, identity?, gender?, orient?,
phqAnswers (Int[]), phqScore, gadAnswers (Int[]), gadScore,
createdAt, updatedAt
```

### PlatformSettings (single row, id="platform")
```
brandTitle ("Azadi Health"), brandTagline ("Mental Wellness Platform"),
logoUrl?, loaderUrl?, primaryColor ("#4E8C58"), supportEmail,
maxMembersPerCoach (20), sessionDurationDefault (50),
sessionDurationMax (90), sessionDurationMin (25),
allowSelfRegistration (true), maintenanceMode (false),
createdAt, updatedAt
```

### EmailVerification
```
id, userId FK→User CASCADE, otp (bcrypt hashed 6-digit),
expiresAt, used (false), createdAt
@@index([userId])
```

## Next.js Application (`frontend/FE/`)

### Routing Structure

**Public routes** (`(public)` group):
- `/` — landing
- `/login`, `/org-login`, `/register`, `/verify`, `/forgot-password`, `/onboarding`, `/maintenance`

**Dashboard routes** (`(dashboard)` group — all auth-protected):

Member (`user`): `/dashboard`, `/mood-mapping`, `/community-groups`, `/community-groups/[id]`, `/coaching`, `/coaching/[coachId]`, `/empowerment-kit`, `/resources`, `/profile`

Coach: `/dashboard`, `/clients`, `/sessions`, `/messages`, `/availability`, `/notes`, `/risk-dashboard`, `/settings`

Organization: `/org/dashboard`, `/org/members`, `/org/outcomes`, `/org/coaches`, `/org/settings`

Superadmin: `/admin/dashboard`, `/admin/users`, `/admin/coaches`, `/admin/groups`, `/admin/orgs`, `/admin/settings`

**Next.js API routes**:
- `POST /api/chat` — enqueue BullMQ job
- `GET /api/scores/stream` — SSE from Redis `vasl_score_updates`

### Middleware (`middleware.ts`)
- Reads `azadi_token` and `azadi_role` cookies
- Redirects unauthenticated users to `/login?next={path}`
- Redirects authenticated users away from login/register pages
- Enforces role-path permissions via `pathAllowedForRole()`
- Checks maintenance mode for login/register paths

### State Management

**Redux store** (`src/store/`):
| Slice | State |
|-------|-------|
| `auth` | `{ user: AuthUser|null, token: string|null, impersonationLabel: string|null }` |
| `user` | Admin user list |
| `coach` | Coach list |
| `organization` | Org list |
| `ui` | `{ modal: string|null }` |
| `notification` | `{ items: AppNotification[] }` |

**TanStack Query**: Used for all server data fetching. `QueryProvider` wraps the app.

**localStorage keys**:
- `vasl_risk_dashboard_v1` — risk dashboard state
- `vasl_msg_risk_{partnerId}` — per-message risk cache
- `vasl_notif_read_{userId}` — read notification IDs
- `platform_brand_title`, `platform_brand_tagline` — branding cache

### Key Components

| Component | Description |
|-----------|-------------|
| `DashboardLayout` | Main layout — sidebar + topbar. Syncs member name from API on mount. |
| `AuthHydrator` | Hydrates Redux from cookies on mount. Re-fetches name from API. |
| `CoachCard` | Coach display card with connect button. |
| `RoleSidebar` | Desktop sidebar with role-specific nav. |
| `BaseModal` | Generic modal wrapper for admin CRUD dialogs. |

### Key Hooks

| Hook | Description |
|------|-------------|
| `useCoachSocket` | Socket.IO connection to `/coach-chat`. JWT from `azadi_token` cookie. |
| `useCoachMessages` | Infinite query for thread history. Cursor pagination. Auto-marks-read. |
| `useAssignCoach` | Mutation for `POST /api/coach/assign`. Navigates on success. |
| `useRiskScoreStream` | SSE connection to `/api/scores/stream`. Persists to localStorage. |
| `useNotifications` | Member notification aggregator (poll + socket). |
| `useCoachNotifications` | Coach notification aggregator (poll + socket). |
| `usePublicPlatformSettings` | TanStack Query for public platform settings (stale 30s). |
| `useRoleGuard` | Redirects if role/path mismatch. |
| `useMaintenanceRedirect` | Redirects unauthenticated users during maintenance. |

### BullMQ Worker (`worker.mjs`)

- Concurrency: 20 parallel jobs
- Queue: `vasl_chat_inference`
- Flow: dequeue → POST to `FASTAPI_URL/v1/ingest/chat` → publish result to Redis `vasl_score_updates` → flush timing to `POST /v1/pipeline/flush/{event_id}`
- Timing: writes all stage timings to Redis hash `vasl:timing:{event_id}` (TTL 600s)

## Environment Variables

### `frontend/BE/.env.example`
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://...@localhost:5433/vasl_ts` | Prisma DB |
| `DATABASE_URL_VASL` | `postgresql://...@localhost:5432/vasl` | Python backend DB (risk data) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis |
| `JWT_SECRET` | — | Required |
| `PORT` | `4000` | Express port |
| `GMAIL_USER` | — | Gmail SMTP user |
| `GMAIL_PASS` | — | Gmail app password |
| `PYTHON_BACKEND_URL` | `http://localhost:8001` | Python FastAPI URL |
| `PYTHON_ORG_ID` | `org_univ_maryland` | Org ID for Python backend |
| `FRONTEND_URL` | `http://localhost:3000` | CORS origin for Socket.IO |

### `frontend/FE/.env.example`
| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | **Note: .env.example shows Python port but actual usage is Express port 4000** |
| `FASTAPI_URL` | `http://localhost:8000` | Python FastAPI for worker.mjs |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis for BullMQ and SSE |
| `NEXT_PUBLIC_BE_URL` | `http://localhost:4000` | Documented but unused in code |
| `ORG_ID` | `org_univ_maryland` | Default org ID for BullMQ jobs |

### Cookie Keys (`src/constants/storage.ts`)
| Constant | Value |
|----------|-------|
| `AUTH_TOKEN_KEY` | `azadi_token` |
| `AUTH_ROLE_KEY` | `azadi_role` |
| `AUTH_USER_NAME_KEY` | `azadi_display_name` |
| `AUTH_USER_JSON_KEY` | `azadi_user` |
| `AUTH_IMPERSONATION_KEY` | `azadi_impersonation` |

## Known Tech Debt

1. **`NEXT_PUBLIC_API_URL` confusion**: `.env.example` shows Python port 8000 but `api.ts` uses it for Express BE (port 4000).
2. **`NEXT_PUBLIC_BE_URL` unused**: Documented in `.env.example` but not referenced in code.
3. **Dual role string for members**: BE JWT uses `"member"`, FE `Role` type uses `"user"`. `AuthHydrator` has a bug checking `role === "member"` which can never be true after mapping.
4. **`CommunityGroup.memberIds` legacy field**: Denormalized array alongside `GroupMembership` — potential inconsistency.
5. **`Coach.organizationId` legacy field**: Never written by any controller; `OrganizationCoach` is the canonical relationship.
6. **`adminGetOrgOverview` stub fields**: `sessionsThisMonth: 0` and `avgPhqScore: null` are always hardcoded.
7. **No pagination on admin list endpoints**: `getAllUsers`, `getAllCoaches`, `adminGetOrgs` return all records.
8. **`forgotPassword` is a stub**: Always returns 200 — no reset flow implemented.
9. **Socket.IO `group_post`/`group_join` events**: `useNotifications` listens for them but no server code emits them.
10. **Two separate PostgreSQL databases**: Express BE uses `vasl_ts`, Python BE uses `vasl`. Cross-DB query via `DATABASE_URL_VASL` is a design smell.
11. **Demo email addresses in `auth-roles.ts`**: Should be removed from production.
12. **Hardcoded badge `"1"` on admin users nav**: Should be dynamic unverified user count.
