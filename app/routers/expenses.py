from fastapi import APIRouter

from app.dependencies import CurrentUser, DbConn
from app.schemas.expenses import (
    AssignmentOut,
    CreateExpenseIn,
    EffectiveAttributionOut,
    ExpenseDetailOut,
    ItemAttributionIn,
    ItemAttributionOut,
    ItemIn,
    ItemOut,
    PaginatedExpenses,
    ParticipantOut,
    PaymentIn,
    PaymentOut,
    ReceiptImageOut,
    SimpleAttributionIn,
    SimpleAttributionOut,
    SubmitAssignmentIn,
    UpdateExpenseIn,
)

router = APIRouter(prefix="/api/v1/expenses", tags=["expenses"])
group_router = APIRouter(prefix="/api/v1/groups", tags=["expenses"])


@group_router.get("/{group_id}/expenses", response_model=PaginatedExpenses)
async def list_expenses(
    group_id: int,
    current_user: CurrentUser,
    db: DbConn,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedExpenses:
    """List expenses in a group, paginated."""
    raise NotImplementedError


@group_router.post("/{group_id}/expenses", response_model=ExpenseDetailOut, status_code=201)
async def create_expense(
    group_id: int,
    body: CreateExpenseIn,
    current_user: CurrentUser,
    db: DbConn,
) -> ExpenseDetailOut:
    """
    Create a new expense in a group.

    Expense creation is done in a single step - the user submits all the
    information about the expense, including payments, participants,
    attributions (if any), and items (if itemised). 
    """
    raise NotImplementedError


@router.get("/{expense_id}", response_model=ExpenseDetailOut)
async def get_expense(expense_id: int, current_user: CurrentUser, db: DbConn) -> ExpenseDetailOut:
    """
    Get details of an expense, including payments, participants, attributions
    (if any), and items (if itemised).
    """
    raise NotImplementedError


# --- Updates to different parts of an expense ---

@router.put("/{expense_id}", response_model=ExpenseDetailOut)
async def update_expense(
    expense_id: int, body: UpdateExpenseIn, current_user: CurrentUser, db: DbConn
) -> ExpenseDetailOut:
    """
    Update the core details of an expense.

    Unlike expense creation, different parts of the expense are updated
    separately. This is to reduce problems due to concurrent updates and reduce
    how much data needs to be sent when only a small part of the expense is
    changing.
    """
    raise NotImplementedError


@router.put("/{expense_id}/payments", response_model=list[PaymentOut])
async def set_payments(
    expense_id: int, body: list[PaymentIn], current_user: CurrentUser, db: DbConn
) -> list[PaymentOut]:
    """
    Set the payments for an expense. This updates all payments for the expense
    to match the provided list.
    """
    raise NotImplementedError


@router.put("/{expense_id}/participants", response_model=list[ParticipantOut])
async def set_participants(
    expense_id: int, body: list[int], current_user: CurrentUser, db: DbConn
) -> list[ParticipantOut]:
    """
    Set the participants for an expense. This updates all participants for the
    expense to match the provided list.
    """
    raise NotImplementedError


@router.put("/{expense_id}/attributions", response_model=list[SimpleAttributionOut])
async def set_attributions(
    expense_id: int, body: list[SimpleAttributionIn], current_user: CurrentUser, db: DbConn
) -> list[SimpleAttributionOut]:
    """
    Set the explicit attributions for an expense. This updates all attributions
    for the expense to match the provided list. Only used for simple expenses;
    itemised expenses use item attributions instead.
    """
    raise NotImplementedError


@router.put("/{expense_id}/items", response_model=list[ItemOut])
async def set_items(
    expense_id: int, body: list[ItemIn], current_user: CurrentUser, db: DbConn
) -> list[ItemOut]:
    """
    Set the items for an itemised expense.

    Items in the list will be matched to existing items by their ID (if they
    have one). Items without an ID will be treated as new and created. Any
    existing items that are not included in the list will be deleted.

    Item attributions are not managed here. New items will start with no
    attributions, and existing items keep their existing attributions.
    """
    raise NotImplementedError


@router.put("/{expense_id}/items/{item_id}/attributions", response_model=list[ItemAttributionOut])
async def set_item_attributions(
    expense_id: int, item_id: int, body: list[ItemAttributionIn], current_user: CurrentUser, db: DbConn
) -> list[ItemAttributionOut]:
    """
    Set the list of attributions for an item in an itemised expense.

    This replaces all attributions for the item with the provided list. Note that
    when users go through the self-assignment flow they use `submit_assignment`
    instead, which allows them to update their attribution without affecting other
    attributions for the item.
    """
    raise NotImplementedError


@router.put("/{expense_id}/participants/{user_id}/assignment", response_model=AssignmentOut)
async def submit_assignment(
    expense_id: int, user_id: int, body: SubmitAssignmentIn, current_user: CurrentUser, db: DbConn
) -> AssignmentOut:
    """
    Submit a user's self-assigned attributions for an itemised expense.
    """
    raise NotImplementedError


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(expense_id: int, current_user: CurrentUser, db: DbConn) -> None:
    """Delete an expense."""
    raise NotImplementedError


@router.get("/{expense_id}/receipt-image", response_model=ReceiptImageOut)
async def get_receipt_image(expense_id: int, current_user: CurrentUser, db: DbConn) -> ReceiptImageOut:
    raise NotImplementedError


@router.get("/{expense_id}/effective-attributions", response_model=list[EffectiveAttributionOut])
async def get_effective_attributions(
    expense_id: int, current_user: CurrentUser, db: DbConn
) -> list[EffectiveAttributionOut]:
    """Get the effective attributions for an expense, after handling any unassigned amounts."""
    raise NotImplementedError

