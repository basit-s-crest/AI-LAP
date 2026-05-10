# VASL — Project Setup & Guide

## How the Project Works

VASL is a mental health platform for therapists to monitor client risk in real time. It has 4 services running together:

```
Frontend (Next.js :3000)
    │
    ├─→ POST /api/chat ──→ BullMQ Queue (Redis)
    │                              │
    │                              ↓
    │                         worker.mjs
    │                              │
    │                              ↓
    │                   Python FastAPI (:8000)
    │                     LLM Inference + Risk Scoring
    │                              │
    │                              ↓
    │                      PostgreSQL (vasl)
    │                              │
    │                              ↓
    │                       Redis Pub/Sub
    │                              │
    └─→ GET /api/scores/stream ←───┘
           (SSE live updates)

Frontend also calls:
    TypeScript Express (:4000)
      Auth (JWT), Messages, Community Groups
              ↓
       PostgreSQL (vasl_ts)
```

| Service | Port | Purpose |
|---|---|---|
| **Next.js Frontend** | 3000 | UI, BullMQ job queue, SSE streaming |
| **TypeScript Express** | 4000 | Auth (JWT), 1-to-1 messages, community groups |
| **Python FastAPI** | 8000 | LLM inference, risk scoring, mental health signals |
| **BullMQ Worker** | — | Background job processor (reads from Redis, calls Python) |

**Two databases:**
- `vasl_ts` — TypeScript backend (users, messages, groups) — managed by Prisma
- `vasl` — Python backend (members, inference events, risk scores) — managed by custom SQL migrations

---

## Prerequisites

Before you start, make sure you have all of these installed:

- **Node.js 22 LTS** — required (Prisma 5 needs Node 18+, but 22 is recommended)
- **Python 3.12** — required (3.13+ has missing wheels for some packages)
- **PostgreSQL** — running on port 5432
- **Redis** — running on port 6379
- **uv** — fast Python package manager

### Install uv (once)

Windows (PowerShell):
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

Mac / Linux:
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Verify: `uv --version`

### Start Redis (if not running)

```bash
# Windows (WSL)
wsl
sudo service redis-server start

# Mac
brew services start redis

# Docker (any OS)
docker run -d -p 6379:6379 redis:alpine
```

Verify: `redis-cli ping` → should return `PONG`

---

## First-Time Setup

### 1. Install JS dependencies

From the project root:

```bash
npm install --force
```

This installs all workspace dependencies for `frontend`, `backend`, and `packages/database` in one shot.

### 2. Generate Prisma client

```bash
cd packages/database
npx prisma@5 generate
```

### 3. Create databases

```bash
psql -U postgres -c "CREATE DATABASE vasl_ts;"
psql -U postgres -c "CREATE DATABASE vasl;"
```

### 4. Run TypeScript backend migrations

```bash
cd packages/database
npx prisma@5 migrate deploy
```

> Note: Your `DATABASE_URL` password must have `#` URL-encoded as `%23`.
> Example: `postgresql://postgres:Read%23123@localhost:5432/vasl_ts`

### 5. Set up Python backend

```bash
cd python-backend

# Create virtual environment with Python 3.12
uv venv --python 3.12

# Activate it
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux

# Install dependencies (includes psycopg binary — no libpq needed)
uv pip install -r requirements.txt

# Run migrations (creates tables + seeds 1000 rows)
python -m app.migrate
```

---

## Environment Variables

### `backend/.env`

```env
DATABASE_URL="postgresql://postgres:Read%23123@localhost:5432/vasl_ts"
JWT_SECRET="your-secret-key"
PORT=4000
```

### `python-backend/.env`

```env
DATABASE_URL=postgresql+psycopg://postgres:Read%23123@localhost:5432/vasl
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
REDIS_URL=redis://localhost:6379/0
```

Get your OpenRouter API key from: https://openrouter.ai/keys

### `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379/0
```

> **Password with special characters:** If your Postgres password contains `#`, `@`, or other special characters, URL-encode them in the connection string. `#` → `%23`, `@` → `%40`.

---

## Running the Project

You need **4 terminals** open simultaneously.

### Terminal 1 — Python FastAPI (LLM backend)

```bash
cd python-backend
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux
uvicorn main:app --reload --loop asyncio --port 8000
```

✅ http://localhost:8000  
📖 API docs: http://localhost:8000/docs

### Terminal 2 — TypeScript Express (auth/messages backend)

```bash
cd backend
npm run dev
```

✅ http://localhost:4000

### Terminal 3 — Next.js Frontend

```bash
cd frontend
npm run dev
```

✅ http://localhost:3000

### Terminal 4 — BullMQ Worker

```bash
cd frontend
node worker.mjs
```

✅ Processing LLM jobs from Redis queue

---

## Daily Workflow

```bash
# Terminal 1
cd python-backend && .venv\Scripts\activate && uvicorn main:app --reload --loop asyncio --port 8000

# Terminal 2
cd backend && npm run dev

# Terminal 3
cd frontend && npm run dev

# Terminal 4
cd frontend && node worker.mjs
```

---

## Testing the App

1. Open http://localhost:3000
2. Go to **Messages** in the sidebar
3. Select **Amara Johnson** (first client)
4. Send: *"I've been feeling really anxious and overwhelmed lately"*
5. Watch Terminal 4 — the worker processes the LLM inference
6. The Messages page shows a live risk score banner
7. Go to **Live Risk Dashboard** to see real-time updates

---

## Troubleshooting

**`Cannot find module '@prisma/client'`**
```bash
cd packages/database
npx prisma@5 generate
```

**`Environment variable not found: DATABASE_URL` (Prisma)**
Run migrate from inside `packages/database/`, not from the root:
```bash
cd packages/database
npx prisma@5 migrate deploy
```

**`Prisma 7.x` errors about `url` in schema**
Always use `npx prisma@5` — the project uses Prisma 5, not 7.

**`no pq wrapper available` (Python)**
Install the binary version of psycopg:
```bash
cd python-backend && .venv\Scripts\activate
uv pip install "psycopg[binary,pool]==3.2.9"
```

**`next: command not found` or `ts-node-dev: command not found`**
```bash
# From root
npm install --force
```

**`connection refused` on database**
Make sure PostgreSQL is running. On Windows, check Services or pgAdmin.

**`password authentication failed`**
Check that the password in your `.env` files matches your Postgres user password. Remember to URL-encode special characters.

**`ECONNREFUSED` on Redis (worker)**
Redis isn't running — see the Redis start commands in Prerequisites above.

**Port already in use**
- Python: `uvicorn main:app --reload --port 8001`
- TypeScript: Edit `backend/.env` → `PORT=4001`
- Frontend: `npm run dev -- -p 3001`

**Python 3.13/3.14 — packages fail to build**
```bash
uv python install 3.12
uv venv --python 3.12
.venv\Scripts\activate
uv pip install -r requirements.txt
```
