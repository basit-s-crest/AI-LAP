# Quick Start Guide

## Prerequisites Check

Before starting, make sure you have:
- ✅ PostgreSQL running (port 5432)
- ✅ Redis running (port 6379)
- ✅ Node.js 18+ installed
- ✅ Python 3.12 installed (for python-backend)

---

## 1. Install Dependencies (First Time Only)

```bash
# From root directory
npm install --force
```

This installs all workspace dependencies (frontend, backend, packages).

---

## 2. Setup Databases

### TypeScript Backend Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE vasl_ts;"

# Run migrations
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
```

### Python Backend Database

```bash
# Create database
psql -U postgres -c "CREATE DATABASE vasl;"

# Setup Python environment
cd python-backend
uv venv --python 3.12
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Mac/Linux

# Install dependencies
uv pip install -r requirements.txt

# Run migrations
python -m app.migrate
```

---

## 3. Configure Environment Variables

### Backend (TypeScript)

Edit `backend/.env`:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/vasl_ts"
JWT_SECRET="your-secret-key"
PORT=4000
```

### Python Backend

Edit `python-backend/.env`:
```env
DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/vasl
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
REDIS_URL=redis://localhost:6379/0
```

Get OpenRouter API key from: https://openrouter.ai/keys

### Frontend

Edit `frontend/.env.local` (already created, just verify):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379/0
```

---

## 4. Start All Services

Open **4 terminals**:

### Terminal 1 — Python FastAPI (LLM Backend)

```bash
cd python-backend
.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Mac/Linux
uvicorn main:app --reload --loop asyncio --port 8000
```

✅ Running at: http://localhost:8000
📖 API Docs: http://localhost:8000/docs

### Terminal 2 — TypeScript Express (Auth/Messages Backend)

```bash
cd backend
npm run dev
```

✅ Running at: http://localhost:4000

### Terminal 3 — Next.js Frontend

```bash
cd frontend
npm run dev
```

✅ Running at: http://localhost:3000

### Terminal 4 — BullMQ Worker (LLM Job Processor)

```bash
cd frontend
node worker.mjs
```

✅ Processing jobs from Redis queue

---

## 5. Test the App

1. Open http://localhost:3000
2. Navigate to **Messages** (in sidebar)
3. Select **Amara Johnson** (first client)
4. Send a message: *"I've been feeling really anxious and overwhelmed lately"*
5. Watch Terminal 4 (worker) — it will process the LLM inference
6. The Messages page will show a live risk score banner
7. Navigate to **Live Risk Dashboard** to see real-time updates

---

## Troubleshooting

### `next: command not found`

```bash
# From root
npm install --force
```

### `ts-node-dev: command not found`

```bash
# From root
npm install --force
```

### `Prisma Client not generated`

```bash
npx prisma generate --schema=packages/database/prisma/schema.prisma
```

### Python: `connection refused` on database

Make sure PostgreSQL is running and `DATABASE_URL` in `python-backend/.env` is correct.

### Worker: `ECONNREFUSED` on Redis

Start Redis:
```bash
# Windows (WSL)
wsl
sudo service redis-server start

# Mac
brew services start redis

# Docker
docker run -d -p 6379:6379 redis:alpine
```

Verify:
```bash
redis-cli ping
# Should return: PONG
```

### Port already in use

Change ports:
- Python: `uvicorn main:app --reload --port 8001`
- TypeScript: Edit `backend/.env` → `PORT=4001`
- Frontend: `npm run dev -- -p 3001`

---

## Architecture

```
Frontend (Next.js :3000)
    │
    ├─→ POST /api/chat → BullMQ (Redis)
    │                       │
    │                       ↓
    │                   worker.mjs
    │                       │
    │                       ↓
    │              Python FastAPI (:8000)
    │                   LLM Inference
    │                       │
    │                       ↓
    │                   PostgreSQL (vasl)
    │                       │
    │                       ↓
    │                   Redis Pub/Sub
    │                       │
    └─→ GET /api/scores/stream (SSE) ←┘
    
    
Frontend also calls:
    TypeScript Express (:4000)
        Auth, Messages, Groups
            ↓
        PostgreSQL (vasl_ts)
```

---

## What Each Service Does

| Service | Port | Purpose |
|---------|------|---------|
| **Python FastAPI** | 8000 | LLM inference, risk scoring, mental health signals |
| **TypeScript Express** | 4000 | Auth (JWT), 1-to-1 messages, community groups |
| **Next.js Frontend** | 3000 | UI, BullMQ queue, SSE streaming |
| **BullMQ Worker** | — | Background LLM job processor |

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

## Full Documentation

See `SETUP.md` for detailed setup instructions, database schemas, and troubleshooting.
