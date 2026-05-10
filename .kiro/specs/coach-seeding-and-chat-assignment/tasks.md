# Tasks

## Task List

- [x] 1. Update seed script with real coach profiles
  - [x] 1.1 Add three coach upserts to `backend/src/lib/seed.ts`
  - [x] 1.2 Verify seed runs without errors and logs each coach name

- [x] 2. Add `GET /api/coach/list` endpoint
  - [x] 2.1 Add `listCoachesHandler` to `backend/src/controllers/coach.controller.ts`
  - [x] 2.2 Register `GET /list` route on the coach router in `backend/src/routes/coach.routes.ts`

- [x] 3. Add `POST /api/coach/assign` endpoint
  - [x] 3.1 Add `assignCoachHandler` to `backend/src/controllers/coach.controller.ts`
  - [x] 3.2 Register `POST /assign` route (with `authMiddleware`) on the coach router

- [x] 4. Write unit tests for the two new handlers
  - [x] 4.1 Write unit tests for `listCoachesHandler` (active-only filter, no password field, 500 on DB error)
  - [x] 4.2 Write unit tests for `assignCoachHandler` (201 on create, 200 on existing, 404 for missing/inactive coach, 400 for missing coachId, 401 without JWT, 500 on DB error)

- [x] 5. Write property-based tests
  - [x] 5.1 Write PBT for Property 4 (list endpoint active-only filter): for any mix of active/inactive coaches, response contains only active ones
  - [x] 5.2 Write PBT for Property 6 (no password leakage): for any Coach[] returned by listCoachesHandler, no object has a `password` field
  - [x] 5.3 Write PBT for Property 7 (assignment idempotency): for any valid (coachId, userId) pair, calling assignCoachHandler N times results in exactly one CoachMember row

- [x] 6. Update frontend coach service to call the real API
  - [x] 6.1 Update `frontend/src/services/coach.service.ts` to call `GET /api/coach/list` instead of reading from mock JSON
  - [x] 6.2 Add a `CoachPublicDTO` type to `frontend/src/types/coach.ts` (or a new `coachPublic.ts`) matching the API response shape
  - [x] 6.3 Update `useCoachesQuery` in `frontend/src/hooks/api/use-coaches.ts` to use the new DTO type

- [x] 7. Implement `useAssignCoach` hook
  - [x] 7.1 Create `frontend/src/hooks/useAssignCoach.ts` with TanStack `useMutation` calling `POST /api/coach/assign`
  - [x] 7.2 On success, navigate to `/coaching/[coachId]` using `useRouter`
  - [x] 7.3 On error, call `options.onError` or show a `toast.error`
  - [x] 7.4 Expose `isPending` boolean from the mutation

- [x] 8. Wire `useAssignCoach` into `CoachingPage`
  - [x] 8.1 Replace `onMessage={() => router.push(...)}` with `onMessage={() => assignAndNavigate(c.id)}` in `frontend/src/app/(dashboard)/coaching/page.tsx`
  - [x] 8.2 Pass `disabled={isPending}` to the `CoachCard` component while the mutation is in flight
  - [x] 8.3 Add loading and error states to the CoachingPage for the `useCoachesQuery` fetch

- [x] 9. Run all backend tests and verify they pass
