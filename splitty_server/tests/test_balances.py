"""
End-to-end tests for group balance calculations across multiple expenses and
settlements. All tests use the simple_group fixture: Alice, Bob, and Carol.
"""

from tests.api_helpers import create_expense


async def _settle(client, group_id, paid_by, paid_to, amount):
    resp = await client.post(f"/api/v1/groups/{group_id}/settlements", json={
        "paid_by": paid_by,
        "paid_to": paid_to,
        "amount": amount,
    })
    assert resp.status_code == 201
    return resp.json()


async def _balances(client, group_id):
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    return {row["user_id"]: row["net_balance"] for row in resp.json()}


async def test_two_simple_even_expenses(db, simple_group, client_factory):
    """
    Alice pays £90 split 3 ways; Bob pays £60 split 3 ways. Verify each
    person's cumulative balance and that the group sums to zero.

    Alice: paid 9000, owes 3000+2000=5000 → +4000
    Bob:   paid 6000, owes 3000+2000=5000 → +1000
    Carol: paid 0,    owes 3000+2000=5000 → -5000
    """
    g = simple_group
    group_id = g.group["id"]

    client = client_factory(g.alice)
    await create_expense(client, group_id, {
        "title": "Hotel",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 9000,
        "split_method": "even",
        "payments": [{"paid_by": g.alice["id"], "amount": 9000}],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
    })

    client = client_factory(g.bob)
    await create_expense(client, group_id, {
        "title": "Dinner",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 6000,
        "split_method": "even",
        "payments": [{"paid_by": g.bob["id"], "amount": 6000}],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
    })

    client = client_factory(g.alice)
    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == 4000
    assert b[g.bob["id"]]   == 1000
    assert b[g.carol["id"]] == -5000
    assert sum(b.values()) == 0


async def test_explicit_split_balances(db, simple_group, client_factory):
    """
    Alice pays £60; explicit split assigns £10 to herself, £20 to Bob, £30 to
    Carol.

    Alice: paid 6000, owes 1000 → +5000
    Bob:   owes 2000 → -2000
    Carol: owes 3000 → -3000
    """
    g = simple_group
    group_id = g.group["id"]

    client = client_factory(g.alice)
    await create_expense(client, group_id, {
        "title": "Dinner",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 6000,
        "split_method": "explicit",
        "payments": [{"paid_by": g.alice["id"], "amount": 6000}],
        "attributions": [
            {"user_id": g.alice["id"], "amount": 1000},
            {"user_id": g.bob["id"],   "amount": 2000},
            {"user_id": g.carol["id"], "amount": 3000},
        ],
    })

    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == 5000
    assert b[g.bob["id"]]   == -2000
    assert b[g.carol["id"]] == -3000
    assert sum(b.values()) == 0


async def test_settlement_clears_debt(db, simple_group, client_factory):
    """
    Alice pays £60 split evenly between herself and Bob. Bob then settles the
    full £30 he owes. Both balances should reach zero.
    """
    g = simple_group
    group_id = g.group["id"]

    client = client_factory(g.alice)
    await create_expense(client, group_id, {
        "title": "Lunch",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 6000,
        "split_method": "even",
        "payments": [{"paid_by": g.alice["id"], "amount": 6000}],
        "participant_ids": [g.alice["id"], g.bob["id"]],
    })

    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == 3000
    assert b[g.bob["id"]]   == -3000

    client = client_factory(g.bob)
    await _settle(client, group_id, g.bob["id"], g.alice["id"], 3000)

    client = client_factory(g.alice)
    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == 0
    assert b[g.bob["id"]]   == 0


async def test_partial_settlement(db, simple_group, client_factory):
    """
    Alice pays £100 split evenly with Bob (each owes £50). Bob settles £20.
    Remaining debt is £30.
    """
    g = simple_group
    group_id = g.group["id"]

    client = client_factory(g.alice)
    await create_expense(client, group_id, {
        "title": "Groceries",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 10000,
        "split_method": "even",
        "payments": [{"paid_by": g.alice["id"], "amount": 10000}],
        "participant_ids": [g.alice["id"], g.bob["id"]],
    })

    client = client_factory(g.bob)
    await _settle(client, group_id, g.bob["id"], g.alice["id"], 2000)

    client = client_factory(g.alice)
    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == 3000
    assert b[g.bob["id"]]   == -3000
    assert sum(b.values()) == 0


