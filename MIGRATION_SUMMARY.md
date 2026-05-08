# Migration Summary — AI-LAP → Dedicated Folders

## What Was Done

Successfully migrated the `AI-LAP/` folder functionality into the existing `backend/` and `frontend/` folders, plus created a new clean `python-backend/` folder.

---

## New Structure

```
vasl-demo/
├── python-backend/          ← NEW: Python FastAPI (LLM inference)
│   ├── app/
│   │   ├── core/           (database, models, schemas, crud, llm, cache)
│   │   └── routers/        (ingest, store, dashboard)
│   ├── vasl-db/            (SQL migrations, docker-compose, seeds)
│   ├── main.py
│   ├── requirements.txt
│   ├── .env
│   └── README.md
│
├── backend/                 ← EXISTING: TypeScript Express (auth, messages, groups)
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── lib/
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                ← ADDED
│
├── frontend/                ← UPDATED: Next.js (added LLM features)
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── chat/route.ts              ← ADDED (BullMQ enqueue)
│   │   │   │   └── scores/stream/route.ts     ← ADDED (SSE)
│   │   │   └── (dashboard)/
│   │   │       ├── messages/page.tsx          ← UPGRADED (live LLM)
│   │   │       └── risk-dashboard/page.tsx    ← ADDED (live dashboard)
│   │   ├── lib/
│   │   │   └── vasl/                          ← ADDED
│   │   │       ├── redis.ts
│   │   │       ├── queue.ts
│   │   │       └── types.ts
│   │   └── constants/
│   │       └── navigation.ts                  ← UPDATED (added risk-dashboard)
│   ├── worker.mjs                             ← ADDED (BullMQ worker)
│   ├── .env.local                             ← ADDED
│   ├── next.config.ts                         ← UPDATED (serverExternalPackages)
│   └── package.json                           ← UPDATED (bullmq, ioredis, uuid)
│
├── packages/
│   └── database/            ← EXISTING: Shared Prisma schema
│
├── AI-LAP/                  ← CAN BE DELETED (all code migrated)
│
├── SETUP.md                 ← ADDED (full setup guide)
├── START.md                 ← ADDED (quick start)
└── package.json             ← ROOT (workspace config)
```

---

## Files Created

