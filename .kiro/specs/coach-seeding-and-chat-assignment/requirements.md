# Requirements Document

## Introduction

This feature seeds three real Azadi Health coach profiles into the PostgreSQL `Coach` table and introduces the member-side "connect to a coach" flow. When a member clicks **Start Chat** on the `/coaching` page, the system creates a `CoachMember` assignment row (idempotently) and navigates to the `/coaching/[coachId]` chat page. The assignment row is the prerequisite that the `persistent-coaching-chat` spec's Assignment Guard checks before allowing messages to be saved. The feature also replaces the static mock data source in the frontend coaching page with live API data from the database.

---

## Glossary

- **Seed_Script**: The `backend/src/lib/seed.ts` TypeScript script executed via `ts-node` to populate the database with initial data.
- **Coach**: A record in the `Coach` Prisma model representing an Azadi Health coaching professional.
- **Member**: A record in the `User` Prisma model with `role = "member"`, representing an end-user of the platform.
- **CoachMember**: A join-table record in the `CoachMember` Prisma model representing an assignment between a `Coach` and a `Member`.
- **Assignment_Guard**: The check in the `persistent-coaching-chat` feature that verifies a `CoachMember` row exists before allowing a message to be saved.
- **List_Endpoint**: The `GET /api/coach/list` Express route handler.
- **Assign_Endpoint**: The `POST /api/coach/assign` Express route handler.
- **CoachingPage**: The Next.js page component at `/coaching` that displays the list of available coaches.
- **useAssignCoach**: The TanStack Mutation hook that calls the Assign_Endpoint and navigates on success.
- **useCoachesQuery**: The TanStack Query hook that fetches the coach list from the API.
- **Coach_Service**: The frontend service module (`frontend/src/services/coach.service.ts`) responsible for fetching coach data.
- **CoachPublicDTO**: The data transfer object shape returned by the List_Endpoint, containing all coach fields except `password`.

---

## Requirements

### Requirement 1: Coach Seeding

**User Story:** As a developer, I want the three real Azadi Health coach profiles seeded into the database, so that the application has real coach data to display and assign to members.

#### Acceptance Criteria

1. WHEN the Seed_Script is executed, THE Seed_Script SHALL upsert a `Coach` row for `amara@azadihealth.com` with `name = "Dr. Amara Osei"`, `speciality = "Trauma · CBT · Cultural Identity"`, `bio = "Azadi Health Staff"`, `avatar = "👩🏾‍⚕️"`, and `isActive = true`.
2. WHEN the Seed_Script is executed, THE Seed_Script SHALL upsert a `Coach` row for `marcus@azadihealth.com` with `name = "Marcus Rivera"`, `speciality = "Depression · Grief · Mindfulness"`, `bio = "Azadi Health Staff"`, `avatar = "🧑🏽‍⚕️"`, and `isActive = true`.
3. WHEN the Seed_Script is executed, THE Seed_Script SHALL upsert a `Coach` row for `priya@azadihealth.com` with `name = "Priya Sharma"`, `speciality = "Anxiety · ACT · South Asian Youth"`, `bio = "University Partners"`, `avatar = "👩🏽‍⚕️"`, and `isActive = true`.
4. WHEN the Seed_Script is executed more than once, THE Seed_Script SHALL produce exactly three `Coach` rows for the three target emails with no duplicate rows created.
5. WHEN the Seed_Script is executed, THE Seed_Script SHALL store each coach's password as a bcrypt hash of `"coach1234"` and SHALL NOT store the plaintext password.
6. WHEN the Seed_Script is executed, THE Seed_Script SHALL NOT delete or modify any existing `User`, `CommunityGroup`, `Message`, or `CoachMessage` rows.
7. WHEN the Seed_Script completes successfully, THE Seed_Script SHALL log the name of each upserted coach to the console.
8. IF the Seed_Script encounters a database error, THEN THE Seed_Script SHALL log the error to the console and exit with process code 1.

---

### Requirement 2: List Coaches Endpoint

**User Story:** As a member, I want to see a list of available coaches, so that I can choose a coach to connect with.

#### Acceptance Criteria

1. WHEN a client sends `GET /api/coach/list`, THE List_Endpoint SHALL respond with HTTP 200 and a JSON body containing a `coaches` array of `CoachPublicDTO` objects.
2. WHEN a client sends `GET /api/coach/list`, THE List_Endpoint SHALL include only `Coach` rows where `isActive = true` in the response.
3. WHEN a client sends `GET /api/coach/list`, THE List_Endpoint SHALL order the returned coaches by `name` ascending.
4. THE List_Endpoint SHALL NOT include the `password` field in any returned `CoachPublicDTO` object.
5. THE List_Endpoint SHALL be accessible without authentication (no JWT required).
6. IF the database is unavailable, THEN THE List_Endpoint SHALL respond with HTTP 500 and `{ "message": "Internal server error" }`.

