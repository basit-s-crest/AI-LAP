import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

engine = create_async_engine('postgresql+asyncpg://postgres:lina_4322@10.151.90.48:5432/VASL')

async def test():
    async with engine.connect() as conn:
        print('Connected successfully!')

asyncio.run(test())