# VASL Health Frontend — Tasks

## Task 1: Authentication — Member Registration and OTP

- [ ] Verify `POST /api/auth/register` blocks registration when `allowSelfRegistration` is false
- [ ] Verify OTP email is sent on registration
- [ ] Verify OTP expires after 15 minutes
- [ ] Verify `POST /api/auth/resend-otp` invalidates previous OTPs
- [ ] Verify `POST /api/auth/verify-otp` returns JWT on success
- [ ] Verify superadmin registration requires valid `SUPERADMIN_INVITE_CODE`
- [ ] Verify coach registration returns JWT without OTP verification
- [ ] Verify duplicate email returns HTTP 409

## Task 2: Authentication — Login and Session

- [ ] Verify member login returns 503 when `maintenanceMode` is true (superadmin exempt)
- [ ] Verify unverified member login returns 403 with `userId` in body
- [ ] Verify deactivated coach login returns 403
- [ ] Verify successful login sets `azadi_token`, `azadi_role`, `azadi_user`, `azadi_display_name` cookies
- [ ] Verify 401 response clears auth cookies and redirects to `/login`
- [ ] Verify authenticated users are redirected away from `/login`, `/register`, `/org-login`
- [ ] Verify `AuthHydrator` hydrates Redux from cookies on mount
- [ ] Fix `AuthHydrator` bug: `role === "member"` check should be `role === "user"`

## Task 3: Role-Based Access Control

- [ ] Verify unauthenticated access to protected routes redirects to `/login?next={path}`
- [ ] Verify member cannot access coach/org/admin paths
- [ ] Verify organization role is always redirected to `/org/dashboard` for non-org paths
- [ ] Verify coach cannot access member/org/admin paths
- [ ] Verify superadmin can access `/admin/*` and `/dashboard`
- [ ] Verify maintenance mode redirects unauthenticated users from login/register to `/maintenance`
- [ ] Verify active sessions are not interrupted by maintenance mode

## Task 4: Coach-Member Chat

- [ ] Verify `send_message` is rejected when no `CoachMember` assignment exists
- [ ] Verify empty/whitespace content is rejected with `ValidationError`
- [ ] Verify content > 2000 chars is rejected with `ValidationError`
- [ ] Verify sender receives `message_saved` and partner receives `new_message`
- [ ] Verify member messages are forwarded to Python FastAPI (fire-and-forget)
- [ ] Verify `mark_read` emits `read_receipt` to partner
- [ ] Verify thread history uses cursor pagination (50 per page, oldest-first)
- [ ] Verify `prependMessage` updates TanStack Query cache without network refetch
- [ ] Verify `POST /read` is called on mount and window focus
- [ ] Verify coach email is sent when > 2 unread messages (throttled 1/hour)

## Task 5: Coach Assignment

- [ ] Verify member coach list is org-scoped (only `OrganizationCoach` coaches)
- [ ] Verify member with no organization gets empty coach list
- [ ] Verify assignment is blocked if coach is not in member's org
- [ ] Verify new assignment returns 201, existing returns 200
- [ ] Verify coach email is sent on new assignment (if `notifyNewClientAssigned`)
- [ ] Verify FE navigates to `/coaching/{coachId}` after assignment

## Task 6: Live Risk Score Dashboard

- [ ] Verify SSE connection is established to `/api/scores/stream`
- [ ] Verify `score_update` events update member score cards
- [ ] Verify SSE route subscribes to Redis `vasl_score_updates` channel
- [ ] Verify heartbeat is sent every 20 seconds
- [ ] Verify historical data is loaded from `GET /api/coach/scores/history` on mount
- [ ] Verify risk state is persisted to `localStorage` under `vasl_risk_dashboard_v1`
- [ ] Verify cross-tab sync via `storage` events

## Task 7: Risk Score Overlay in Messages

- [ ] Verify risk tier badges appear on member messages
- [ ] Verify banner appears for 8 seconds on new score update for active thread
- [ ] Verify thread is refetched 2.5 seconds after score update
- [ ] Verify right panel shows risk score, tier, trend, recommended action, signals

## Task 8: Mood Tracking

- [ ] Verify `POST /api/mood/` validates mood is one of `GREAT`, `GOOD`, `OKAY`, `LOW`, `HARD`
- [ ] Verify duplicate mood for same day returns unique constraint error
- [ ] Verify `GET /api/mood/today` returns `{ logged: boolean }`
- [ ] Verify trend data includes `averageMood`, `mostFrequentMood`, `consistency`

## Task 9: Community Groups

- [ ] Verify `POST /api/groups/:id/join` creates `GroupMembership` record
- [ ] Verify post creation triggers `forwardPeerPostToSentiment` (fire-and-forget)
- [ ] Verify `GET /api/groups/recent-posts` returns posts for notification system
- [ ] Verify admin archive sets `status: "archived"`
- [ ] Verify flagged posts appear in admin activity feed

## Task 10: Session Booking

