# Requirements Document

## Introduction

This feature replaces the existing mock-data messaging system with a fully persistent, real-time member↔coach messaging system. Each member–coach pair shares exactly one conversation thread that persists across sessions. Member messages are asynchronously forwarded to the Python sentiment/risk pipeline; coach messages are never forwarded. Real-time delivery is handled by Socket.IO mounted on the existing Express process. The feature introduces a new `CoachMessage` Prisma model, new REST and WebSocket endpoints, and updated Next.js pages that replace mock state with TanStack Query and a Socket.IO client hook.

---

## Glossary

- **CoachMessage**: The Prisma database model that stores a single message exchanged between a member and a coach.
- **CoachMessageService**: The backend service class that encapsulates all database operations for coach messages.
- **CoachMember**: The existing Prisma join-table model that records a valid assignment between a coach and a member.
- **SentimentForwarder**: The backend utility that fire-and-forgets member messages to the Python sentiment pipeline.
- **Socket.IO_Server**: The Socket.IO server instance mounted on the `/coach-chat` namespace of the existing Express HTTP server.
- **Socket.IO_Client**: The browser-side Socket.IO client managed by the `useCoachSocket` hook.
- **useCoachSocket**: The frontend React hook that manages the Socket.IO connection lifecycle.
- **useCoachMessages**: The frontend React hook that wraps TanStack Query for paginated message history.
- **Thread**: The ordered sequence of all `CoachMessage` rows sharing the same `(userId, coachId)` pair.
- **ThreadPage**: A single page of messages returned by the REST API, containing a message array and an optional `nextCursor`.
- **Cursor**: An opaque, base64-encoded token encoding `{ createdAt, id }` used for stable cursor-based pagination.
- **CoachMessageDTO**: The JSON shape of a message as returned by the API and emitted over WebSocket.
- **ChatIngestPayload**: The JSON body sent to the Python backend's `POST /v1/ingest/chat` endpoint.
- **Assignment_Guard**: The server-side check that a `CoachMember` row exists for a `(userId, coachId)` pair before any message is persisted.
- **Personal_Room**: A Socket.IO room named `user:{id}` for members or `coach:{id}` for coaches, used for targeted delivery.
- **Python_Backend**: The Python FastAPI service running on port 8000 that performs sentiment and risk analysis.

---

## Requirements

### Requirement 1: Persistent CoachMessage Data Model

**User Story:** As a platform engineer, I want a dedicated `CoachMessage` database model, so that member–coach conversations are stored persistently and independently of the existing User↔User `Message` model.

#### Acceptance Criteria

1. THE CoachMessage model SHALL have fields: `id` (CUID primary key), `userId` (FK → User), `coachId` (FK → Coach), `content` (String), `senderRole` (String), `read` (Boolean, default false), `createdAt` (DateTime, default now), `updatedAt` (DateTime, auto-updated).
2. THE CoachMessage model SHALL declare a composite index on `(userId, coachId, createdAt)` to support thread fetch and cursor pagination queries.
3. THE CoachMessage model SHALL declare an index on `(coachId, read)` to support unread count queries for the coach sidebar.
4. THE CoachMessage model SHALL declare an index on `(userId, read)` to support unread count queries for the member sidebar.
5. THE CoachMessage model SHALL declare cascade-delete relations to both the `User` model (via `@relation("CoachMessages")`) and the `Coach` model (via `@relation("CoachMessages")`), so that messages are removed when either party is deleted.
6. THE User model SHALL gain a `coachMessages` relation field referencing `CoachMessage[]` via the `"CoachMessages"` relation name.
7. THE Coach model SHALL gain a `coachMessages` relation field referencing `CoachMessage[]` via the `"CoachMessages"` relation name.
8. THE existing `Message` model SHALL remain unchanged in the schema.

---

### Requirement 2: Message Content Validation

**User Story:** As a platform engineer, I want all messages validated before persistence, so that invalid data never reaches the database.

