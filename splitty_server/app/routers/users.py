from fastapi import APIRouter, HTTPException, Query

from app.dependencies import CurrentUser, DbConn
from app.schemas.users import UpdateUserIn, UserOut, UserPublicOut

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: CurrentUser, db: DbConn) -> UserOut:
    return dict(current_user)


@router.put("/me", response_model=UserOut)
async def update_me(body: UpdateUserIn, current_user: CurrentUser, db: DbConn) -> UserOut:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return dict(current_user)
    set_clauses = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(updates))
    row = await db.fetchrow(
        f"UPDATE users SET {set_clauses} WHERE id = $1 RETURNING *",
        current_user["id"], *updates.values(),
    )
    return dict(row)


@router.get("", response_model=UserPublicOut)
async def lookup_user(current_user: CurrentUser, db: DbConn, email: str = Query(...)) -> UserPublicOut:
    row = await db.fetchrow("SELECT id, name, email FROM users WHERE email = $1", email)
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)
