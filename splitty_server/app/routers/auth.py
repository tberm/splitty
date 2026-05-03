from fastapi import APIRouter, HTTPException

from app.dependencies import DbConn
from app.schemas.auth import AccessTokenOut, LoginIn, RefreshIn, RegisterIn, TokenOut
from app.schemas.users import UserOut

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


### NOTE: Auth not currently implemented - these are dummy endpoints for testing
### purposes


@router.post("/register", response_model=UserOut, status_code=201)
async def register(body: RegisterIn, db: DbConn) -> UserOut:
    try:
        row = await db.fetchrow(
            "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
            body.name, body.email,
        )
    except Exception:
        raise HTTPException(status_code=409, detail="Email already registered")
    return dict(row)


@router.post("/login", response_model=TokenOut)
async def login(body: LoginIn, db: DbConn) -> TokenOut:
    user = await db.fetchrow("SELECT id FROM users WHERE email = $1", body.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = str(user["id"])
    return TokenOut(access_token=token, refresh_token=token)


@router.post("/refresh", response_model=AccessTokenOut)
async def refresh(body: RefreshIn, db: DbConn) -> AccessTokenOut:
    return AccessTokenOut(access_token=body.refresh_token)
