# VASL ALAP — Project Setup Guide

---

## Prerequisites

- Python **3.12** (recommended — all packages have pre-built wheels for 3.12)
  - Python 3.13+ is not recommended — some packages don't have wheels yet and will fail to build
- PostgreSQL installed and running locally
- Git

---

## Step 1 — Install uv

`uv` is a fast Python package manager. Install it once on your machine.

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Mac / Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Verify it installed:
```bash
uv --version
```

---

## Step 2 — Clone the repo and enter the project

```bash
git clone <your-repo-url>
cd <project-folder>
```

---

## Step 3 — Create a virtual environment with Python 3.12

If you have Python 3.13 or 3.14 installed, uv can install 3.12 for you automatically:

```bash
uv python install 3.12
uv venv --python 3.12
```

If you already have Python 3.12:
```bash
uv venv
```

This creates a `.venv` folder in the project root.

**Activate it:**

Windows (PowerShell):
```powershell
.venv\Scripts\activate
```

Mac / Linux:
```bash
source .venv/bin/activate
```

You should see `(.venv)` at the start of your terminal prompt.

---

## Step 4 — Install all dependencies

```bash
uv pip install -r requirements.txt
```

This installs:
- `fastapi` — web framework
- `uvicorn` — ASGI server
- `sqlalchemy[asyncio]` — async ORM
- `asyncpg` — async Postgres driver
- `psycopg[pool]` — async + sync Postgres driver, pure Python (works on Python 3.14, no C compiler needed)
- `pydantic` — data validation
- `python-dotenv` — loads .env file

---

## Step 5 — Configure your database

Copy the example env file and edit it:

```bash
cp .env.example .env   # if .env.example exists
# or just open .env directly
```

Open `.env` and set your Postgres connection:

```
DATABASE_URL=postgresql+asyncpg://postgres:yourpassword@localhost:5432/vasl
```

Replace `yourpassword` with your actual Postgres password.

Then create the `vasl` database in Postgres if it doesn't exist:

```bash
# Using psql
psql -U postgres -c "CREATE DATABASE vasl;"
```

Or create it through pgAdmin.

---

## Step 6 — Run migrations

This creates all tables and loads 1000 rows of seed data:

```bash
python -m app.migrate
```

You should see output like:
```
  RUN   V1__create_members.sql ... OK
  RUN   V2__create_inference_events.sql ... OK
  ...
  RUN   V9__seed_1000_events.sql ... OK

Applied 9 migration(s) successfully.
```

Run this command again whenever new migration files are added — already-applied ones are skipped automatically.

---

## Step 7 — Start the API server

```bash
uvicorn main:app --reload
```

The server starts at `http://localhost:8000`

---

## Step 8 — Open the app

| URL | What it is |
|---|---|
| `http://localhost:8000/` | Therapist dashboard (frontend) |
| `http://localhost:8000/docs` | Interactive API docs (Swagger UI) |
| `http://localhost:8000/health` | Health check |

On the dashboard, paste any member token from the seed data to see it working.
Example token: check your database with:
```bash
psql -U postgres -d vasl -c "SELECT member_token FROM members LIMIT 5;"
```

---

## Daily workflow

```bash
# 1. Activate venv (if not already active)
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Mac/Linux

# 2. Pull latest changes
git pull

# 3. Apply any new migrations
python -m app.migrate

# 4. Start the server
uvicorn main:app --reload
```

---

## Troubleshooting

**`pydantic-core` or other packages fail to build (C compiler error)**
You're on Python 3.13 or 3.14. Run:
```bash
uv python install 3.12
uv venv --python 3.12
.venv\Scripts\activate
uv pip install -r requirements.txt
```

**`connection refused` on database**
Make sure PostgreSQL is running. On Windows, check Services or pgAdmin.

**`database "vasl" does not exist`**
Run: `psql -U postgres -c "CREATE DATABASE vasl;"`

**`password authentication failed`**
Check the password in your `.env` matches your Postgres user password.

**Port 8000 already in use**
Run on a different port: `uvicorn main:app --reload --port 8001`
