from fastapi import APIRouter

from app.dependencies import DbConn
from app.schemas.auth import AccessTokenOut, LoginIn, RefreshIn, RegisterIn, TokenOut
from app.schemas.users import UserOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: RegisterIn, db: DbConn) -> UserOut:
    raise NotImplementedError


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, db: DbConn) -> TokenOut:
    raise NotImplementedError


@router.post("/refresh", response_model=AccessTokenOut)
async def refresh(body: RefreshIn, db: DbConn) -> AccessTokenOut:
    raise NotImplementedError
