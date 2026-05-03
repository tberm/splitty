from fastapi import FastAPI

from app.dependencies import get_current_user, get_db  # noqa: F401 — re-exported for test overrides
from app.routers import auth, expenses, groups, receipts, settlements, users

app = FastAPI(title="Splitty", version="0.1.0")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(expenses.router)
app.include_router(expenses.group_router)
app.include_router(settlements.router)
app.include_router(receipts.router)
