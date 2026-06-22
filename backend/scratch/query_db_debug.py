import os
import sys
import asyncio
from dotenv import load_dotenv
from sqlalchemy import text

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import AsyncSessionLocal

load_dotenv()

async def main():
    async with AsyncSessionLocal() as db:
        print("--- USERS ---")
        res = await db.execute(text('SELECT * FROM public."User" LIMIT 3'))
        for r in res.mappings().all():
            print(dict(r))

        print("\n--- COACHES ---")
        res = await db.execute(text('SELECT * FROM public."Coach" LIMIT 3'))
        for r in res.mappings().all():
            print(dict(r))

        print("\n--- SESSIONS ---")
        res = await db.execute(text('SELECT * FROM public."Session" LIMIT 3'))
        for r in res.mappings().all():
            print(dict(r))

if __name__ == "__main__":
    asyncio.run(main())
