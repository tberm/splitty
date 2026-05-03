import os
from typing import Annotated, AsyncGenerator

import asyncpg
from fastapi import Depends, Header, HTTPException

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql:///splitty")


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        yield conn
    finally:
        await conn.close()


async def get_current_user(
    db: Annotated[asyncpg.Connection, Depends(get_db)],
    x_user_id: Annotated[int, Header()],
) -> asyncpg.Record:
    """Production stub: trusts X-User-Id header unconditionally."""
    user = await db.fetchrow("SELECT * FROM users WHERE id = $1", x_user_id)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


DbConn = Annotated[asyncpg.Connection, Depends(get_db)]
CurrentUser = Annotated[asyncpg.Record, Depends(get_current_user)]
