from datetime import datetime
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field


# --- Payments ---

class PaymentOut(BaseModel):
    id: int
    paid_by: int
    amount: int
    paid_at: datetime
    notes: Optional[str]


class PaymentIn(BaseModel):
    paid_by: int
    amount: int
    paid_at: Optional[datetime] = None
    notes: Optional[str] = None


# --- Participants ---

class ParticipantOut(BaseModel):
    user_id: int
    name: str
    acknowledged: bool


# --- Self-assignment ---

class AssignmentAttributionIn(BaseModel):
    item_id: int
    amount: Optional[int] = None
    instances: Optional[int] = None


class SubmitAssignmentIn(BaseModel):
    attributions: list[AssignmentAttributionIn]
    acknowledged: Optional[bool] = True


class AssignmentAttributionOut(BaseModel):
    item_id: int
    amount: Optional[int] = None
    instances: Optional[int] = None


class AssignmentOut(BaseModel):
    user_id: int
    name: str
    acknowledged: bool
    attributions: list[AssignmentAttributionOut]


# --- Attributions (simple expenses) ---

class SimpleAttributionOut(BaseModel):
    user_id: int
    amount: Optional[int]


class SimpleAttributionIn(BaseModel):
    user_id: int
    amount: Optional[int] = None


# --- Items ---

class ItemAttributionOut(BaseModel):
    user_id: int
    amount: Optional[int] = None
    instances: Optional[int] = None


class ItemAttributionIn(BaseModel):
    user_id: int
    amount: Optional[int] = None
    instances: Optional[int] = None


class ItemOut(BaseModel):
    id: int
    name: str
    unit_price: int
    quantity: int
    item_total: int
    split_method: Optional[Literal["explicit", "instances"]]
    attributions: list[ItemAttributionOut]


class ItemIn(BaseModel):
    id: Optional[int] = None
    name: str
    unit_price: int
    quantity: int


class CreateItemIn(BaseModel):
    name: str
    unit_price: int
    quantity: int
    attributions: list[ItemAttributionIn] = []


# --- Effective attributions ---

class EffectiveAttributionOut(BaseModel):
    user_id: int
    name: str
    effective_amount: int


# --- Expense create requests ---

class _CreateExpenseBase(BaseModel):
    title: str
    notes: Optional[str] = None
    currency: str = "GBP"
    total_amount: int
    payments: list[PaymentIn]
    participant_ids: Optional[list[int]] = None


class CreateSimpleExpenseIn(_CreateExpenseBase):
    type: Literal["simple"]
    split_method: Literal["even", "explicit"]
    attributions: Optional[list[SimpleAttributionIn]] = None


class CreateItemisedExpenseIn(_CreateExpenseBase):
    type: Literal["itemised"]
    request_self_assignments: bool = False
    receipt_image_key: Optional[str] = None
    items: Optional[list[CreateItemIn]] = None


CreateExpenseIn = Annotated[
    Union[CreateSimpleExpenseIn, CreateItemisedExpenseIn],
    Field(discriminator="type"),
]


# --- Expense update requests (core fields only) ---

class _UpdateExpenseBase(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    currency: Optional[str] = None
    total_amount: Optional[int] = None


class UpdateSimpleExpenseIn(_UpdateExpenseBase):
    type: Literal["simple"]
    split_method: Optional[Literal["even", "explicit"]] = None


class UpdateItemisedExpenseIn(_UpdateExpenseBase):
    type: Literal["itemised"]
    request_self_assignments: Optional[bool] = None
    receipt_image_key: Optional[str] = None


UpdateExpenseIn = Annotated[
    Union[UpdateSimpleExpenseIn, UpdateItemisedExpenseIn],
    Field(discriminator="type"),
]


# --- Expense responses ---

class _ExpenseSummaryBase(BaseModel):
    id: int
    title: str
    currency: str
    total_amount: int
    created_by: int
    created_at: datetime


class SimpleExpenseSummaryOut(_ExpenseSummaryBase):
    type: Literal["simple"]


class ItemisedExpenseSummaryOut(_ExpenseSummaryBase):
    type: Literal["itemised"]
    request_self_assignments: bool


ExpenseSummaryOut = Annotated[
    Union[SimpleExpenseSummaryOut, ItemisedExpenseSummaryOut],
    Field(discriminator="type"),
]


class _ExpenseDetailBase(BaseModel):
    id: int
    group_id: int
    title: str
    notes: Optional[str]
    currency: str
    total_amount: int
    created_by: int
    created_at: datetime
    has_receipt: bool
    payments: list[PaymentOut]
    participants: list[ParticipantOut]


class SimpleExpenseDetailOut(_ExpenseDetailBase):
    type: Literal["simple"]
    split_method: Literal["even", "explicit"]


class ItemisedExpenseDetailOut(_ExpenseDetailBase):
    type: Literal["itemised"]
    request_self_assignments: bool
    items: list[ItemOut]


ExpenseDetailOut = Annotated[
    Union[SimpleExpenseDetailOut, ItemisedExpenseDetailOut],
    Field(discriminator="type"),
]


class ReceiptImageOut(BaseModel):
    url: str
    expires_at: datetime


class PaginatedExpenses(BaseModel):
    items: list[ExpenseSummaryOut]
    total: int
    page: int
    page_size: int
