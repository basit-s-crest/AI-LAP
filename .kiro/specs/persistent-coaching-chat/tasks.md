# Tasks

## Task List

- [x] 1 Database: Add CoachMessage Prisma model and migrate
  - [x] 1.1 Add `CoachMessage` model to `backend/prisma/schema.prisma` with all fields, indexes, and cascade-delete relations as specified in Requirement 1
  - [x] 1.2 Add `coachMessages` relation field to the `User` model in `schema.prisma`
  - [x] 1.3 Add `coachMessages` relation field to the `Coach` model in `schema.prisma`
  - [x] 1.4 Run `prisma migrate dev --name add_coach_messages` to generate and apply the migration
  - [x] 1.5 Run `prisma generate` to regenerate the Prisma client

- [x] 2 Backend: CoachMessageService
  - [x] 2.1 Create `backend/src/services/coachMessage.service.ts` implementing `CoachMessageService` with `saveMessage`, `getThread`, `markRead`, and `getConversationList` methods
  - [x] 2.2 Implement `saveMessage`: validate content (non-empty, ≤ 2000 chars), validate senderRole, verify CoachMember assignment exists, persist row with `read: false`
  - [x] 2.3 Implement `getThread`: cursor-based pagination using base64-encoded `{ createdAt, id }` cursor, fetch `limit + 1` rows ordered by `(createdAt desc, id desc)`, return reversed slice with `nextCursor`
  - [x] 2.4 Implement `markRead`: update only rows where the authenticated user is the receiver and `read = false`; return updated count
  - [x] 2.5 Implement `getConversationList`: return `ConversationSummary[]` with `partnerId`, `partnerName`, `partnerAvatar`, `lastMessage`, `lastMessageAt`, and `unreadCount` for all threads of the caller

- [x] 3 Backend: SentimentForwarder
  - [x] 3.1 Create `backend/src/services/sentimentForwarder.ts` implementing `forwardToSentiment(message: CoachMessage): void`
  - [x] 3.2 Build `ChatIngestPayload` with all required fields: `event_id` (randomUUID), `org_id` (env `PYTHON_ORG_ID`), `member_token` (User id), `session_id` (`{userId}_{coachId}`), `role: "member"`, `text` (content truncated to 500 chars), `timestamp` (ISO 8601), `consent_active: true`
  - [x] 3.3 POST to `{PYTHON_BACKEND_URL}/v1/ingest/chat` using `fetch` with `AbortSignal.timeout(5000)`, intentionally not awaited
  - [x] 3.4 Catch all errors from the async fetch chain and log to console; never re-throw

- [x] 4 Backend: Socket.IO server setup
  - [x] 4.1 Install `socket.io` in the backend: `npm install socket.io`
  - [x] 4.2 Update `backend/src/server.ts` to wrap `app` in `http.createServer`, create a `Server` instance with CORS config, and call `httpServer.listen(PORT)` instead of `app.listen(PORT)`
  - [x] 4.3 Create `backend/src/middleware/socketAuth.middleware.ts` that validates JWT from `socket.handshake.auth.token` and sets `socket.data.user = { id, role }`; calls `next(new Error("Unauthorized"))` on failure
  - [x] 4.4 Create `backend/src/sockets/coachChat.ts` with `registerCoachChatHandlers(io, socket)` function
  - [x] 4.5 In `registerCoachChatHandlers`, handle `join_thread`: join the socket to its Personal_Room (`user:{id}` or `coach:{id}`)
  - [x] 4.6 In `registerCoachChatHandlers`, handle `send_message`: resolve userId/coachId from role, run Assignment_Guard, call `saveMessage`, emit `message_saved` to sender, emit `new_message` to partner's Personal_Room, call `forwardToSentiment` for member messages only
  - [x] 4.7 In `registerCoachChatHandlers`, handle `mark_read`: call `markRead`, emit `read_receipt` to partner's Personal_Room
  - [x] 4.8 Register the `/coach-chat` namespace in `server.ts` with `socketAuthMiddleware` and `registerCoachChatHandlers`

- [x] 5 Backend: REST API routes for coach messages
  - [x] 5.1 Create `backend/src/controllers/coachMessage.controller.ts` with handlers for `getThread`, `markRead`, and `getConversationList`
  - [x] 5.2 Create `backend/src/routes/coachMessage.routes.ts` with `GET /api/coach-messages/:partnerId`, `POST /api/coach-messages/:partnerId/read`, and `GET /api/coach-messages` (conversation list), all protected by `authMiddleware`
  - [x] 5.3 Register the new router in `backend/src/app.ts` as `app.use("/api/coach-messages", coachMessageRouter)`
  - [x] 5.4 Add `PYTHON_BACKEND_URL` and `PYTHON_ORG_ID` startup warnings to `server.ts` if env vars are absent

- [x] 6 Frontend: Install socket.io-client and add types
  - [x] 6.1 Install `socket.io-client` in the frontend: `npm install socket.io-client`
  - [x] 6.2 Add `CoachMessageDTO` and `ConversationSummary` TypeScript interfaces to `frontend/src/types/` (e.g., `coachMessage.ts`)