- [ ] Verify booking is blocked if coach is not in member's org
- [ ] Verify booking validates day against coach's enabled availability slots
- [ ] Verify coach slot conflict returns HTTP 409
- [ ] Verify member time conflict returns HTTP 409
- [ ] Verify coach email is sent on booking (if `notifySessionReminders`)
- [ ] Verify reschedule validates new date is in the future
- [ ] Verify reschedule checks for coach conflicts

## Task 11: Session Notes

- [ ] Verify only coach role can create/update/delete notes
- [ ] Verify new notes default to `status: "draft"`
- [ ] Verify `GET /api/session-notes/coach/:coachId` returns all coach notes

## Task 12: Onboarding Assessment

- [ ] Verify `POST /api/onboarding/` stores PHQ and GAD answers and scores
- [ ] Verify `GET /api/onboarding/me` returns most recent assessment
- [ ] Verify PHQ-8 labels: Minimal (0–4), Mild (5–9), Moderate (10–14), Severe (15+)

## Task 13: Organization Portal

- [ ] Verify `GET /api/org/overview` returns all required metrics
- [ ] Verify `GET /api/org/outcomes` returns PHQ/GAD improvement and retention
- [ ] Verify org settings update `notifyWeeklyReport`, `notifyCrisisAlerts`, `notifyNewMembers`

## Task 14: Superadmin Platform Management

- [ ] Verify coach creation supports multiple `organizationIds[]`
- [ ] Verify coach removal sets `isActive: false` (soft delete)
- [ ] Verify platform settings update all configurable fields
- [ ] Verify logo/loader upload accepts base64 and saves to `public/uploads/`
- [ ] Verify admin activity feed shows last 30 days of events

## Task 15: Notification System

- [ ] Verify notifications are polled every 60 seconds
- [ ] Verify read state is persisted to `localStorage`
- [ ] Verify notifications are suppressed when viewing relevant thread/group
- [ ] Verify daily mood check-in reminder appears when mood not logged today

## Task 16: Email Notifications

- [ ] Verify OTP email is sent on registration
- [ ] Verify coach email on new client assignment
- [ ] Verify coach email on unread messages (throttled, > 2 unread)
- [ ] Verify session emails on book/reschedule/cancel
- [ ] Verify org crisis alert email on high/crisis risk tier
- [ ] Verify weekly outcome report sent every Monday
- [ ] Verify daily new member digest sent when `notifyNewMembers` is true

## Task 17: Bug Fixes and Tech Debt

- [ ] Fix `AuthHydrator`: `role === "member"` should be `role === "user"` (FE role mapping)
- [ ] Fix `NEXT_PUBLIC_API_URL` in `frontend/FE/.env.example` — should point to Express BE (port 4000)
- [ ] Remove unused `NEXT_PUBLIC_BE_URL` from `.env.example` or wire it up
- [ ] Remove demo email addresses from `auth-roles.ts` for production
- [ ] Add pagination to `getAllUsers`, `getAllCoaches`, `adminGetOrgs` endpoints
- [ ] Implement `forgotPassword` password reset flow
- [ ] Fix `adminGetOrgOverview` stub fields (`sessionsThisMonth`, `avgPhqScore`)
- [ ] Remove legacy `CommunityGroup.memberIds` field or sync it with `GroupMembership`
- [ ] Remove legacy `Coach.organizationId` field (use `OrganizationCoach` only)
- [ ] Make admin users nav badge dynamic (unverified user count)
- [ ] Implement server-side `group_post` and `group_join` Socket.IO events for real-time group notifications

## Task 18: Tests

- [ ] Verify `useCoachMessages` — POST /read called on mount
- [ ] Verify `useCoachMessages` — POST /read called on window focus
- [ ] Verify `useCoachMessages` — `prependMessage` updates cache without refetch
- [ ] Verify `useCoachSocket` — connects with JWT from cookie
- [ ] Verify `useCoachSocket` — disconnects on unmount
- [ ] Verify `useCoachSocket` — `sendMessage` emits `send_message` event
- [ ] Verify `saveMessage` — rejects empty content
- [ ] Verify `saveMessage` — rejects content > 2000 chars
- [ ] Verify `saveMessage` — rejects missing `CoachMember` assignment
- [ ] Verify `markRead` — member reader marks coach-sent messages
- [ ] Verify `markRead` — coach reader marks member-sent messages
- [ ] Verify `getThread` — cursor pagination returns correct order
- [ ] Verify `forwardToSentiment` — never throws
- [ ] Verify `forwardToSentiment` — truncates text to 500 chars
- [ ] Verify `forwardToSentiment` — generates unique event_id per call
- [ ] PBT: cursor round-trip stability
- [ ] PBT: content validation rejection for all invalid inputs
- [ ] PBT: assignment guard enforcement for all (userId, coachId) pairs
- [ ] PBT: sentiment truncation for all content lengths
- [ ] PBT: pagination completeness — following all cursors yields exactly N messages
