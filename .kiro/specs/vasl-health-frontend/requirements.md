# VASL Health Frontend — Requirements

## Introduction

The frontend consists of two services: an Express/TypeScript backend (`frontend/BE/`) serving REST and WebSocket APIs, and a Next.js application (`frontend/FE/`) providing the member, coach, organization, and superadmin portals. This document captures all functional requirements discovered from reading the source code.

## Glossary

- **member**: Platform user accessing wellness features (FE role: `"user"`, JWT role: `"member"`)
- **coach**: Wellness coach managing clients and sessions
- **organization**: Institutional partner managing members and coaches
- **superadmin**: Platform administrator with full access
- **CoachMember**: Assignment record linking a coach to a member
- **OrganizationCoach**: Assignment record linking a coach to an organization
- **SSE**: Server-Sent Events — used for real-time risk score streaming
- **BullMQ**: Redis-backed job queue used for LLM inference jobs

---

## Requirement 1: Member Registration with OTP Verification

**User Story:** As a new member, I want to register with my email and receive a verification code, so that my account is confirmed before I can access the platform.

### Acceptance Criteria

1. WHEN a member registers, THEN the system SHALL create an unverified account and send a 6-digit OTP to their email.
2. WHEN `allowSelfRegistration` platform setting is `false`, THEN the system SHALL return HTTP 403 and block registration.
3. WHEN an OTP is submitted, THEN the system SHALL validate it is unused and not expired (15-minute TTL).
4. WHEN an OTP is verified successfully, THEN the system SHALL mark the account as verified and return a JWT.
5. WHEN `resend-otp` is called, THEN the system SHALL invalidate all previous OTPs and send a fresh one.
6. WHEN a superadmin registers, THEN the system SHALL require a valid `SUPERADMIN_INVITE_CODE`.
7. WHEN a coach registers, THEN the system SHALL NOT require email verification — JWT is issued immediately.

## Requirement 2: Login and Session Management

**User Story:** As a user, I want to log in with my email and password, so that I can access my portal securely.

### Acceptance Criteria

1. WHEN a member logs in and `maintenanceMode` is `true`, THEN the system SHALL return HTTP 503 (superadmin is exempt).
2. WHEN a member logs in with an unverified account, THEN the system SHALL return HTTP 403 with `userId` in the response body.
3. WHEN a coach logs in with a deactivated account, THEN the system SHALL return HTTP 403.
4. WHEN login succeeds, THEN the system SHALL store `azadi_token`, `azadi_role`, `azadi_user`, `azadi_display_name` cookies with 7-day expiry.
5. WHEN a 401 response is received anywhere, THEN the system SHALL clear all auth cookies and redirect to `/login`.
6. WHEN an authenticated user visits `/login`, `/register`, or `/org-login`, THEN the system SHALL redirect them to their role's default path.

## Requirement 3: Role-Based Access Control

**User Story:** As the system, I want to enforce role-based path access, so that users can only navigate to pages appropriate for their role.

### Acceptance Criteria

1. WHEN a user navigates to a protected route without a valid token, THEN the system SHALL redirect to `/login?next={path}`.
2. WHEN a member (`user`) accesses a non-member path, THEN the system SHALL redirect to `/dashboard`.
3. WHEN an organization user accesses a non-`/org/` path, THEN the system SHALL redirect to `/org/dashboard`.
4. WHEN a coach accesses a non-coach path, THEN the system SHALL redirect to `/dashboard`.
5. WHEN a superadmin accesses a non-admin path, THEN the system SHALL redirect to `/admin/dashboard`.
6. IF `maintenanceMode` is `true` AND the user has no active session, THEN the system SHALL redirect login/register paths to `/maintenance`.

## Requirement 4: Coach-Member Chat

**User Story:** As a member or coach, I want to send and receive messages in real time, so that I can communicate with my assigned coach or client.

### Acceptance Criteria

1. WHEN a message is sent, THEN the system SHALL verify a `CoachMember` assignment exists before persisting.
2. WHEN message content is empty or whitespace-only, THEN the system SHALL reject with `ValidationError`.
3. WHEN message content exceeds 2000 characters, THEN the system SHALL reject with `ValidationError`.
4. WHEN a message is saved, THEN the sender SHALL receive `message_saved` and the partner SHALL receive `new_message` via Socket.IO.
5. WHEN a member sends a message, THEN the system SHALL forward it to the Python FastAPI `/v1/ingest/chat` (fire-and-forget).
6. WHEN a member sends a message and the coach has > 2 unread messages, THEN the system SHALL email the coach (throttled to once per hour per thread, if `notifyMessageAlerts` is enabled).
7. WHEN `mark_read` is emitted, THEN the system SHALL mark the partner's messages as read and emit `read_receipt` to the partner.
8. WHEN thread history is fetched, THEN the system SHALL use cursor-based pagination (50 messages per page, oldest-first display).

## Requirement 5: Coach Assignment

