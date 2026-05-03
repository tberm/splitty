from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.schemas.expenses import ExpenseSummaryOut


class GroupMemberOut(BaseModel):
    user_id: int
    name: str
    email: str
    joined_at: datetime


class GroupListItemOut(BaseModel):
    id: int
    name: str
    created_by: int
    created_at: datetime
    member_count: int


class GroupDetailOut(BaseModel):
    id: int
    name: str
    created_by: int
    created_at: datetime
    members: list[GroupMemberOut]


class CreateGroupIn(BaseModel):
    name: str


class UpdateGroupIn(BaseModel):
    name: Optional[str] = None


class AddMemberIn(BaseModel):
    user_id: int


class BalanceOut(BaseModel):
    user_id: int
    name: str
    net_balance: int


class CreateSettlementIn(BaseModel):
    paid_by: int
    paid_to: int
    amount: int
    settled_at: Optional[datetime] = None
    notes: Optional[str] = None


class SettlementOut(BaseModel):
    id: int
    group_id: int
    paid_by: int
    paid_to: int
    amount: int
    settled_at: datetime
    notes: Optional[str]


class PaginatedSettlements(BaseModel):
    items: list[SettlementOut]
    total: int
    page: int
    page_size: int


class GroupSummaryOut(BaseModel):
    group: GroupDetailOut
    balances: list[BalanceOut]
    recent_expenses: list[ExpenseSummaryOut]
