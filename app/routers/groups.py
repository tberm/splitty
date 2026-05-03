from fastapi import APIRouter

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


# --- Groups ---

@router.get("", response_model=list[GroupListItemOut])
async def list_groups(current_user: CurrentUser, db: DbConn) -> list[GroupListItemOut]:
    raise NotImplementedError


@router.post("", response_model=GroupListItemOut, status_code=201)
async def create_group(body: CreateGroupIn, current_user: CurrentUser, db: DbConn) -> GroupListItemOut:
    raise NotImplementedError


@router.get("/{group_id}", response_model=GroupDetailOut)
async def get_group(group_id: int, current_user: CurrentUser, db: DbConn) -> GroupDetailOut:
    raise NotImplementedError


@router.put("/{group_id}", response_model=GroupDetailOut)
async def update_group(group_id: int, body: UpdateGroupIn, current_user: CurrentUser, db: DbConn) -> GroupDetailOut:
    raise NotImplementedError


@router.delete("/{group_id}", status_code=204)
async def delete_group(group_id: int, current_user: CurrentUser, db: DbConn) -> None:
    raise NotImplementedError


# --- Members ---

@router.get("/{group_id}/members", response_model=list[GroupMemberOut])
async def list_members(group_id: int, current_user: CurrentUser, db: DbConn) -> list[GroupMemberOut]:
    raise NotImplementedError


@router.post("/{group_id}/members", response_model=GroupMemberOut, status_code=201)
async def add_member(group_id: int, body: AddMemberIn, current_user: CurrentUser, db: DbConn) -> GroupMemberOut:
    raise NotImplementedError


@router.delete("/{group_id}/members/{user_id}", status_code=204)
async def remove_member(group_id: int, user_id: int, current_user: CurrentUser, db: DbConn) -> None:
    raise NotImplementedError


# --- Summary and balances ---

@router.get("/{group_id}/summary", response_model=GroupSummaryOut)
async def get_group_summary(group_id: int, current_user: CurrentUser, db: DbConn) -> GroupSummaryOut:
    raise NotImplementedError


@router.get("/{group_id}/balances", response_model=list[BalanceOut])
async def get_balances(group_id: int, current_user: CurrentUser, db: DbConn) -> list[BalanceOut]:
    raise NotImplementedError