- [x] 7 Frontend: useCoachSocket hook
  - [x] 7.1 Create `frontend/src/hooks/useCoachSocket.ts` that connects to `/coach-chat` namespace on mount with JWT from `localStorage.getItem("vasl_token")` in `auth.token`
  - [x] 7.2 Track connection state and expose `isConnected: boolean`
  - [x] 7.3 Expose `sendMessage(partnerId: string, content: string): void` that emits `send_message`
  - [x] 7.4 Register `new_message` listener that calls `onNewMessage` callback
  - [x] 7.5 Register `read_receipt` listener that calls `onReadReceipt` callback
  - [x] 7.6 On `connect_error` with message `"Unauthorized"`, redirect to `/login`
  - [x] 7.7 Disconnect socket on unmount

- [x] 8 Frontend: useCoachMessages hook
  - [x] 8.1 Create `frontend/src/hooks/useCoachMessages.ts` using `useInfiniteQuery` against `GET /api/coach-messages/:partnerId` with cursor-based page params
  - [x] 8.2 Flatten pages into a single `messages: CoachMessageDTO[]` array
  - [x] 8.3 Expose `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`, `isLoading`
  - [x] 8.4 Implement `prependMessage` helper that updates the TanStack Query cache via `queryClient.setQueryData` when a new socket message arrives
  - [x] 8.5 Call `POST /api/coach-messages/:partnerId/read` on mount and on window `focus` event

- [x] 9 Frontend: Update Member Chat Page (/coaching/[coachId])
  - [x] 9.1 Replace mock `initialMsgs` state with `useCoachMessages(coachId)` for history
  - [x] 9.2 Replace mock `send` function with `sendMessage(coachId, content)` from `useCoachSocket`
  - [x] 9.3 Wire `onNewMessage` callback to prepend incoming messages to the query cache
  - [x] 9.4 Show loading state while `isLoading` is true
  - [x] 9.5 Add "Load older messages" button that calls `fetchNextPage` when `hasNextPage` is true
  - [x] 9.6 Display toast on `error` events with codes `SAVE_FAILED` and `UNAUTHORIZED_THREAD`

- [x] 10 Frontend: Update Coach Messages Page (/messages)
  - [x] 10.1 Replace static `CLIENTS` array with data from `GET /api/coach-messages` (conversation list endpoint)
  - [x] 10.2 Replace mock `INITIAL_MSGS` state with `useCoachMessages(selectedUserId)` for the active thread
  - [x] 10.3 Replace mock `sendMessage` with `sendMessage(userId, content)` from `useCoachSocket`
  - [x] 10.4 Wire `onNewMessage` callback to prepend incoming messages to the active thread's query cache
  - [x] 10.5 Display `unreadCount` badge from `ConversationSummary` in the sidebar for each member
  - [x] 10.6 Update unread badge in real time when `read_receipt` events are received
  - [x] 10.7 Call `POST /api/coach-messages/:partnerId/read` when a conversation is selected
  - [x] 10.8 Display toast on `error` events with codes `SAVE_FAILED` and `UNAUTHORIZED_THREAD`

- [x] 11 Tests: Backend unit tests for CoachMessageService
  - [x] 11.1 Write unit tests for `saveMessage` using a mocked Prisma client: verify correct fields written, `read` defaults to `false`, validation rejects empty content, content > 2000 chars, and invalid senderRole
  - [x] 11.2 Write unit tests for `markRead`: verify only receiver's unread messages are updated, sender's messages are untouched, and correct count is returned
  - [x] 11.3 Write unit tests for `getThread`: verify cursor decoding, correct `orderBy`, ascending output order, and `nextCursor` generation
  - [x] 11.4 Write unit tests for `getConversationList`: verify unread count aggregation and required fields in each `ConversationSummary`

- [x] 12 Tests: Backend unit tests for SentimentForwarder
  - [x] 12.1 Write unit tests verifying `forwardToSentiment` never throws even when `fetch` rejects
  - [x] 12.2 Write unit tests verifying `forwardToSentiment` is never called when `senderRole = "coach"`
  - [x] 12.3 Write unit tests verifying the `ChatIngestPayload` shape matches the required schema (all fields present, `text` truncated to 500 chars, `role: "member"`)

- [x] 13 Tests: Backend property-based tests
  - [x] 13.1 Write property test for pagination completeness: for any array of N messages and any valid limit (1–100), following all nextCursor values yields exactly N distinct messages with no duplicates
  - [x] 13.2 Write property test for cursor round-trip: encoding then decoding a `{ createdAt, id }` cursor yields the original values
  - [x] 13.3 Write property test for assignment guard: for any (userId, coachId) pair without a CoachMember row, send_message never persists a message and always emits UNAUTHORIZED_THREAD error
  - [x] 13.4 Write property test for content validation: for any string that is empty, whitespace-only, or longer than 2000 chars, saveMessage rejects without a DB write
  - [x] 13.5 Write property test for sentiment truncation: for any content string, the ChatIngestPayload text field has length min(len(content), 500)

- [x] 14 Tests: Frontend unit tests
  - [x] 14.1 Write unit tests for `useCoachSocket`: verify connect on mount, disconnect on unmount, `onNewMessage` callback invoked on `new_message` event, `onReadReceipt` callback invoked on `read_receipt` event
  - [x] 14.2 Write unit tests for `useCoachMessages`: verify cache prepend on socket message without triggering refetch, `POST /read` called on mount and focus
