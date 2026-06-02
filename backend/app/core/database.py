"""
database.py
-----------
Single place to configure the database connection.

To switch databases, change DATABASE_URL in your .env file:

  Windows local Postgres:
    DATABASE_URL=postgresql+psycopg://postgres:yourpassword@localhost:5432/vasl

  Docker Postgres:
    DATABASE_URL=postgresql+psycopg://vasl_user:vasl_local_pass@localhost:5432/vasl

  Cloud (Supabase / Neon):
    DATABASE_URL=postgresql+psycopg://user:pass@db.xyz.supabase.co:5432/postgres

Uses psycopg v3 (pure Python) — works on Python 3.14 without a C compiler.
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory absolutely
load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent.parent / ".env")

# ── Change your database here (or in .env) ────────────────────────────────────
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://postgres:yourpassword@localhost:5432/vasl"
)
# ─────────────────────────────────────────────────────────────────────────────

engine = create_async_engine(
    DATABASE_URL,
    echo=False,       # set True to log all SQL queries during development
    pool_pre_ping=True,
)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

Base = declarative_base()


async def get_db():
    """FastAPI dependency — yields a DB session per request."""
    async with AsyncSessionLocal() as session:
        yield session
