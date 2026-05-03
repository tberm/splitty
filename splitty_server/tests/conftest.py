import asyncio
import os
from pathlib import Path
from types import SimpleNamespace

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.main import app, get_current_user, get_db
from tests.factories import (
    add_member,
    insert_group,
    insert_participant,
    insert_payment,
    insert_simple_expense,
    insert_user,
)

DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql:///splitty_test",
)

SCHEMA_PATH = Path(__file__).parent.parent / "db" / "schema.sql"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        await conn.execute(SCHEMA_PATH.read_text())
    finally:
        await conn.close()


@pytest_asyncio.fixture()
async def db() -> asyncpg.Connection:
    conn = await asyncpg.connect(DATABASE_URL)
    tx = conn.transaction()
    await tx.start()
    try:
        yield conn
    finally:
        await tx.rollback()
        await conn.close()


# ---------------------------------------------------------------------------
# Scenario fixtures
#
# Tests that need specific data can call factory functions from factories.py
# directly. These fixtures cover common presets so most tests don't have to.
#
# Schema only:  just declare `db` (no extra fixture needed)
# A group:      declare `simple_group`
# With expense: declare `simple_expense`
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture()
async def simple_group(db: asyncpg.Connection) -> SimpleNamespace:
    """Three users (Alice, Bob, Carol) in a group. Alice is the creator."""
    alice = await insert_user(db, "Alice")
    bob = await insert_user(db, "Bob")
    carol = await insert_user(db, "Carol")
    group = await insert_group(db, created_by=alice["id"])
    for user in [alice, bob, carol]:
        await add_member(db, group["id"], user["id"])
    return SimpleNamespace(group=group, alice=alice, bob=bob, carol=carol)


@pytest_asyncio.fixture()
async def simple_expense(db: asyncpg.Connection, simple_group: SimpleNamespace) -> SimpleNamespace:
    """simple_group + a £30.00 even-split expense paid in full by Alice."""
    g = simple_group
    expense = await insert_simple_expense(
        db,
        group_id=g.group["id"],
        created_by=g.alice["id"],
        title="Dinner",
        total_amount=3000,
    )
    await insert_payment(db, expense_id=expense["id"], paid_by=g.alice["id"], amount=3000)
    for user in [g.alice, g.bob, g.carol]:
        await insert_participant(db, expense_id=expense["id"], user_id=user["id"])
    return SimpleNamespace(
        group=g.group,
        alice=g.alice,
        bob=g.bob,
        carol=g.carol,
        expense=expense,
    )


@pytest_asyncio.fixture()
async def client(db: asyncpg.Connection) -> AsyncClient:
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture()
async def client_factory(db: asyncpg.Connection):
    """
    Fixture factory for authenticated requests. Call client_factory(user) to
    configure the client to act as that user and get it back. Calling again
    with a different user switches who subsequent requests are made as.
    All requests share the test's rolled-back db connection.

    Usage:
        client = client_factory(simple_group.alice)
        resp = await client.post(...)

        client_factory(simple_group.bob)   # switch user
        resp = await client.put(...)       # now acting as Bob
    """
    async def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        def _as(user: asyncpg.Record) -> AsyncClient:
            async def override_get_current_user():
                return user
            app.dependency_overrides[get_current_user] = override_get_current_user
            return ac

        yield _as

    app.dependency_overrides.clear()
