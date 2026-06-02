"""
migrate.py
----------
Applies all SQL migration files from vasl-db/migrations/ to your
local Postgres database in filename order (V1 → V9).

Safe to run multiple times — already-applied migrations are skipped
via a migrations_log table.

Usage:
    python -m app.migrate

Requirements:
    pip install psycopg2-binary python-dotenv
"""

import os
import re
import sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / ".env")

# psycopg2 (sync) is used here because this is a one-off CLI script,
# not an async web request.
try:
    import psycopg
except ImportError:
    print("ERROR: psycopg not installed. Run: uv pip install -r requirements.txt")
    sys.exit(1)


def get_sync_dsn() -> str:
    """Convert SQLAlchemy URL to plain psycopg DSN."""
    url = os.getenv("DATABASE_URL", "")
    # strip the SQLAlchemy dialect prefix
    return (url
            .replace("postgresql+psycopg://", "postgresql://")
            .replace("postgresql+asyncpg://", "postgresql://"))


MIGRATIONS_DIR = Path(__file__).parent.parent / "vasl-db" / "migrations"


def run_migrations():
    dsn = get_sync_dsn()
    if not dsn:
        print("ERROR: DATABASE_URL not set in .env")
        sys.exit(1)

    print(f"Connecting to: {dsn.split('@')[-1]}")  # hide credentials in output

    conn = psycopg.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()

    # Create tracking table if it doesn't exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS migrations_log (
            id         SERIAL PRIMARY KEY,
            filename   VARCHAR(256) NOT NULL UNIQUE,
            applied_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    """)
    conn.commit()

    # Get already-applied migrations
    cur.execute("SELECT filename FROM migrations_log")
    applied = {row[0] for row in cur.fetchall()}

    # Find all V*.sql files, sorted by filename
    sql_files = sorted(
        MIGRATIONS_DIR.glob("V*.sql"),
        key=lambda p: [int(x) if x.isdigit() else x for x in re.split(r'(\d+)', p.name)]
    )

    if not sql_files:
        print(f"No migration files found in {MIGRATIONS_DIR}")
        return

    new_count = 0
    for sql_file in sql_files:
        if sql_file.name in applied:
            print(f"  SKIP  {sql_file.name} (already applied)")
            continue

        print(f"  RUN   {sql_file.name} ...", end=" ", flush=True)
        sql = sql_file.read_text(encoding="utf-8")

        try:
            cur.execute(sql)
            cur.execute(
                "INSERT INTO migrations_log (filename) VALUES (%s)",
                (sql_file.name,)
            )
            conn.commit()
            print("OK")
            new_count += 1
        except Exception as exc:
            conn.rollback()
            print(f"FAILED\n\nERROR in {sql_file.name}:\n{exc}")
            sys.exit(1)

    cur.close()
    conn.close()

    if new_count == 0:
        print("\nDatabase is already up to date.")
    else:
        print(f"\nApplied {new_count} migration(s) successfully.")


if __name__ == "__main__":
    run_migrations()
