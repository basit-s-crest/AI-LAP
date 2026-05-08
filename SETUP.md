# VASL Demo — Complete Setup Guide

This is a monorepo workspace with 3 separate backends and 1 frontend:

1. **`python-backend/`** — Python FastAPI (LLM inference, risk scoring)
2. **`backend/`** — TypeScript Express (auth, messages, groups)
3. **`frontend/`** — Next.js (main UI)
4. **`packages/database/`** — Shared Prisma schema for TypeScript backend

---

## Prerequisites

- **Node.js 18+** and npm
- **Python 3.12** (for python-backend)
- **PostgreSQL** running locally
- **Redis** running locally (for BullMQ + SSE)

---

## Step 1 — Install all dependencies (monorepo root)

```bash
# Install all workspace dependencies at once
npm install
```

This installs:
- Root workspace dependencies
- `frontend/` dependencies (Next.js, React, BullMQ, ioredis, etc.)
- `backend/` dependencies (Express, Prisma client, bcrypt, JWT, etc.)
- `packages/database/` dependencies (Prisma)

---

## Step 2 — Setup TypeScript Backend (`backend/`)

### 2.1 Create `.env` file

```bash
# In backend/ folder
cd backend
```

Create `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:yourpassword@localhost:5432/vasl_ts"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
PORT=4000
```

Replace `yourpassword` with your actual Postgres password.

### 2.2 Create the database

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE vasl_ts;"
```

Or create it through pgAdmin.

### 2.3 Generate Prisma Client

```bash
# From root directory
cd packages/database
npx prisma generate
```

This generates the Prisma client in `packages/database/node_modules/@prisma/client`.

### 2.4 Run Prisma migrations

```bash
# Still in packages/database/
npx prisma migrate deploy
```

This creates the `User`, `Message`, and `CommunityGroup` tables.

### 2.5 (Optional) Seed the database

```bash
npx prisma db seed
```

Or manually insert test data via pgAdmin/psql.

---

## Step 3 — Setup Python Backend (`python-backend/`)

### 3.1 Install uv (fast Python package manager)

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Mac / Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 3.2 Create virtual environment

```bash
cd python-backend
uv python install 3.12
uv venv --python 3.12
```

**Activate:**
```powershell
# Windows
.venv\Scripts\activate

# Mac/Linux
source .venv/bin/activate
```

### 3.3 Install dependencies

```bash
uv pip install -r requirements.txt
```

### 3.4 Configure `.env`

Edit `python-backend/.env`:
```env
DATABASE_URL=postgresql+psycopg://postgres:yourpassword@localhost:5432/vasl
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=google/gemini-2.0-flash-001
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=60
```

Get your OpenRouter API key from https://openrouter.ai/keys

### 3.5 Create the database

```bash
psql -U postgres -c "CREATE DATABASE vasl;"
```

### 3.6 Run migrations

```bash
python -m app.migrate
```

This creates all tables (members, inference_events, event_signals, etc.) and loads 1000 rows of seed data.

---

## Step 4 — Setup Frontend (`frontend/`)

### 4.1 Configure `.env.local`

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379/0
ORG_ID=org_univ_maryland
NEXT_PUBLIC_MEMBER_TOKEN_AMARA=mbr_bf18c4d442624cd09a06
NEXT_PUBLIC_MEMBER_TOKEN_MARCUS=mbr_marcus_001
NEXT_PUBLIC_MEMBER_TOKEN_PRIYA=mbr_priya_001
NEXT_PUBLIC_MEMBER_TOKEN_JORDAN=mbr_jordan_001
```

---

## Step 5 — Start Redis

**Windows (if using WSL):**
```bash
wsl
sudo service redis-server start
```

**Mac (Homebrew):**
```bash
brew services start redis
```

**Docker:**
```bash
docker run -d -p 6379:6379 redis:alpine
```

Verify Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

---

## Step 6 — Start all services

Open **4 separate terminals**:

### Terminal 1 — Python FastAPI (port 8000)

```bash
cd python-backend
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Mac/Linux
uvicorn main:app --reload --loop asyncio --port 8000
```

API docs: http://localhost:8000/docs

### Terminal 2 — TypeScript Express Backend (port 4000)

```bash
cd backend
npm run dev
```

Server: http://localhost:4000

