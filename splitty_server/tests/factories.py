"""
Low-level factory functions for inserting individual entities.

Each function accepts a db connection and required fields, with optional
fields defaulting to sensible values. Tests that need specific data call
these directly; scenario fixtures in conftest.py compose them into presets.
"""

import asyncpg


async def insert_user(
    db: asyncpg.Connection,
    name: str,
    email: str | None = None,
) -> asyncpg.Record:
    if email is None:
        email = f"{name.lower().replace(' ', '.')}@example.com"
    return await db.fetchrow(
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
        name,
        email,
    )


async def insert_group(
    db: asyncpg.Connection,
    created_by: int,
    name: str = "Test Group",
) -> asyncpg.Record:
    return await db.fetchrow(
        "INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING *",
        name,
        created_by,
    )


async def add_member(
    db: asyncpg.Connection,
    group_id: int,
    user_id: int,
) -> asyncpg.Record:
    return await db.fetchrow(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) RETURNING *",
        group_id,
        user_id,
    )


async def insert_simple_expense(
    db: asyncpg.Connection,
    group_id: int,
    created_by: int,
    title: str = "Test Expense",
    total_amount: int = 3000,
    split_method: str = "even",
    currency: str = "GBP",
) -> asyncpg.Record:
    split_rule = await db.fetchrow(
        "INSERT INTO split_rules (method) VALUES ($1::split_method) RETURNING *",
        split_method,
    )
    return await db.fetchrow(
        """
        INSERT INTO expenses
            (group_id, title, type, total_amount, split_rule_id, created_by, currency)
        VALUES ($1, $2, 'simple', $3, $4, $5, $6)
        RETURNING *
        """,
        group_id,
        title,
        total_amount,
        split_rule["id"],
        created_by,
        currency,
    )


async def insert_payment(
    db: asyncpg.Connection,
    expense_id: int,
    paid_by: int,
    amount: int,
    notes: str | None = None,
) -> asyncpg.Record:
    return await db.fetchrow(
        "INSERT INTO payments (expense_id, paid_by, amount, notes) VALUES ($1, $2, $3, $4) RETURNING *",
        expense_id,
        paid_by,
        amount,
        notes,
    )


async def insert_participant(
    db: asyncpg.Connection,
    expense_id: int,
    user_id: int,
    is_accounted_for: bool = False,
) -> asyncpg.Record:
    return await db.fetchrow(
        """
        INSERT INTO expense_participants (expense_id, user_id, is_accounted_for)
        VALUES ($1, $2, $3)
        RETURNING *
        """,
        expense_id,
        user_id,
        is_accounted_for,
    )


async def insert_attribution(
    db: asyncpg.Connection,
    user_id: int,
    expense_id: int | None = None,
    expense_item_id: int | None = None,
    explicit_amount: int | None = None,
) -> asyncpg.Record:
    return await db.fetchrow(
        """
        INSERT INTO attributions (user_id, expense_id, expense_item_id, explicit_amount)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        """,
        user_id,
        expense_id,
        expense_item_id,
        explicit_amount,
    )


async def insert_settlement(
    db: asyncpg.Connection,
    group_id: int,
    paid_by: int,
    paid_to: int,
    amount: int,
    notes: str | None = None,
) -> asyncpg.Record:
    return await db.fetchrow(
        """
        INSERT INTO settlements (group_id, paid_by, paid_to, amount, notes)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        """,
        group_id,
        paid_by,
        paid_to,
        amount,
        notes,
    )
