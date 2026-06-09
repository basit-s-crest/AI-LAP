"""
migrate.py
----------
Simple migration runner for the Python side (vasl-db).

Tracks applied migrations in a `schema_migrations` table.
Runs only new V*.sql files in order — safe to run multiple times.

Usage:
    uv run python vasl-db/migrate.py

Add a new migration:
    1. Create  vasl-db/migrations/V14__your_change.sql
    2. Run this script — it will apply only the new file
"""

import os
import re
import sys
from pathlib import Path

import psycopg2

# ── Connection ────────────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL", "").replace("postgresql+psycopg://", "postgresql://")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in environment.")
    sys.exit(1)

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def get_version(filename: str) -> int:
    """Extract version number from V14__name.sql → 14"""
    match = re.match(r"V(\d+)__", filename)
    return int(match.group(1)) if match else -1


def run():
    conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    conn.autocommit = True
    cur = conn.cursor()

    # Create tracking table if it doesn't exist
    cur.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version     INTEGER     PRIMARY KEY,
            filename    TEXT        NOT NULL,
            applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # Get already-applied versions
    cur.execute("SELECT version FROM schema_migrations")
    applied = {row[0] for row in cur.fetchall()}

    # Collect and sort V*.sql files
    migration_files = sorted(
        [f for f in MIGRATIONS_DIR.glob("V*.sql")],
        key=lambda f: get_version(f.name),
    )

    pending = [f for f in migration_files if get_version(f.name) not in applied]

    if not pending:
        print("Nothing to migrate — already up to date.")
        conn.close()
        return

    for filepath in pending:
        version = get_version(filepath.name)
        print(f"  Applying {filepath.name} ...", end=" ")

        sql = filepath.read_text(encoding="utf-8")

        try:
            cur.execute(sql)
            cur.execute(
                "INSERT INTO schema_migrations (version, filename) VALUES (%s, %s)",
                (version, filepath.name),
            )
            print("OK")
        except Exception as exc:
            print(f"FAILED\n  → {exc}")
            conn.close()
            sys.exit(1)

    print(f"\nDone — {len(pending)} migration(s) applied.")
    conn.close()


if __name__ == "__main__":
    run()