#### Acceptance Criteria

1. WHEN a message is submitted with an empty `content` field, THEN THE CoachMessageService SHALL reject the message and return a validation error without writing to the database.
2. WHEN a message is submitted with a `content` field exceeding 2000 characters, THEN THE CoachMessageService SHALL reject the message and return a validation error without writing to the database.
3. WHEN a message is submitted with a `senderRole` value other than `"member"` or `"coach"`, THEN THE CoachMessageService SHALL reject the message and return a validation error without writing to the database.
4. THE CoachMessageService SHALL truncate `content` to 500 characters before constructing the `ChatIngestPayload` sent to the Python backend, while preserving the full content in the database.

---

### Requirement 3: Assignment Guard

**User Story:** As a security engineer, I want every message send attempt to verify a valid coach–member assignment exists, so that users cannot message coaches they are not assigned to.

#### Acceptance Criteria

1. WHEN a socket client emits `send_message` with a `partnerId`, THEN THE Socket.IO_Server SHALL query the `CoachMember` table for a row matching `(userId, coachId)` before persisting any message.
2. IF no `CoachMember` row exists for the `(userId, coachId)` pair, THEN THE Socket.IO_Server SHALL emit an `error` event to the sender with `{ code: "UNAUTHORIZED_THREAD", message: "No assignment found" }` and SHALL NOT persist the message.
3. THE Assignment_Guard SHALL be enforced for both member-initiated and coach-initiated `send_message` events.

---

### Requirement 4: Real-Time Message Delivery via Socket.IO

**User Story:** As a member or coach, I want messages to be delivered in real time, so that conversations feel immediate without requiring page refreshes.

#### Acceptance Criteria

1. THE Socket.IO_Server SHALL be mounted on the `/coach-chat` namespace of the existing Express HTTP server.
2. WHEN a socket client connects to `/coach-chat`, THE Socket.IO_Server SHALL authenticate the connection by validating the JWT provided in `socket.handshake.auth.token` using the same secret as the HTTP `authMiddleware`.
3. IF a socket client connects with an invalid or expired JWT, THEN THE Socket.IO_Server SHALL reject the connection by calling `next(new Error("Unauthorized"))`.
4. WHEN a socket client successfully authenticates, THE Socket.IO_Server SHALL place the socket in a Personal_Room named `user:{id}` for members or `coach:{id}` for coaches.
5. WHEN a `send_message` event is received and the Assignment_Guard passes, THE Socket.IO_Server SHALL persist the message via `CoachMessageService.saveMessage` and emit a `message_saved` event containing the `CoachMessageDTO` back to the sender's socket.
6. WHEN a message is saved, THE Socket.IO_Server SHALL emit a `new_message` event containing the `CoachMessageDTO` to the partner's Personal_Room.
7. WHEN a `mark_read` event is received, THE Socket.IO_Server SHALL call `CoachMessageService.markRead` and emit a `read_receipt` event to the partner's Personal_Room.
8. WHEN a `join_thread` event is received, THE Socket.IO_Server SHALL ensure the socket is subscribed to its Personal_Room (idempotent operation).

---

### Requirement 5: Sentiment Pipeline Integration

**User Story:** As a clinical operations engineer, I want member messages forwarded to the Python sentiment pipeline asynchronously, so that risk analysis runs without affecting message delivery latency.

#### Acceptance Criteria

