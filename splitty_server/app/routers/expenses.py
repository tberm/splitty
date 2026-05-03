import asyncpg
from fastapi import APIRouter, HTTPException

from app.dependencies import CurrentUser, DbConn
from app.schemas.expenses import (
    AssignmentOut,
    CreateExpenseIn,
    CreateItemisedExpenseIn,
    CreateSimpleExpenseIn,
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
    UpdateItemisedExpenseIn,
    UpdateSimpleExpenseIn,
)

router = APIRouter(prefix="/api/v1/expenses", tags=["expenses"])
group_router = APIRouter(prefix="/api/v1/groups", tags=["expenses"])


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _fetch_expense_detail(db: asyncpg.Connection, expense_id: int) -> dict:
    row = await db.fetchrow(
        """SELECT id, group_id, title, notes, currency, total_amount, type,
                  split_method, request_self_assignments, receipt_image_key,
                  created_by, created_at
           FROM expenses WHERE id = $1""",
        expense_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Expense not found")

    expense = dict(row)
    expense["has_receipt"] = bool(expense.pop("receipt_image_key"))

    payments = await db.fetch(
        "SELECT id, paid_by, amount, paid_at, notes FROM payments WHERE expense_id = $1 ORDER BY id",
        expense_id,
    )
    expense["payments"] = [dict(p) for p in payments]

    participants = await db.fetch(
        """SELECT ep.user_id, u.name, ep.acknowledged
           FROM expense_participants ep
           JOIN users u ON u.id = ep.user_id
           WHERE ep.expense_id = $1
           ORDER BY ep.user_id""",
        expense_id,
    )
    expense["participants"] = [dict(p) for p in participants]

    if expense["type"] == "itemised":
        items = await db.fetch(
            """SELECT id, name, unit_price, quantity,
                      unit_price * quantity AS item_total, split_method
               FROM expense_items WHERE expense_id = $1 ORDER BY id""",
            expense_id,
        )
        items_list = []
        for item in items:
            item_d = dict(item)
            attrs = await db.fetch(
                """SELECT user_id, explicit_amount AS amount, claimed_instances AS instances
                   FROM attributions WHERE expense_item_id = $1 ORDER BY user_id""",
                item["id"],
            )
            item_d["attributions"] = [dict(a) for a in attrs]
            items_list.append(item_d)
        expense["items"] = items_list

    return expense


async def _insert_payments(db: asyncpg.Connection, expense_id: int, payments: list[PaymentIn]) -> None:
    for p in payments:
        await db.execute(
            """INSERT INTO payments (expense_id, paid_by, amount, paid_at, notes)
               VALUES ($1, $2, $3, COALESCE($4, NOW()), $5)""",
            expense_id, p.paid_by, p.amount, p.paid_at, p.notes,
        )


async def _insert_participants(db: asyncpg.Connection, expense_id: int, user_ids: list[int]) -> None:
    for uid in user_ids:
        await db.execute(
            "INSERT INTO expense_participants (expense_id, user_id) VALUES ($1, $2)",
            expense_id, uid,
        )


# ---------------------------------------------------------------------------
# List / create (group-scoped)
# ---------------------------------------------------------------------------

@group_router.get("/{group_id}/expenses", response_model=PaginatedExpenses)
async def list_expenses(
    group_id: int,
    current_user: CurrentUser,
    db: DbConn,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedExpenses:
    total = await db.fetchval("SELECT COUNT(*) FROM expenses WHERE group_id = $1", group_id)
    rows = await db.fetch(
        """SELECT id, title, currency, total_amount, type, created_by, created_at,
                  request_self_assignments
           FROM expenses WHERE group_id = $1
           ORDER BY created_at DESC LIMIT $2 OFFSET $3""",
        group_id, page_size, (page - 1) * page_size,
    )
    return {"items": [dict(r) for r in rows], "total": total, "page": page, "page_size": page_size}


@group_router.post("/{group_id}/expenses", response_model=ExpenseDetailOut, status_code=201)
async def create_expense(
    group_id: int,
    body: CreateExpenseIn,
    current_user: CurrentUser,
    db: DbConn,
) -> ExpenseDetailOut:
    async with db.transaction():
        if isinstance(body, CreateSimpleExpenseIn):
            expense_row = await db.fetchrow(
                """INSERT INTO expenses
                       (group_id, title, notes, currency, total_amount, type, split_method, created_by)
                   VALUES ($1, $2, $3, $4, $5, 'simple', $6::split_method, $7)
                   RETURNING id""",
                group_id, body.title, body.notes, body.currency, body.total_amount,
                body.split_method, current_user["id"],
            )
            expense_id = expense_row["id"]

            await _insert_payments(db, expense_id, body.payments)

            if body.participant_ids is not None:
                participant_ids = body.participant_ids
            elif body.attributions:
                participant_ids = [a.user_id for a in body.attributions]
            else:
                participant_ids = []
            await _insert_participants(db, expense_id, participant_ids)

            if body.attributions:
                for attr in body.attributions:
                    await db.execute(
                        "INSERT INTO attributions (user_id, expense_id, explicit_amount) VALUES ($1, $2, $3)",
                        attr.user_id, expense_id, attr.amount,
                    )

        else:  # itemised
            assert isinstance(body, CreateItemisedExpenseIn)
            expense_row = await db.fetchrow(
                """INSERT INTO expenses
                       (group_id, title, notes, currency, total_amount, type,
                        request_self_assignments, receipt_image_key, created_by)
                   VALUES ($1, $2, $3, $4, $5, 'itemised', $6, $7, $8)
                   RETURNING id""",
                group_id, body.title, body.notes, body.currency, body.total_amount,
                body.request_self_assignments, body.receipt_image_key, current_user["id"],
            )
            expense_id = expense_row["id"]

            await _insert_payments(db, expense_id, body.payments)
            await _insert_participants(db, expense_id, body.participant_ids or [])

            for item in (body.items or []):
                item_row = await db.fetchrow(
                    """INSERT INTO expense_items (expense_id, name, unit_price, quantity)
                       VALUES ($1, $2, $3, $4) RETURNING id""",
                    expense_id, item.name, item.unit_price, item.quantity,
                )
                item_id = item_row["id"]
                for attr in item.attributions:
                    await db.execute(
                        """INSERT INTO attributions
                               (user_id, expense_item_id, explicit_amount, claimed_instances)
                           VALUES ($1, $2, $3, $4)""",
                        attr.user_id, item_id, attr.amount, attr.instances,
                    )

    return await _fetch_expense_detail(db, expense_id)


# ---------------------------------------------------------------------------
# Single-expense operations
# ---------------------------------------------------------------------------

@router.get("/{expense_id}", response_model=ExpenseDetailOut)
async def get_expense(expense_id: int, current_user: CurrentUser, db: DbConn) -> ExpenseDetailOut:
    return await _fetch_expense_detail(db, expense_id)


@router.put("/{expense_id}", response_model=ExpenseDetailOut)
async def update_expense(
    expense_id: int, body: UpdateExpenseIn, current_user: CurrentUser, db: DbConn
) -> ExpenseDetailOut:
    updates: dict = {}
    for field in ("title", "notes", "currency", "total_amount"):
        v = getattr(body, field, None)
        if v is not None:
            updates[field] = v

    if isinstance(body, UpdateSimpleExpenseIn) and body.split_method is not None:
        updates["split_method"] = body.split_method
    elif isinstance(body, UpdateItemisedExpenseIn):
        if body.request_self_assignments is not None:
            updates["request_self_assignments"] = body.request_self_assignments
        if body.receipt_image_key is not None:
            updates["receipt_image_key"] = body.receipt_image_key

    if updates:
        parts = []
        values: list = [expense_id]
        for k, v in updates.items():
            cast = "::split_method" if k == "split_method" else ""
            parts.append(f"{k} = ${len(values) + 1}{cast}")
            values.append(v)
        await db.execute(f"UPDATE expenses SET {', '.join(parts)} WHERE id = $1", *values)

    return await _fetch_expense_detail(db, expense_id)


@router.put("/{expense_id}/payments", response_model=list[PaymentOut])
async def set_payments(
    expense_id: int, body: list[PaymentIn], current_user: CurrentUser, db: DbConn
) -> list[PaymentOut]:
    async with db.transaction():
        await db.execute("DELETE FROM payments WHERE expense_id = $1", expense_id)
        await _insert_payments(db, expense_id, body)
    rows = await db.fetch(
        "SELECT id, paid_by, amount, paid_at, notes FROM payments WHERE expense_id = $1 ORDER BY id",
        expense_id,
    )
    return [dict(r) for r in rows]


@router.put("/{expense_id}/participants", response_model=list[ParticipantOut])
async def set_participants(
    expense_id: int, body: list[int], current_user: CurrentUser, db: DbConn
) -> list[ParticipantOut]:
    async with db.transaction():
        current_rows = await db.fetch(
            "SELECT user_id FROM expense_participants WHERE expense_id = $1", expense_id
        )
        current_ids = {r["user_id"] for r in current_rows}
        new_ids = set(body)

        for uid in current_ids - new_ids:
            try:
                await db.execute(
                    "DELETE FROM expense_participants WHERE expense_id = $1 AND user_id = $2",
                    expense_id, uid,
                )
            except asyncpg.exceptions.RaiseError as e:
                raise HTTPException(status_code=409, detail=str(e))

        for uid in new_ids - current_ids:
            await db.execute(
                "INSERT INTO expense_participants (expense_id, user_id) VALUES ($1, $2)",
                expense_id, uid,
            )

    rows = await db.fetch(
        """SELECT ep.user_id, u.name, ep.acknowledged
           FROM expense_participants ep
           JOIN users u ON u.id = ep.user_id
           WHERE ep.expense_id = $1 ORDER BY ep.user_id""",
        expense_id,
    )
    return [dict(r) for r in rows]


@router.put("/{expense_id}/attributions", response_model=list[SimpleAttributionOut])
async def set_attributions(
    expense_id: int, body: list[SimpleAttributionIn], current_user: CurrentUser, db: DbConn
) -> list[SimpleAttributionOut]:
    async with db.transaction():
        await db.execute(
            "DELETE FROM attributions WHERE expense_id = $1",
            expense_id,
        )
        for attr in body:
            await db.execute(
                "INSERT INTO attributions (user_id, expense_id, explicit_amount) VALUES ($1, $2, $3)",
                attr.user_id, expense_id, attr.amount,
            )
    rows = await db.fetch(
        "SELECT user_id, explicit_amount AS amount FROM attributions WHERE expense_id = $1 ORDER BY user_id",
        expense_id,
    )
    return [dict(r) for r in rows]


@router.put("/{expense_id}/items", response_model=list[ItemOut])
async def set_items(
    expense_id: int, body: list[ItemIn], current_user: CurrentUser, db: DbConn
) -> list[ItemOut]:
    async with db.transaction():
        current_rows = await db.fetch(
            "SELECT id FROM expense_items WHERE expense_id = $1", expense_id
        )
        current_ids = {r["id"] for r in current_rows}
        body_ids = {item.id for item in body if item.id is not None}

        for item_id in current_ids - body_ids:
            await db.execute("DELETE FROM expense_items WHERE id = $1", item_id)

        result_ids = []
        for item in body:
            if item.id is not None:
                await db.execute(
                    "UPDATE expense_items SET name = $1, unit_price = $2, quantity = $3 WHERE id = $4",
                    item.name, item.unit_price, item.quantity, item.id,
                )
                result_ids.append(item.id)
            else:
                row = await db.fetchrow(
                    """INSERT INTO expense_items (expense_id, name, unit_price, quantity)
                       VALUES ($1, $2, $3, $4) RETURNING id""",
                    expense_id, item.name, item.unit_price, item.quantity,
                )
                result_ids.append(row["id"])

    items = []
    for item_id in result_ids:
        item_row = await db.fetchrow(
            """SELECT id, name, unit_price, quantity,
                      unit_price * quantity AS item_total, split_method
               FROM expense_items WHERE id = $1""",
            item_id,
        )
        item_d = dict(item_row)
        attrs = await db.fetch(
            """SELECT user_id, explicit_amount AS amount, claimed_instances AS instances
               FROM attributions WHERE expense_item_id = $1 ORDER BY user_id""",
            item_id,
        )
        item_d["attributions"] = [dict(a) for a in attrs]
        items.append(item_d)
    return items


@router.put("/{expense_id}/items/{item_id}/attributions", response_model=list[ItemAttributionOut])
async def set_item_attributions(
    expense_id: int, item_id: int, body: list[ItemAttributionIn], current_user: CurrentUser, db: DbConn
) -> list[ItemAttributionOut]:
    async with db.transaction():
        await db.execute("DELETE FROM attributions WHERE expense_item_id = $1", item_id)
        for attr in body:
            await db.execute(
                """INSERT INTO attributions
                       (user_id, expense_item_id, explicit_amount, claimed_instances)
                   VALUES ($1, $2, $3, $4)""",
                attr.user_id, item_id, attr.amount, attr.instances,
            )
    rows = await db.fetch(
        """SELECT user_id, explicit_amount AS amount, claimed_instances AS instances
           FROM attributions WHERE expense_item_id = $1 ORDER BY user_id""",
        item_id,
    )
    return [dict(r) for r in rows]


@router.put("/{expense_id}/participants/{user_id}/assignment", response_model=AssignmentOut)
async def submit_assignment(
    expense_id: int, user_id: int, body: SubmitAssignmentIn, current_user: CurrentUser, db: DbConn
) -> AssignmentOut:
    async with db.transaction():
        for attr in body.attributions:
            await db.execute(
                "DELETE FROM attributions WHERE user_id = $1 AND expense_item_id = $2",
                user_id, attr.item_id,
            )
            await db.execute(
                """INSERT INTO attributions
                       (user_id, expense_item_id, explicit_amount, claimed_instances)
                   VALUES ($1, $2, $3, $4)""",
                user_id, attr.item_id, attr.amount, attr.instances,
            )

        if body.acknowledged is not None:
            await db.execute(
                """UPDATE expense_participants SET acknowledged = $1
                   WHERE expense_id = $2 AND user_id = $3""",
                body.acknowledged, expense_id, user_id,
            )

    user_row = await db.fetchrow("SELECT name FROM users WHERE id = $1", user_id)
    participant = await db.fetchrow(
        "SELECT acknowledged FROM expense_participants WHERE expense_id = $1 AND user_id = $2",
        expense_id, user_id,
    )
    attr_rows = await db.fetch(
        """SELECT a.expense_item_id AS item_id, a.explicit_amount AS amount, a.claimed_instances AS instances
           FROM attributions a
           JOIN expense_items ei ON ei.id = a.expense_item_id
           WHERE ei.expense_id = $1 AND a.user_id = $2
           ORDER BY a.expense_item_id""",
        expense_id, user_id,
    )
    return {
        "user_id": user_id,
        "name": user_row["name"],
        "acknowledged": participant["acknowledged"],
        "attributions": [dict(r) for r in attr_rows],
    }


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(expense_id: int, current_user: CurrentUser, db: DbConn) -> None:
    await db.execute("DELETE FROM expenses WHERE id = $1", expense_id)


@router.get("/{expense_id}/receipt-image", response_model=ReceiptImageOut)
async def get_receipt_image(expense_id: int, current_user: CurrentUser, db: DbConn) -> ReceiptImageOut:
    raise HTTPException(status_code=501, detail="Receipt image retrieval not implemented")


@router.get("/{expense_id}/effective-attributions", response_model=list[EffectiveAttributionOut])
async def get_effective_attributions(
    expense_id: int, current_user: CurrentUser, db: DbConn
) -> list[EffectiveAttributionOut]:
    rows = await db.fetch(
        """SELECT ea.user_id, u.name, ea.effective_amount
           FROM effective_attributions ea
           JOIN users u ON u.id = ea.user_id
           WHERE ea.expense_id = $1
           ORDER BY ea.user_id""",
        expense_id,
    )
    return [dict(r) for r in rows]