### Python Backend (`python-backend/`)
- `main.py` — FastAPI entry point
- `requirements.txt` — Python dependencies
- `.env` — environment config (template)
- `README.md` — setup instructions
- `app/__init__.py`
- `app/migrate.py` — database migration runner
- `app/core/__init__.py`
- `app/core/database.py` — SQLAlchemy async setup
- `app/core/models.py` — ORM models (6 tables)
- `app/core/schemas.py` — Pydantic request/response models
- `app/core/crud.py` — database operations
- `app/core/llm.py` — OpenRouter LLM inference (43-signal taxonomy)
- `app/core/cache.py` — Redis caching layer
- `app/routers/__init__.py`
- `app/routers/ingest.py` — POST /v1/ingest/* (4 endpoints)
- `app/routers/store.py` — POST /v1/store-result, /v1/review/action
- `app/routers/dashboard.py` — GET /v1/results/member, /v1/admin/summary
- `vasl-db/` — entire folder copied (migrations, docker-compose, seeds, queries)

### Frontend (`frontend/`)
- `src/lib/vasl/redis.ts` — Redis singleton connections
- `src/lib/vasl/queue.ts` — BullMQ queue producer
- `src/lib/vasl/types.ts` — TypeScript types
- `src/app/api/chat/route.ts` — POST /api/chat (enqueue to BullMQ)
- `src/app/api/scores/stream/route.ts` — GET /api/scores/stream (SSE)
- `src/app/(dashboard)/messages/page.tsx` — upgraded with live LLM inference
- `src/app/(dashboard)/risk-dashboard/page.tsx` — new live risk dashboard
- `worker.mjs` — BullMQ worker (dequeues → calls Python FastAPI → publishes to Redis)
- `.env.local` — environment config

### Backend (`backend/`)
- `.env` — environment config (DATABASE_URL, JWT_SECRET, PORT)

### Root
- `SETUP.md` — comprehensive setup guide
- `START.md` — quick start guide
- `MIGRATION_SUMMARY.md` — this file

---

## Files Modified

### Frontend
- `package.json` — added `bullmq`, `ioredis`, `uuid`, `@types/uuid`, `"worker"` script
- `next.config.ts` — added `serverExternalPackages: ["ioredis", "bullmq"]`
- `src/constants/navigation.ts` — added "Live Risk Dashboard" to COACH_NAV

---

## Dependencies Added

### Frontend (npm)
- `bullmq@5.4.2` — job queue
- `ioredis@5.3.2` — Redis client
- `uuid@9.0.1` — unique ID generation
- `@types/uuid@9.0.7` — TypeScript types

### Python Backend (pip)
- `fastapi==0.111.0`
- `uvicorn[standard]==0.29.0`
- `sqlalchemy[asyncio]==2.0.30`
- `psycopg[pool]==3.2.9`
- `pydantic==2.7.1`
- `python-dotenv==1.0.1`
- `openai==1.30.1` — OpenRouter client
- `redis==5.0.4`
- `httpx==0.27.0`

---

## What Each Backend Does

### Python FastAPI (`python-backend/` — port 8000)
- **LLM Inference**: Calls OpenRouter with 43-signal mental health taxonomy
- **Risk Scoring**: Classifies text into low/moderate/high/crisis tiers
- **Signal Detection**: Detects hopelessness, isolation, self-harm, crisis escalation, cultural context
- **SHAP Attribution**: Extracts top 5 text spans that drove the risk score
- **Database**: PostgreSQL (`vasl`) with 6 tables (members, inference_events, event_signals, shap_attributions, review_actions, member_risk_snapshots)
- **Caching**: Redis-based caching for dashboard queries
- **Endpoints**:
  - `POST /v1/ingest/chat` — ingest chat message → LLM inference
  - `POST /v1/ingest/peer-post` — ingest peer post
  - `POST /v1/ingest/journal` — ingest journal entry
  - `POST /v1/ingest/assessment` — ingest assessment response
  - `POST /v1/store-result` — save inference result
  - `POST /v1/review/action` — clinician review
  - `GET /v1/results/member/{token}` — member risk history
  - `GET /v1/admin/summary/{org_id}` — org-level summary

### TypeScript Express (`backend/` — port 4000)
- **Auth**: JWT-based authentication (register, login, verify)
- **Messages**: 1-to-1 messaging between users
- **Community Groups**: Create, join, leave groups
- **Database**: PostgreSQL (`vasl_ts`) with Prisma ORM (User, Message, CommunityGroup)
- **Endpoints**:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/messages/conversations`
  - `GET /api/messages/:userId`
  - `POST /api/messages/send`
  - `GET /api/groups`
  - `POST /api/groups/create`
  - `POST /api/groups/:id/join`

### Next.js Frontend (`frontend/` — port 3000)
- **UI**: Full dashboard with 20+ pages
- **BullMQ Integration**: Enqueues chat messages for async LLM processing
- **SSE Streaming**: Real-time score updates via Server-Sent Events
- **Pages**:
  - `/messages` — coach messages with live LLM inference
  - `/risk-dashboard` — live risk dashboard with sparklines, activity log
  - `/dashboard` — role-based dashboard (member, coach, org, superadmin)
  - `/coaching`, `/community-groups`, `/mood-mapping`, etc.
- **API Routes**:
  - `POST /api/chat` — enqueue message to BullMQ
  - `GET /api/scores/stream` — SSE endpoint for live updates

### BullMQ Worker (`frontend/worker.mjs`)
- **Job Processing**: Dequeues chat messages from Redis queue
- **LLM Call**: Calls Python FastAPI `/v1/ingest/chat`
- **Pub/Sub**: Publishes results to Redis channel → SSE → dashboard
- **Concurrency**: 20 parallel LLM calls

---

## Data Flow

```
1. User sends message in /messages page
   ↓
2. POST /api/chat → enqueues to BullMQ (Redis)
   ↓
3. worker.mjs dequeues job
   ↓
4. worker calls Python FastAPI POST /v1/ingest/chat
   ↓
5. Python FastAPI:
   - Calls OpenRouter LLM (43-signal taxonomy)
   - Returns risk tier + signals + SHAP
   - Saves to PostgreSQL (background task)
   ↓
6. worker publishes result to Redis pub/sub channel
   ↓
7. GET /api/scores/stream (SSE) receives update
   ↓
8. Frontend updates:
   - Messages page: score banner
   - Risk Dashboard: sparkline, activity log, tier counters
```

---

## Environment Variables

### `python-backend/.env`
```env
DATABASE_URL=postgresql+psycopg://postgres:password@localhost:5432/vasl
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.0-flash-001
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=60
```

### `backend/.env`
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/vasl_ts"
JWT_SECRET="your-secret-key"
PORT=4000
```

### `frontend/.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379/0
ORG_ID=org_univ_maryland
NEXT_PUBLIC_MEMBER_TOKEN_AMARA=mbr_bf18c4d442624cd09a06
```

---

## How to Start

See `START.md` for quick start or `SETUP.md` for detailed setup.

**Quick version:**
```bash
# Terminal 1 — Python FastAPI
cd python-backend
.venv\Scripts\activate
uvicorn main:app --reload --loop asyncio --port 8000

# Terminal 2 — TypeScript Express
cd backend
npm run dev

# Terminal 3 — Next.js
cd frontend
npm run dev

# Terminal 4 — BullMQ Worker
cd frontend
node worker.mjs
```

---

## What Can Be Deleted

Once you've confirmed everything works:
- `AI-LAP/` folder — all code migrated to `python-backend/` and `frontend/`

---

## Next Steps

1. **Test the LLM pipeline**: Send a message in `/messages` → watch worker terminal → see live updates
2. **Connect auth**: Wire frontend to TypeScript backend `/api/auth` endpoints
3. **Add member profiles**: Link to Python backend risk scores
4. **Deploy**: Vercel (frontend), Railway/Render (backends), Upstash (Redis)
