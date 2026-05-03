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
    raise NotImplementedError


@router.post("/{group_id}/settlements", response_model=SettlementOut, status_code=201)
async def create_settlement(
    group_id: int,
    body: CreateSettlementIn,
    current_user: CurrentUser,
    db: DbConn,
) -> SettlementOut:
    raise NotImplementedError


@router.delete("/{group_id}/settlements/{settlement_id}", status_code=204)
async def delete_settlement(
    group_id: int, settlement_id: int, current_user: CurrentUser, db: DbConn
) -> None:
    raise NotImplementedError