**User Story:** As a member, I want to select a coach from my organization, so that I can begin a coaching relationship.

### Acceptance Criteria

1. WHEN a member requests the coach list, THEN the system SHALL return only coaches assigned to the member's organization via `OrganizationCoach`.
2. WHEN a member has no organization, THEN the system SHALL return an empty coach list.
3. WHEN a member assigns a coach, THEN the system SHALL verify the coach is in the member's organization before creating the `CoachMember` record.
4. WHEN a new assignment is created, THEN the system SHALL return HTTP 201; if already assigned, HTTP 200.
5. WHEN a new assignment is created, THEN the system SHALL email the coach (if `notifyNewClientAssigned` is enabled).
6. WHEN assignment succeeds, THEN the FE SHALL navigate to `/coaching/{coachId}`.

## Requirement 6: Live Risk Score Dashboard

**User Story:** As a coach, I want to see real-time risk scores for my clients, so that I can identify members who need immediate attention.

### Acceptance Criteria

1. WHEN the risk dashboard loads, THEN the system SHALL connect to `GET /api/scores/stream` SSE endpoint.
2. WHEN a `score_update` SSE event is received, THEN the system SHALL update the member's score card and activity log.
3. WHEN the SSE route receives a Redis `vasl_score_updates` message, THEN it SHALL forward it as `data: {type: "score_update", payload: {...}}`.
4. WHEN the SSE connection is established, THEN the system SHALL send a heartbeat every 20 seconds.
5. WHEN the dashboard loads, THEN the system SHALL hydrate historical data from `GET /api/coach/scores/history`.
6. WHEN risk state is updated, THEN the system SHALL persist it to `localStorage` under `vasl_risk_dashboard_v1`.
7. WHEN another browser tab updates risk state, THEN the system SHALL sync via `storage` events.

## Requirement 7: Risk Score Overlay in Messages

**User Story:** As a coach, I want to see risk tier badges on member messages, so that I can identify high-risk messages in context.

### Acceptance Criteria

1. WHEN a coach views a message thread, THEN the system SHALL display risk tier badges on member messages (tier emoji, tier name, score %, top 2 signal codes).
2. WHEN a new score update arrives for the active thread, THEN the system SHALL show a banner for 8 seconds.
3. WHEN a score update arrives, THEN the system SHALL refetch the thread after 2.5 seconds to pick up DB-stored risk data.
4. WHEN the right panel is visible, THEN the system SHALL show risk score, tier, trend, recommended action, and up to 6 active signals with confidence bars.

## Requirement 8: Mood Tracking

**User Story:** As a member, I want to log my daily mood and view trends, so that I can track my emotional wellbeing over time.

### Acceptance Criteria

1. WHEN a mood is submitted, THEN the system SHALL validate it is one of `GREAT`, `GOOD`, `OKAY`, `LOW`, `HARD`.
2. WHEN a mood is submitted for a day that already has an entry, THEN the system SHALL reject with a unique constraint error.
3. WHEN `GET /api/mood/today` is called, THEN the system SHALL return `{ logged: boolean }`.
4. WHEN mood trends are requested, THEN the system SHALL return `averageMood`, `mostFrequentMood`, `consistency`, and per-day records for 7, 30, or 60 days.

## Requirement 9: Community Groups

**User Story:** As a member, I want to join community groups and post in them, so that I can connect with peers.

### Acceptance Criteria

1. WHEN a member joins a group, THEN the system SHALL create a `GroupMembership` record.
2. WHEN a member creates a post in a group, THEN the system SHALL forward it to the Python backend for peer-post sentiment analysis (fire-and-forget).
3. WHEN `GET /api/groups/recent-posts` is called, THEN the system SHALL return recent posts across the member's joined groups.
4. WHEN an admin archives a group, THEN the system SHALL set `status: "archived"`.
5. WHEN a post is flagged (`isFlagged: true`), THEN it SHALL appear in the admin activity feed.

## Requirement 10: Session Booking and Management

**User Story:** As a member, I want to book a coaching session, so that I can schedule time with my coach.

### Acceptance Criteria

1. WHEN a member books a session, THEN the system SHALL verify the coach is in the member's organization.
2. WHEN a coach has availability slots configured, THEN the system SHALL validate the requested day is an enabled slot day.
3. WHEN a slot is already booked by the coach, THEN the system SHALL return HTTP 409.
4. WHEN a member already has a session at the requested time, THEN the system SHALL return HTTP 409.
5. WHEN a session is booked, THEN the system SHALL email the coach (if `notifySessionReminders` is enabled).
6. WHEN a session is cancelled or rescheduled, THEN the system SHALL email the other party (if `notifySessionReminders` is enabled).
7. WHEN rescheduling, THEN the system SHALL validate the new date is in the future and check for coach conflicts.

## Requirement 11: Session Notes

**User Story:** As a coach, I want to create and manage session notes, so that I can track client progress.

### Acceptance Criteria