1. WHEN a member message is saved, THE SentimentForwarder SHALL initiate a fire-and-forget HTTP POST to `{PYTHON_BACKEND_URL}/v1/ingest/chat` with a `ChatIngestPayload`.
2. THE ChatIngestPayload SHALL contain: `event_id` (UUID v4), `org_id` (from env `PYTHON_ORG_ID`), `member_token` (the User's internal CUID `id`), `session_id` (formatted as `"{userId}_{coachId}"`), `role` set to `"member"`, `text` (content truncated to 500 characters), `timestamp` (ISO 8601 string of `createdAt`), and `consent_active` set to `true`.
3. THE SentimentForwarder SHALL apply a 5-second timeout to the HTTP POST request using `AbortSignal.timeout(5000)`.
4. IF the HTTP POST to the Python backend fails or times out, THEN THE SentimentForwarder SHALL log the error to the console and SHALL NOT propagate the error to the caller.
5. THE SentimentForwarder SHALL return `void` synchronously and SHALL NOT block or delay the `message_saved` event delivery to the sender.
6. WHEN a coach message is saved, THE SentimentForwarder SHALL NOT be called.

---

### Requirement 6: REST API for Message History

**User Story:** As a member or coach, I want to load my conversation history via a REST endpoint, so that past messages are available when I open a chat thread.

#### Acceptance Criteria

1. THE CoachMessageService SHALL expose a `GET /api/coach-messages/:partnerId` endpoint protected by `authMiddleware`.
2. WHEN `GET /api/coach-messages/:partnerId` is called, THE CoachMessageService SHALL return a `ThreadPage` containing a `messages` array and a `nextCursor` field.
3. WHEN `GET /api/coach-messages/:partnerId` is called without a `cursor` query parameter, THE CoachMessageService SHALL return the most recent messages up to the specified `limit` (default 50, maximum 100).
4. WHEN `GET /api/coach-messages/:partnerId` is called with a valid `cursor` query parameter, THE CoachMessageService SHALL return the next older page of messages without duplicating any message from the previous page.
5. WHEN `GET /api/coach-messages/:partnerId` is called and no messages exist for the thread, THE CoachMessageService SHALL return an empty `messages` array and `nextCursor` set to `null`.
6. THE CoachMessageService SHALL return messages in ascending chronological order (oldest first) within each page.
7. THE CoachMessageService SHALL expose a `POST /api/coach-messages/:partnerId/read` endpoint protected by `authMiddleware` that marks all unread messages in the thread as read for the authenticated user.
8. WHEN `POST /api/coach-messages/:partnerId/read` is called, THE CoachMessageService SHALL return `{ updated: N }` where N is the count of rows updated.

---

### Requirement 7: Cursor-Based Pagination

**User Story:** As a platform engineer, I want cursor-based pagination for message history, so that large conversation threads load efficiently without full-table scans.

#### Acceptance Criteria

1. THE CoachMessageService SHALL implement cursor-based pagination using a composite cursor encoding `{ createdAt, id }` as a base64 string.
2. WHEN a cursor is provided, THE CoachMessageService SHALL fetch only messages older than the cursor position, using `createdAt` as the primary sort key and `id` as the tiebreaker.
3. THE CoachMessageService SHALL fetch `limit + 1` rows from the database to determine whether a next page exists, then return only `limit` rows to the caller.
4. WHEN the number of fetched rows exceeds `limit`, THE CoachMessageService SHALL set `nextCursor` to the base64-encoded `{ createdAt, id }` of the last returned message.
5. WHEN the number of fetched rows does not exceed `limit`, THE CoachMessageService SHALL set `nextCursor` to `null`.
6. FOR ALL valid threads with N total messages, paginating with any valid `limit` between 1 and 100 and following all `nextCursor` values SHALL yield exactly N distinct messages with no duplicates and no gaps.

---

### Requirement 8: Read Receipts and Unread Counts

**User Story:** As a coach or member, I want to see unread message counts in the sidebar, so that I know when new messages are waiting for me.

#### Acceptance Criteria

1. WHEN `CoachMessageService.markRead` is called by an authenticated user, THE CoachMessageService SHALL update to `read = true` only the `CoachMessage` rows where the authenticated user is the receiver and `read = false`.
2. THE CoachMessageService SHALL NOT modify any `CoachMessage` rows where the authenticated user is the sender.
3. THE CoachMessageService SHALL return the count of rows updated (≥ 0) from `markRead`.
4. THE CoachMessageService SHALL expose a `getConversationList` method that returns a `ConversationSummary[]` for all threads belonging to the authenticated user or coach.
5. WHEN `getConversationList` is called, each `ConversationSummary` SHALL include: `partnerId`, `partnerName`, `partnerAvatar`, `lastMessage` (content of the most recent message), `lastMessageAt` (timestamp of the most recent message), and `unreadCount` (count of unread messages where the caller is the receiver).

---

### Requirement 9: Frontend Socket Hook (useCoachSocket)

**User Story:** As a frontend developer, I want a `useCoachSocket` hook that manages the Socket.IO connection, so that chat pages can send and receive messages without managing connection lifecycle manually.

#### Acceptance Criteria

1. THE useCoachSocket hook SHALL connect to the `/coach-chat` Socket.IO namespace on mount and disconnect on unmount.
2. THE useCoachSocket hook SHALL attach the JWT from `localStorage.getItem("vasl_token")` to `socket.handshake.auth.token` at connection time.
3. THE useCoachSocket hook SHALL expose an `isConnected` boolean that reflects the current connection state.
4. THE useCoachSocket hook SHALL expose a `sendMessage(partnerId: string, content: string): void` function that emits a `send_message` event to the server.
5. WHEN a `new_message` event is received, THE useCoachSocket hook SHALL invoke the `onNewMessage` callback provided by the caller with the `CoachMessageDTO` payload.
6. WHEN a `read_receipt` event is received, THE useCoachSocket hook SHALL invoke the `onReadReceipt` callback provided by the caller with the receipt payload.
7. THE useCoachSocket hook SHALL rely on Socket.IO's built-in automatic reconnection with exponential backoff.
8. IF the socket connection is rejected with an `Unauthorized` error, THE useCoachSocket hook SHALL redirect the browser to `/login`.

---

### Requirement 10: Frontend Query Hook (useCoachMessages)

**User Story:** As a frontend developer, I want a `useCoachMessages` hook that fetches paginated message history, so that chat pages can display conversation history with infinite scroll.

#### Acceptance Criteria

1. THE useCoachMessages hook SHALL use `useInfiniteQuery` from TanStack Query to fetch message history from `GET /api/coach-messages/:partnerId`.
2. THE useCoachMessages hook SHALL expose `messages` (flat array of all loaded `CoachMessageDTO`), `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, and `isLoading`.
3. WHEN a new message is received via the `useCoachSocket` hook, THE useCoachMessages hook SHALL prepend the message to the TanStack Query cache via `queryClient.setQueryData` without triggering a network refetch.
4. WHEN the hook mounts, THE useCoachMessages hook SHALL call `POST /api/coach-messages/:partnerId/read` to mark messages as read.
5. WHEN the browser tab regains focus, THE useCoachMessages hook SHALL call `POST /api/coach-messages/:partnerId/read` to mark any new messages as read.

---

### Requirement 11: Member Chat Page

**User Story:** As a member, I want a persistent chat interface on the `/coaching/[coachId]` page, so that I can send and receive messages with my assigned coach.

#### Acceptance Criteria

1. THE Member_Chat_Page at `/coaching/[coachId]` SHALL replace the existing mock message state with data from `useCoachMessages` and `useCoachSocket`.
2. WHEN a member submits a message, THE Member_Chat_Page SHALL call `sendMessage(coachId, content)` from `useCoachSocket` and clear the input field.
3. WHEN a `message_saved` event is received, THE Member_Chat_Page SHALL display the sent message in the conversation thread.
4. WHEN a `new_message` event is received from the coach, THE Member_Chat_Page SHALL append the message to the conversation thread without a page reload.
5. WHEN the page loads, THE Member_Chat_Page SHALL display a loading state while `useCoachMessages` fetches the initial page of history.
6. WHEN `hasNextPage` is true, THE Member_Chat_Page SHALL provide a mechanism for the member to load older messages.

---

### Requirement 12: Coach Messages Page

**User Story:** As a coach, I want a persistent messages page at `/messages`, so that I can view and respond to all my assigned members' messages in one place.

#### Acceptance Criteria

1. THE Coach_Messages_Page at `/messages` SHALL replace the existing static `CLIENTS` array and mock message state with data from `useCoachMessages`, `useCoachSocket`, and `CoachMessageService.getConversationList`.
2. WHEN the coach selects a member conversation, THE Coach_Messages_Page SHALL load that thread's history via `useCoachMessages`.
3. WHEN a coach submits a message, THE Coach_Messages_Page SHALL call `sendMessage(userId, content)` from `useCoachSocket` and clear the input field.
4. WHEN a `new_message` event is received for the active thread, THE Coach_Messages_Page SHALL append the message to the conversation thread.
5. THE Coach_Messages_Page sidebar SHALL display the `unreadCount` from `ConversationSummary` for each member, updating in real time when `read_receipt` events are received.
6. WHEN a member conversation is selected, THE Coach_Messages_Page SHALL call `POST /api/coach-messages/:partnerId/read` to clear the unread indicator for that member.

---

### Requirement 13: CoachMessageDTO Shape

**User Story:** As a frontend developer, I want a consistent message data shape from both the REST API and WebSocket events, so that I can use the same rendering logic for both sources.

#### Acceptance Criteria

1. THE CoachMessageDTO returned by `GET /api/coach-messages/:partnerId` SHALL contain: `id` (string), `userId` (string), `coachId` (string), `content` (string), `senderRole` (`"member"` | `"coach"`), `read` (boolean), `createdAt` (ISO 8601 string).
2. THE `message_saved` WebSocket event payload SHALL use the same `CoachMessageDTO` shape as the REST API response.
3. THE `new_message` WebSocket event payload SHALL use the same `CoachMessageDTO` shape as the REST API response.

---

### Requirement 14: Error Handling

**User Story:** As a user, I want clear error feedback when a message cannot be sent, so that I know to retry rather than assuming the message was delivered.

#### Acceptance Criteria

1. IF `CoachMessage.create` throws a database error, THEN THE Socket.IO_Server SHALL emit an `error` event to the sender with `{ code: "SAVE_FAILED", message: "Message could not be saved" }`.
2. IF the Python backend is unavailable or times out, THEN THE SentimentForwarder SHALL log the error and continue without affecting message delivery.
3. WHEN the frontend receives an `error` event with code `"SAVE_FAILED"`, THE Member_Chat_Page or Coach_Messages_Page SHALL display a toast notification indicating the message failed to send.
4. WHEN the frontend receives an `error` event with code `"UNAUTHORIZED_THREAD"`, THE Member_Chat_Page or Coach_Messages_Page SHALL display a toast notification indicating the user is not authorized to message this partner.
5. IF `GET /api/coach-messages/:partnerId` is called for a thread with no messages, THEN THE CoachMessageService SHALL return HTTP 200 with an empty `messages` array rather than HTTP 404.

---

### Requirement 15: Backend Infrastructure Setup

**User Story:** As a platform engineer, I want the Socket.IO server integrated into the existing Express process, so that no new infrastructure is required to support real-time messaging.

#### Acceptance Criteria

1. THE Socket.IO_Server SHALL be created by wrapping the existing Express `app` in a Node.js `http.Server` instance.
2. THE Socket.IO_Server SHALL be configured with CORS `origin` set to `process.env.FRONTEND_URL` (defaulting to `"http://localhost:3000"`).
3. THE backend `server.ts` SHALL be updated to call `httpServer.listen(PORT)` instead of `app.listen(PORT)`.
4. THE new `/api/coach-messages` router SHALL be registered in `app.ts` alongside the existing routes.
5. THE backend SHALL require the environment variables `PYTHON_BACKEND_URL` and `PYTHON_ORG_ID` for sentiment forwarding; their absence SHALL be logged as a warning at startup but SHALL NOT prevent the server from starting.
