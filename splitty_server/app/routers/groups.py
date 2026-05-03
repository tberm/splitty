from fastapi import APIRouter, HTTPException

from app.dependencies import CurrentUser, DbConn
from app.schemas.groups import (
    AddMemberIn,
    BalanceOut,
    CreateGroupIn,
    GroupDetailOut,
    GroupListItemOut,
    GroupMemberOut,
    GroupSummaryOut,
    UpdateGroupIn,
)

router = APIRouter(prefix="/api/v1/groups", tags=["groups"])


async def _get_members(db, group_id: int) -> list[dict]:
    rows = await db.fetch(
        """SELECT gm.user_id, u.name, u.email, gm.joined_at
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id
           WHERE gm.group_id = $1
           ORDER BY gm.joined_at""",
        group_id,
    )
    return [dict(r) for r in rows]


async def _get_group_detail(db, group_id: int) -> dict:
    row = await db.fetchrow("SELECT * FROM groups WHERE id = $1", group_id)
    if not row:
        raise HTTPException(status_code=404, detail="Group not found")
    members = await _get_members(db, group_id)
    return {**dict(row), "members": members}


# --- Groups ---

@router.get("", response_model=list[GroupListItemOut])
async def list_groups(current_user: CurrentUser, db: DbConn) -> list[GroupListItemOut]:
    rows = await db.fetch(
        """SELECT g.id, g.name, g.created_by, g.created_at,
                  COUNT(gm_all.user_id) AS member_count
           FROM groups g
           JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
           LEFT JOIN group_members gm_all ON gm_all.group_id = g.id
           GROUP BY g.id
           ORDER BY g.created_at DESC""",
        current_user["id"],
    )
    return [dict(r) for r in rows]


@router.post("", response_model=GroupListItemOut, status_code=201)
async def create_group(body: CreateGroupIn, current_user: CurrentUser, db: DbConn) -> GroupListItemOut:
    async with db.transaction():
        row = await db.fetchrow(
            "INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING *",
            body.name, current_user["id"],
        )
        await db.execute(
            "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)",
            row["id"], current_user["id"],
        )
    member_count = await db.fetchval(
        "SELECT COUNT(*) FROM group_members WHERE group_id = $1", row["id"]
    )
    return {**dict(row), "member_count": member_count}


@router.get("/{group_id}", response_model=GroupDetailOut)
async def get_group(group_id: int, current_user: CurrentUser, db: DbConn) -> GroupDetailOut:
    return await _get_group_detail(db, group_id)


@router.put("/{group_id}", response_model=GroupDetailOut)
async def update_group(group_id: int, body: UpdateGroupIn, current_user: CurrentUser, db: DbConn) -> GroupDetailOut:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        set_clauses = ", ".join(f"{k} = ${i + 2}" for i, k in enumerate(updates))
        await db.execute(
            f"UPDATE groups SET {set_clauses} WHERE id = $1",
            group_id, *updates.values(),
        )
    return await _get_group_detail(db, group_id)


@router.delete("/{group_id}", status_code=204)
async def delete_group(group_id: int, current_user: CurrentUser, db: DbConn) -> None:
    await db.execute("DELETE FROM groups WHERE id = $1", group_id)


# --- Members ---

@router.get("/{group_id}/members", response_model=list[GroupMemberOut])
async def list_members(group_id: int, current_user: CurrentUser, db: DbConn) -> list[GroupMemberOut]:
    return await _get_members(db, group_id)


@router.post("/{group_id}/members", response_model=GroupMemberOut, status_code=201)
async def add_member(group_id: int, body: AddMemberIn, current_user: CurrentUser, db: DbConn) -> GroupMemberOut:
    await db.execute(
        "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        group_id, body.user_id,
    )
    row = await db.fetchrow(
        """SELECT gm.user_id, u.name, u.email, gm.joined_at
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id
           WHERE gm.group_id = $1 AND gm.user_id = $2""",
        group_id, body.user_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)


@router.delete("/{group_id}/members/{user_id}", status_code=204)
async def remove_member(group_id: int, user_id: int, current_user: CurrentUser, db: DbConn) -> None:
    await db.execute(
        "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2",
        group_id, user_id,
    )


# --- Summary and balances ---

@router.get("/{group_id}/summary", response_model=GroupSummaryOut)
async def get_group_summary(group_id: int, current_user: CurrentUser, db: DbConn) -> GroupSummaryOut:
    group = await _get_group_detail(db, group_id)
    balances = await _get_balances(db, group_id)
    expense_rows = await db.fetch(
        """SELECT id, title, currency, total_amount, type, created_by, created_at,
                  request_self_assignments
           FROM expenses WHERE group_id = $1
           ORDER BY created_at DESC LIMIT 10""",
        group_id,
    )
    return {
        "group": group,
        "balances": balances,
        "recent_expenses": [dict(r) for r in expense_rows],
    }


async def _get_balances(db, group_id: int) -> list[dict]:
    rows = await db.fetch(
        """SELECT gb.user_id, u.name, gb.net_balance
           FROM group_balances gb
           JOIN users u ON u.id = gb.user_id
           WHERE gb.group_id = $1
           ORDER BY gb.user_id""",
        group_id,
    )
    return [dict(r) for r in rows]


@router.get("/{group_id}/balances", response_model=list[BalanceOut])
async def get_balances(group_id: int, current_user: CurrentUser, db: DbConn) -> list[BalanceOut]:
    return await _get_balances(db, group_id)