---

### Requirement 3: Assign Coach Endpoint

**User Story:** As a member, I want to be assigned to a coach when I click Start Chat, so that I can begin a persistent coaching conversation.

#### Acceptance Criteria

1. WHEN an authenticated member sends `POST /api/coach/assign` with a valid `coachId` for an active coach and no prior assignment exists, THE Assign_Endpoint SHALL create a `CoachMember` row and respond with HTTP 201 and `{ assigned: true, coachId, assignedAt }`.
2. WHEN an authenticated member sends `POST /api/coach/assign` with a valid `coachId` for an active coach and an assignment already exists, THE Assign_Endpoint SHALL NOT create a duplicate `CoachMember` row and SHALL respond with HTTP 200 and `{ assigned: true, coachId, assignedAt }`.
3. WHEN an authenticated member sends `POST /api/coach/assign` with a `coachId` that does not exist in the `Coach` table, THE Assign_Endpoint SHALL respond with HTTP 404 and `{ "message": "Coach not found" }`.
4. WHEN an authenticated member sends `POST /api/coach/assign` with a `coachId` for a coach where `isActive = false`, THE Assign_Endpoint SHALL respond with HTTP 404 and `{ "message": "Coach not found" }`.
5. WHEN a client sends `POST /api/coach/assign` without a valid JWT, THE Assign_Endpoint SHALL respond with HTTP 401.
6. WHEN an authenticated member sends `POST /api/coach/assign` without a `coachId` field in the request body, THE Assign_Endpoint SHALL respond with HTTP 400 and `{ "message": "coachId is required" }`.
7. AFTER a successful `POST /api/coach/assign`, THE Assignment_Guard in the `persistent-coaching-chat` feature SHALL pass for the same `(coachId, userId)` pair.
8. IF the database throws an unexpected error during upsert, THEN THE Assign_Endpoint SHALL respond with HTTP 500 and `{ "message": "Internal server error" }`.

---

### Requirement 4: Frontend Coach List Integration

**User Story:** As a member, I want the coaching page to display real coach profiles from the database, so that I see accurate and up-to-date coach information.

#### Acceptance Criteria

1. WHEN the CoachingPage renders, THE Coach_Service SHALL fetch coach data from `GET /api/coach/list` instead of the static mock JSON file.
2. WHEN the CoachingPage renders, THE useCoachesQuery hook SHALL supply the fetched `CoachPublicDTO[]` array to the CoachingPage component.
3. WHEN coach data is loading, THE CoachingPage SHALL display a loading indicator to the user.
4. IF the `GET /api/coach/list` request fails, THEN THE CoachingPage SHALL display an error state to the user.

---

### Requirement 5: Member-to-Coach Assignment Flow

**User Story:** As a member, I want clicking Start Chat on a coach card to assign me to that coach and navigate me to the chat page, so that I can begin messaging without a separate setup step.

#### Acceptance Criteria

1. WHEN a member clicks the Start Chat button on a coach card, THE useAssignCoach hook SHALL call `POST /api/coach/assign` with the selected coach's `coachId`.
2. WHEN `POST /api/coach/assign` returns a success response (HTTP 200 or 201), THE useAssignCoach hook SHALL navigate the browser to `/coaching/[coachId]`.
3. WHILE the assignment request is in flight, THE CoachingPage SHALL disable the Start Chat button and display a loading/pending state on the active coach card.
4. IF `POST /api/coach/assign` returns an error response, THEN THE useAssignCoach hook SHALL display an error toast to the user and SHALL NOT navigate away from the CoachingPage.
5. THE useAssignCoach hook SHALL expose an `isPending` boolean that is `true` while the mutation is in flight and `false` otherwise.

---

### Requirement 6: Coach Routes Registration

**User Story:** As a developer, I want the new coach endpoints registered in the Express application, so that they are reachable by the frontend.

#### Acceptance Criteria

1. THE Express application SHALL register `GET /api/coach/list` on the existing `/api/coach` router.
2. THE Express application SHALL register `POST /api/coach/assign` on the existing `/api/coach` router, protected by `authMiddleware`.
3. WHEN the Express application starts, THE List_Endpoint and Assign_Endpoint SHALL be reachable at their respective paths without restarting the server.