async def test_settlement_without_expense(db, simple_group, client_factory):
    """
    A settlement recorded with no linked expense still shifts balances
    correctly.
    """
    g = simple_group
    group_id = g.group["id"]

    client = client_factory(g.alice)
    await _settle(client, group_id, g.bob["id"], g.alice["id"], 5000)

    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == -5000
    assert b[g.bob["id"]]   == 5000


async def test_multiple_settlements(db, simple_group, client_factory):
    """
    Alice pays £90 split 3 ways and £60 split 3 ways (between herself and Bob).
    Bob makes two partial settlements; Carol makes one. Verify all balances are
    correctly accumulated after each settlement.

    After expenses:
      Alice: paid 9000+6000=15000, owes 3000+3000=6000 → +9000
      Bob:   owes 3000+3000=6000 → -6000
      Carol: owes 3000 → -3000

    Bob settles 2000 → Alice: +7000, Bob: -4000
    Bob settles 1000 → Alice: +6000, Bob: -3000
    Carol settles 3000 → Alice: +3000, Carol: 0
    Final: Alice +3000, Bob -3000, Carol 0
    """
    g = simple_group
    group_id = g.group["id"]

    client = client_factory(g.alice)
    await create_expense(client, group_id, {
        "title": "Hotel",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 9000,
        "split_method": "even",
        "payments": [{"paid_by": g.alice["id"], "amount": 9000}],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
    })
    await create_expense(client, group_id, {
        "title": "Groceries",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 6000,
        "split_method": "even",
        "payments": [{"paid_by": g.alice["id"], "amount": 6000}],
        "participant_ids": [g.alice["id"], g.bob["id"]],
    })

    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == 9000
    assert b[g.bob["id"]]   == -6000
    assert b[g.carol["id"]] == -3000

    client = client_factory(g.bob)
    await _settle(client, group_id, g.bob["id"], g.alice["id"], 2000)

    client = client_factory(g.alice)
    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == 7000
    assert b[g.bob["id"]]   == -4000
    assert b[g.carol["id"]] == -3000

    client = client_factory(g.bob)
    await _settle(client, group_id, g.bob["id"], g.alice["id"], 1000)

    client = client_factory(g.carol)
    await _settle(client, group_id, g.carol["id"], g.alice["id"], 3000)

    client = client_factory(g.alice)
    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == 3000
    assert b[g.bob["id"]]   == -3000
    assert b[g.carol["id"]] == 0
    assert sum(b.values()) == 0


async def test_rounding_even_split(db, simple_group, client_factory):
    """
    £10 split evenly 3 ways: two participants owe 333, one owes 334. The extra
    penny goes to the participant with the lowest user_id. Verify balances still
    sum to zero and the spread is at most 1p.
    """
    g = simple_group
    group_id = g.group["id"]

    client = client_factory(g.alice)
    await create_expense(client, group_id, {
        "title": "Coffee",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 1000,
        "split_method": "even",
        "payments": [{"paid_by": g.alice["id"], "amount": 1000}],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
    })

    # Alice paid 1000, owes 334 → +666
    # Other two owe 333 → -333
    b = await _balances(client, group_id)
    assert sum(b.values()) == 0
    owed_amounts = sorted(b.values())
    assert owed_amounts == [-333, -333, 666]


