"""
migrate_data_to_supabase.py
---------------------------
Copies all data from two local PostgreSQL databases into the
single Supabase database.

  Source 1: vasl_ts  (TypeScript / Prisma tables)
  Source 2: vasl     (Python / AI inference tables)
  Target:   Supabase postgres

Run:
    uv run python vasl-db/migrate_data_to_supabase.py

Requirements:
    - Supabase schema must already exist (run supabase_consolidated.sql first)
    - psycopg2-binary must be installed  (uv pip install psycopg2-binary)
"""

import sys
import json
import psycopg2
import psycopg2.extras
from psycopg2.extras import Json
from psycopg2.extensions import adapt, register_adapter, AsIs

# Teach psycopg2 to send Python lists as PostgreSQL TEXT[] arrays
def _adapt_list(lst):
    if not lst:
        return AsIs("'{}'")
    items = ",".join(
        adapt(str(i)).getquoted().decode() for i in lst
    )
    return AsIs(f"ARRAY[{items}]")

register_adapter(list, _adapt_list)

# ── Connection strings ────────────────────────────────────────────────────────
LOCAL_VASL_TS  = "postgresql://postgres:Read#123@localhost:5432/vasl_ts"
LOCAL_VASL     = "postgresql://postgres:Read#123@localhost:5432/vasl"
SUPABASE       = "postgresql://postgres.yadujibjugyegtombulb:crest2026cipl@aws-1-ap-northeast-1.pooler.supabase.com:6543/postgres"
SUPABASE_SSL   = {"sslmode": "require"}

# ── Table groups ──────────────────────────────────────────────────────────────
# Order matters — parent tables before child tables (FK constraints)

VASL_TS_TABLES = [
    "Organization",
    "User",
    "Coach",
    "OrganizationCoach",
    "CoachMember",
    "EmailVerification",
    "CommunityGroup",
    "GroupMembership",
    "PeerGroupPost",
    "Message",
    "CoachMessage",
    "Mood",
    "Session",
    "CoachAvailability",
    "SessionNote",
    "OnboardingAssessment",
    "PlatformSettings",
    "WeeklyReport",
]

VASL_TABLES = [
    "members",
    "inference_events",
    "event_signals",
    "shap_attributions",
    "review_actions",
    "member_risk_snapshots",
    "request_logs",
    "pipeline_runs",
    "pipeline_stage_logs",
]


def connect(dsn: str, ssl: dict = None) -> psycopg2.extensions.connection:
    kwargs = ssl or {}
    return psycopg2.connect(dsn, **kwargs)


def copy_table(
    src_conn,
    dst_conn,
    table: str,
    quoted: bool = False,
) -> int:
    """
    Copy all rows from src table → dst table.
    quoted=True wraps the table name in double quotes (Prisma PascalCase tables).
    Returns number of rows copied.
    """
    tname = f'"{table}"' if quoted else table

    src_cur = src_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    dst_cur = dst_conn.cursor()

    # Get column types so we know which ones are arrays / JSONB
    src_cur.execute("""
        SELECT column_name, udt_name
        FROM information_schema.columns
        WHERE table_name = %s
        ORDER BY ordinal_position
    """, (table,))
    col_types = {r["column_name"]: r["udt_name"] for r in src_cur.fetchall()}

    src_cur.execute(f"SELECT * FROM {tname}")
    rows = src_cur.fetchall()

    if not rows:
        return 0

    columns = list(rows[0].keys())
    col_str = ", ".join(f'"{c}"' if quoted else c for c in columns)
    placeholders = ", ".join(["%s"] * len(columns))

    dst_cur.execute("""
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = %s AND constraint_type = 'PRIMARY KEY'
    """, (table,))
    has_pk = dst_cur.fetchone() is not None

    if has_pk:
        insert_sql = f"INSERT INTO {tname} ({col_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING"
    else:
        insert_sql = f"INSERT INTO {tname} ({col_str}) VALUES ({placeholders})"

    def coerce(col, val):
        if val is None:
            return None
        udt = col_types.get(col, "")
        # JSONB columns — always wrap with Json(), even if it's a list
        if udt == "jsonb":
            if isinstance(val, str):
                try:
                    return Json(json.loads(val))
                except (json.JSONDecodeError, ValueError):
                    pass
            return Json(val)
        # dict (non-jsonb edge case) → also wrap
        if isinstance(val, dict):
            return Json(val)
        # TEXT[] / INT[] lists — pass through, register_adapter handles them
        if isinstance(val, list):
            return val
        return val

    data = [tuple(coerce(c, row[c]) for c in columns) for row in rows]
    psycopg2.extras.execute_batch(dst_cur, insert_sql, data, page_size=200)
    dst_conn.commit()

    return len(rows)


def migrate_group(src_dsn: str, tables: list, quoted: bool, label: str):
    print(f"\n{'='*55}")
    print(f"  Migrating: {label}")
    print(f"{'='*55}")

    src_conn = connect(src_dsn)
    dst_conn = connect(SUPABASE, SUPABASE_SSL)

    # Disable triggers on dst temporarily so snapshot trigger
    # doesn't fire on every inference_events insert (we copy
    # member_risk_snapshots directly instead)
    dst_cur = dst_conn.cursor()
    dst_cur.execute("SET session_replication_role = replica;")
    dst_conn.commit()

    total = 0
    for table in tables:
        try:
            count = copy_table(src_conn, dst_conn, table, quoted=quoted)
            status = f"{count} rows" if count else "empty"
            print(f"  ✓  {table:<30} {status}")
            total += count
        except Exception as exc:
            print(f"  ✗  {table:<30} FAILED → {exc}")
            dst_conn.rollback()

    # Re-enable triggers
    dst_cur.execute("SET session_replication_role = DEFAULT;")
    dst_conn.commit()

    src_conn.close()
    dst_conn.close()
    print(f"\n  Total rows migrated: {total}")


def main():
    print("\nVASL → Supabase data migration")
    print("Connecting to Supabase...", end=" ")
    try:
        test = connect(SUPABASE, SUPABASE_SSL)
        test.close()
        print("OK")
    except Exception as exc:
        print(f"FAILED\n{exc}")
        sys.exit(1)

    migrate_group(
        src_dsn=LOCAL_VASL_TS,
        tables=VASL_TS_TABLES,
        quoted=True,           # Prisma uses PascalCase quoted table names
        label="vasl_ts  →  Supabase (TypeScript tables)",
    )

    migrate_group(
        src_dsn=LOCAL_VASL,
        tables=VASL_TABLES,
        quoted=False,          # Python uses lowercase table names
        label="vasl  →  Supabase (Python / AI tables)",
    )

    print("\n✓  Migration complete.\n")


if __name__ == "__main__":
    main()
