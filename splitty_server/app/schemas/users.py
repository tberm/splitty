from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime


class UserPublicOut(BaseModel):
    id: int
    name: str
    email: str


class UpdateUserIn(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