async def test_itemised_fully_attributed_balance(db, simple_group, client_factory):
    """
    Itemised expense where every item is fully claimed upfront. No remainder
    pool involved. Verify balances match the exact attributions.

    Bob pays 9000. Pizza 6000: Alice 3000, Bob 3000. Wine 3000: Bob 1000,
    Carol 2000.
    Bob: paid 9000, owes 4000 → +5000
    Alice: owes 3000 → -3000
    Carol: owes 2000 → -2000
    """
    g = simple_group
    group_id = g.group["id"]

    client = client_factory(g.bob)
    await create_expense(client, group_id, {
        "title": "Restaurant",
        "type": "itemised",
        "currency": "GBP",
        "total_amount": 9000,
        "payments": [{"paid_by": g.bob["id"], "amount": 9000}],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
        "items": [
            {"name": "Pizza", "unit_price": 6000, "quantity": 1, "attributions": [
                {"user_id": g.alice["id"], "amount": 3000},
                {"user_id": g.bob["id"],   "amount": 3000},
            ]},
            {"name": "Wine", "unit_price": 3000, "quantity": 1, "attributions": [
                {"user_id": g.bob["id"],   "amount": 1000},
                {"user_id": g.carol["id"], "amount": 2000},
            ]},
        ],
    })

    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == -3000
    assert b[g.bob["id"]]   == 5000
    assert b[g.carol["id"]] == -2000
    assert sum(b.values()) == 0


async def test_simple_and_itemised_combined(db, simple_group, client_factory):
    """
    One simple even-split expense and one fully-attributed itemised expense.
    Verify balances are the sum of each expense's contribution.

    Simple (Alice pays 6000 / 3): Alice +4000, Bob -2000, Carol -2000
    Itemised (Bob pays 9000; Pizza 6000 explicit Alice/Bob 3000 each;
              Wine 3000 explicit Bob 1000 / Carol 2000):
        Bob: +5000, Alice: -3000, Carol: -2000
    Combined: Alice +1000, Bob +3000, Carol -4000
    """
    g = simple_group
    group_id = g.group["id"]

    client = client_factory(g.alice)
    await create_expense(client, group_id, {
        "title": "Dinner",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 6000,
        "split_method": "even",
        "payments": [{"paid_by": g.alice["id"], "amount": 6000}],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
    })

    client = client_factory(g.bob)
    await create_expense(client, group_id, {
        "title": "Restaurant",
        "type": "itemised",
        "currency": "GBP",
        "total_amount": 9000,
        "payments": [{"paid_by": g.bob["id"], "amount": 9000}],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
        "items": [
            {"name": "Pizza", "unit_price": 6000, "quantity": 1, "attributions": [
                {"user_id": g.alice["id"], "amount": 3000},
                {"user_id": g.bob["id"],   "amount": 3000},
            ]},
            {"name": "Wine", "unit_price": 3000, "quantity": 1, "attributions": [
                {"user_id": g.bob["id"],   "amount": 1000},
                {"user_id": g.carol["id"], "amount": 2000},
            ]},
        ],
    })

    client = client_factory(g.alice)
    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == 1000
    assert b[g.bob["id"]]   == 3000
    assert b[g.carol["id"]] == -4000
    assert sum(b.values()) == 0


async def test_expense_and_settlement_combined(db, simple_group, client_factory):
    """
    Alice pays £90 split 3 ways; Carol then settles £30 directly to Alice.
    Verify balances reflect both the expense and the settlement.

    After expense: Alice +6000, Bob -3000, Carol -3000
    Carol settles 3000 to Alice: Alice +3000, Carol 0
    Final: Alice +3000, Bob -3000, Carol 0
    """
    g = simple_group
    group_id = g.group["id"]

    client = client_factory(g.alice)
    await create_expense(client, group_id, {
        "title": "Hotel",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 9000,
        "split_method": "even",
        "payments": [{"paid_by": g.alice["id"], "amount": 9000}],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
    })

    client = client_factory(g.carol)
    await _settle(client, group_id, g.carol["id"], g.alice["id"], 3000)

    client = client_factory(g.alice)
    b = await _balances(client, group_id)
    assert b[g.alice["id"]] == 3000
    assert b[g.bob["id"]]   == -3000
    assert b[g.carol["id"]] == 0
    assert sum(b.values()) == 0
