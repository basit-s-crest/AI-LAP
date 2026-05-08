# Azadi Health — Next.js Frontend

Real-time coach messaging with BullMQ → LLM inference → live dashboard.

## Architecture

```
Coach sends message
       ↓
POST /api/chat  (Next.js API route)
       ↓
BullMQ Queue  (Redis)
       ↓
worker.mjs  (Node.js background process)
       ↓
POST /v1/ingest/chat  (FastAPI)
       ↓
LLM inference  (OpenRouter)
       ↓
PostgreSQL  (save results)
       ↓
Redis pub/sub  (publish score update)
       ↓
GET /api/scores/stream  (SSE)
       ↓
Browser  (live dashboard + chat panel update)
```

## Prerequisites

- Redis running on `localhost:6379`
- FastAPI backend running on `localhost:8000` (`uvicorn main:app --reload` from project root)
- Node.js 18+

## Setup

```bash
cd azadi-next
npm install
```

## Running

You need **3 terminals**:

### Terminal 1 — FastAPI backend
```bash
# From project root (D:\AI-LAP)
uvicorn main:app --reload
```

### Terminal 2 — Next.js dev server
```bash
cd azadi-next
npm run dev
```

### Terminal 3 — BullMQ Worker
```bash
cd azadi-next
npm run worker
# or: node --env-file=.env.local worker.mjs
```

## Pages

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Home / role selector |
| `http://localhost:3000/coach/messages` | Coach messages (4 clients, BullMQ active for Amara) |
| `http://localhost:3000/dashboard` | Live risk dashboard (SSE real-time updates) |

## How to test

1. Open `http://localhost:3000/dashboard` in one tab
2. Open `http://localhost:3000/coach/messages` in another tab
3. Select **Amara Johnson** (first client — BullMQ is active for her only)
4. Type any message and press Send
5. Watch the dashboard update in real-time with the LLM inference result

## Environment variables (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379/0
MEMBER_TOKEN_AMARA=mbr_bf18c4d442624cd09a06
ORG_ID=org_univ_maryland
```
