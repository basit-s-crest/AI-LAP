"""
db/connection.py
----------------
PostgreSQL connection factory.

Reads all connection parameters from environment variables via config.py.
Returns a raw psycopg2 connection — no pooling at this layer; add
connection pooling (e.g. psycopg2.pool or pgbouncer) at the infra layer
if needed.
"""

import psycopg2
import psycopg2.extensions

from vasl_db.config import (
    DB_HOST, DB_PORT, DB_NAME,
    DB_USER, DB_PASSWORD, DB_SSLMODE,
)


def get_connection() -> psycopg2.extensions.connection:
    """Open and return a new PostgreSQL connection."""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        sslmode=DB_SSLMODE,
    )