### Terminal 3 — Next.js Frontend (port 3000)

```bash
cd frontend
npm run dev
```

App: http://localhost:3000

### Terminal 4 — BullMQ Worker

```bash
cd frontend
node worker.mjs
```

This processes LLM inference jobs from the queue.

---

## Step 7 — Test the LLM Pipeline

1. Open http://localhost:3000
2. Login (if auth is set up) or navigate to `/messages`
3. Select **Amara Johnson** (first client)
4. Send a message like: *"I've been feeling really down lately and don't see things getting better"*
5. Watch the worker terminal — it will:
   - Dequeue the job
   - Call Python FastAPI `/v1/ingest/chat`
   - LLM analyzes the text
   - Result published to Redis
6. The **Messages** page shows a live score banner
7. Navigate to **Live Risk Dashboard** (`/risk-dashboard`) to see real-time updates

---

## Troubleshooting

### `next: command not found` (frontend)

Run from the **root** directory:
```bash
npm install
```

This installs Next.js at the root `node_modules` (workspace setup).

### `prisma: command not found`

```bash
cd packages/database
npm install
npx prisma generate
```

### Python backend: `connection refused` on database

Make sure PostgreSQL is running and the `DATABASE_URL` in `python-backend/.env` is correct.

### Python backend: `OPENROUTER_API_KEY is not set`

Get your key from https://openrouter.ai/keys and add it to `python-backend/.env`.

### Worker: `ECONNREFUSED` on Redis

Make sure Redis is running:
```bash
redis-cli ping
```

### TypeScript backend: `Prisma Client not generated`

```bash
cd packages/database
npx prisma generate
```

### Port already in use

Change the port in the respective config:
- Python: `uvicorn main:app --reload --port 8001`
- TypeScript: Edit `backend/.env` → `PORT=4001`
- Frontend: `npm run dev -- -p 3001`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js) — http://localhost:3000                 │
│  • Messages page with live LLM inference                    │
│  • Live Risk Dashboard with SSE                             │
│  • API routes: /api/chat (enqueue), /api/scores/stream     │
└─────────────────────────────────────────────────────────────┘
                    │                           │
                    │ POST /api/chat            │ GET /api/scores/stream
                    ▼                           │ (SSE)
            ┌───────────────┐                   │
            │   BullMQ      │                   │
            │   (Redis)     │                   │
            └───────────────┘                   │
                    │                           │
                    │ dequeue                   │
                    ▼                           │
            ┌───────────────┐                   │
            │  worker.mjs   │                   │
            │  (Node.js)    │                   │
            └───────────────┘                   │
                    │                           │
                    │ POST /v1/ingest/chat      │
                    ▼                           │
┌─────────────────────────────────────────────────────────────┐
│  Python FastAPI — http://localhost:8000                     │
│  • LLM inference (OpenRouter)                               │
│  • Risk scoring (43-signal taxonomy)                        │
│  • PostgreSQL storage                                       │
│  • Redis caching                                            │
└─────────────────────────────────────────────────────────────┘
                    │
                    │ publish result
                    ▼
            ┌───────────────┐
            │  Redis Pub/Sub│───────────────────────┘
            └───────────────┘

┌─────────────────────────────────────────────────────────────┐
│  TypeScript Express — http://localhost:4000                 │
│  • Auth (JWT)                                               │
│  • Messages (1-to-1 chat)                                   │
│  • Community Groups                                         │
│  • Prisma ORM → PostgreSQL (vasl_ts)                        │
└─────────────────────────────────────────────────────────────┘
```

---

## What Each Backend Does

| Backend | Port | Purpose | Database |
|---------|------|---------|----------|
| **Python FastAPI** | 8000 | LLM inference, risk scoring, mental health signal detection | `vasl` (Postgres) |
| **TypeScript Express** | 4000 | Auth, messages, groups | `vasl_ts` (Postgres) |
| **Frontend Next.js** | 3000 | UI, BullMQ queue, SSE streaming | — |
| **BullMQ Worker** | — | Background job processor | — |

---

## Next Steps

- Add authentication to the frontend (connect to TypeScript backend `/api/auth`)
- Wire up the Messages page to use real TypeScript backend messages
- Add member profiles that link to Python backend risk scores
- Deploy all 3 services (Vercel for frontend, Railway/Render for backends)