1. WHEN a session note is created, THEN the system SHALL require coach role.
2. WHEN a session note is created, THEN the system SHALL default `status` to `"draft"`.
3. WHEN `GET /api/session-notes/coach/:coachId` is called, THEN the system SHALL return all notes for that coach.

## Requirement 12: Onboarding Assessment

**User Story:** As a new member, I want to complete a PHQ-8 and GAD-7 assessment during onboarding, so that my baseline mental health is recorded.

### Acceptance Criteria

1. WHEN an assessment is submitted, THEN the system SHALL store `phqAnswers[]`, `phqScore`, `gadAnswers[]`, `gadScore`, and demographic fields.
2. WHEN `GET /api/onboarding/me` is called, THEN the system SHALL return the member's most recent assessment.
3. WHEN displaying PHQ-8 scores, THEN the system SHALL label: Minimal (0–4), Mild (5–9), Moderate (10–14), Severe (15+).

## Requirement 13: Organization Portal

**User Story:** As an organization contact, I want to view member engagement and outcomes, so that I can assess the effectiveness of the wellness program.

### Acceptance Criteria

1. WHEN `GET /api/org/overview` is called, THEN the system SHALL return `totalMembers`, `activeMembers`, `engagementRate`, `sessionsThisMonth`, `avgPhqScore`, `moodDistribution`, `engagementSeries` (14-day), and `completionStats`.
2. WHEN `GET /api/org/outcomes` is called, THEN the system SHALL return PHQ improvement, GAD improvement, retention rate, PHQ distribution by severity, and key metrics.
3. WHEN org settings are updated, THEN the system SHALL allow updating `name`, `type`, `notifyWeeklyReport`, `notifyCrisisAlerts`, `notifyNewMembers`.

## Requirement 14: Superadmin Platform Management

**User Story:** As a superadmin, I want full CRUD control over users, coaches, groups, and organizations, so that I can manage the platform.

### Acceptance Criteria

1. WHEN a coach is created, THEN the system SHALL support assigning multiple organizations via `organizationIds[]`.
2. WHEN a coach is removed, THEN the system SHALL set `isActive: false` (soft delete).
3. WHEN platform settings are updated, THEN the system SHALL support `brandTitle`, `brandTagline`, `logoUrl`, `loaderUrl`, `primaryColor`, `supportEmail`, `maxMembersPerCoach`, `sessionDurationDefault/Max/Min`, `allowSelfRegistration`, `maintenanceMode`.
4. WHEN a logo or loader is uploaded, THEN the system SHALL accept base64 and save to `public/uploads/`.
5. WHEN `GET /api/admin/activity` is called, THEN the system SHALL return the last 30 days of: new users, group joins, flagged posts, new orgs, new coaches.

## Requirement 15: Notification System

**User Story:** As a user, I want to receive notifications about messages, sessions, and group activity, so that I stay informed without constantly checking the app.

### Acceptance Criteria

1. WHEN notifications are fetched, THEN the system SHALL poll every 60 seconds and merge with real-time socket events.
2. WHEN a notification is read, THEN the system SHALL persist the read state to `localStorage` under `vasl_notif_read_{userId}`.
3. WHEN a user is actively viewing the relevant thread or group, THEN the system SHALL suppress that notification.
4. WHEN a member has not logged their mood today, THEN the system SHALL show a daily check-in reminder (if `notifyDailyCheckin` is enabled).

## Requirement 16: Email Notifications

**User Story:** As the system, I want to send transactional emails for key events, so that users are informed even when not using the app.

### Acceptance Criteria

1. WHEN a member registers, THEN the system SHALL send an OTP verification email via Gmail SMTP.
2. WHEN a coach is assigned a new client, THEN the system SHALL email the coach (if `notifyNewClientAssigned` is enabled).
3. WHEN a coach has > 2 unread messages from a member, THEN the system SHALL email the coach (throttled to once per hour per thread, if `notifyMessageAlerts` is enabled).
4. WHEN a session is booked, rescheduled, or cancelled, THEN the system SHALL email the other party (if `notifySessionReminders` is enabled).
5. WHEN a member is flagged at crisis or high risk, THEN the system SHALL email the org contact (if `notifyCrisisAlerts` is enabled).
6. WHEN `notifyWeeklyReport` is enabled, THEN the system SHALL email the org contact every Monday with an outcomes summary.
7. WHEN `notifyNewMembers` is enabled, THEN the system SHALL email the org contact a daily digest of new members.

## Requirement 17: Platform Branding and Maintenance Mode

**User Story:** As a superadmin, I want to configure platform branding and enable maintenance mode, so that I can customize the platform and control access during downtime.

### Acceptance Criteria

1. WHEN `maintenanceMode` is enabled, THEN the system SHALL redirect unauthenticated users from login/register to `/maintenance`.
2. WHEN `maintenanceMode` is enabled, THEN active sessions SHALL NOT be interrupted.
3. WHEN brand settings are updated, THEN the FE SHALL cache `brandTitle` and `brandTagline` in `localStorage`.
