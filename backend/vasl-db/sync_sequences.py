import os
import psycopg
from pathlib import Path
from dotenv import load_dotenv

# Load .env
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found in env.")
    db_url = "postgresql://postgres:Read#123@localhost:5432/vasl"

# Convert standard sqlalchemy connection string to psycopg format if needed
if "postgresql+psycopg://" in db_url:
    db_url = db_url.replace("postgresql+psycopg://", "postgresql://")

print("Connecting to database to sync sequences...")

try:
    conn = psycopg.connect(db_url)
    conn.autocommit = True
    cur = conn.cursor()
    
    # Query to find all sequences and their corresponding tables/columns
    query = """
    SELECT 
        s.relname AS seq_name,
        t.relname AS table_name,
        c.attname AS column_name
    FROM pg_class s
    JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass
    JOIN pg_class t ON t.oid = d.refobjid
    JOIN pg_attribute c ON c.attrelid = d.refobjid AND c.attnum = d.refobjsubid
    WHERE s.relkind = 'S' AND d.deptype = 'a';
    """
    
    cur.execute(query)
    sequences = cur.fetchall()
    
    if not sequences:
        print("No sequences found.")
    else:
        for seq_name, table_name, column_name in sequences:
            # We want to reset each sequence to max(column_name)
            # COALESCE handles empty tables by starting the sequence at 1
            sql = f"""
            SELECT setval(
                '{seq_name}', 
                COALESCE((SELECT MAX({column_name}) FROM "{table_name}"), 1), 
                true
            );
            """
            try:
                cur.execute(sql)
                new_val = cur.fetchone()[0]
                print(f"Syncing sequence '{seq_name}' for table '{table_name}({column_name})' to: {new_val}")
            except Exception as e:
                print(f"Failed to sync sequence '{seq_name}': {e}")
                
    conn.close()
    print("Sequence sync completed successfully.")
except Exception as e:
    print(f"Database error: {e}")
