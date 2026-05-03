from fastapi import APIRouter, Query

from app.dependencies import CurrentUser, DbConn
from app.schemas.users import UpdateUserIn, UserOut, UserPublicOut

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def get_me(current_user: CurrentUser, db: DbConn) -> UserOut:
    raise NotImplementedError


@router.put("/me", response_model=UserOut)
async def update_me(body: UpdateUserIn, current_user: CurrentUser, db: DbConn) -> UserOut:
    raise NotImplementedError


@router.get("", response_model=UserPublicOut)
async def lookup_user(current_user: CurrentUser, db: DbConn, email: str = Query(...)) -> UserPublicOut:
    raise NotImplementedError
