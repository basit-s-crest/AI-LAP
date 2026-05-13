# VASL ALAP — Python FastAPI Backend

LLM inference pipeline, ingestion gateway, and dashboard APIs.

## Setup

### 1. Install uv (fast Python package manager)

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Mac / Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. Create virtual environment (Python 3.12 recommended)

```bash
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

### 3. Install dependencies

```bash
uv pip install -r requirements.txt
```

### 4. Configure environment

Copy `.env` and fill in your values:

```env
DATABASE_URL=postgresql+psycopg://postgres:yourpassword@localhost:5432/vasl
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-2.0-flash-001
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=60
```

### 5. Run database migrations

```bash
python -m app.migrate
```

### 6. Start the server

```bash
# Windows
uvicorn main:app --reload --loop asyncio --port 8000

# Mac/Linux
uvicorn main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Database (Docker)

```bash
cd vasl-db
docker-compose up -d
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/ingest/chat` | Ingest chat message → LLM inference |
| POST | `/v1/ingest/peer-post` | Ingest peer post |
| POST | `/v1/ingest/journal` | Ingest journal entry |
| POST | `/v1/ingest/assessment` | Ingest assessment response |
| POST | `/v1/store-result` | Save inference result to DB |
| POST | `/v1/review/action` | Submit clinician review |
| GET | `/v1/results/member/{token}` | Member risk history |
| GET | `/v1/admin/summary/{org_id}` | Org-level admin summary |
| GET | `/health` | Health check |
