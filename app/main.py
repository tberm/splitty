import os

import asyncpg
from fastapi import FastAPI

app = FastAPI(title="Splitty")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql:///splitty",
)


async def get_db() -> asyncpg.Connection:
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        await conn.close()
