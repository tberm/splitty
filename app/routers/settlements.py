from fastapi import APIRouter

from app.dependencies import CurrentUser, DbConn
from app.schemas.groups import CreateSettlementIn, PaginatedSettlements, SettlementOut

router = APIRouter(prefix="/api/v1/groups", tags=["settlements"])


@router.get("/{group_id}/settlements", response_model=PaginatedSettlements)
async def list_settlements(
    group_id: int,
    current_user: CurrentUser,
    db: DbConn,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedSettlements:
    total = await db.fetchval("SELECT COUNT(*) FROM settlements WHERE group_id = $1", group_id)
    rows = await db.fetch(
        """SELECT id, group_id, paid_by, paid_to, amount, settled_at, notes
           FROM settlements WHERE group_id = $1
           ORDER BY settled_at DESC LIMIT $2 OFFSET $3""",
        group_id, page_size, (page - 1) * page_size,
    )
    return {"items": [dict(r) for r in rows], "total": total, "page": page, "page_size": page_size}


@router.post("/{group_id}/settlements", response_model=SettlementOut, status_code=201)
async def create_settlement(
    group_id: int,
    body: CreateSettlementIn,
    current_user: CurrentUser,
    db: DbConn,
) -> SettlementOut:
    row = await db.fetchrow(
        """INSERT INTO settlements (group_id, paid_by, paid_to, amount, settled_at, notes)
           VALUES ($1, $2, $3, $4, COALESCE($5, NOW()), $6)
           RETURNING id, group_id, paid_by, paid_to, amount, settled_at, notes""",
        group_id, body.paid_by, body.paid_to, body.amount, body.settled_at, body.notes,
    )
    return dict(row)


@router.delete("/{group_id}/settlements/{settlement_id}", status_code=204)
async def delete_settlement(
    group_id: int, settlement_id: int, current_user: CurrentUser, db: DbConn
) -> None:
    await db.execute(
        "DELETE FROM settlements WHERE id = $1 AND group_id = $2",
        settlement_id, group_id,
    )
