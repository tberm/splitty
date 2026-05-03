import os

import asyncpg
from fastapi import Depends
from typing import Annotated, AsyncGenerator

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql:///splitty")


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        await conn.close()


async def get_current_user(
    db: Annotated[asyncpg.Connection, Depends(get_db)],
) -> asyncpg.Record:
    """Overridden in tests. Production implementation will validate a JWT."""
    raise NotImplementedError


DbConn = Annotated[asyncpg.Connection, Depends(get_db)]
CurrentUser = Annotated[asyncpg.Record, Depends(get_current_user)]
