"""
End-to-end tests for expense creation and balance calculation.
All tests use the simple_group fixture: Alice, Bob, and Carol in a group
with no pre-existing expenses.
"""

from tests.api_helpers import create_expense, submit_assignment


async def test_simple_expense_even(db, simple_group, client_factory):
    """
    Create a £60 even-split expense paid by Alice, owed by all three.
    Verify the expense details and resulting balances via the API.
    """
    g = simple_group
    group_id = g.group["id"]
    client = client_factory(g.alice)

    expense = await create_expense(client, group_id, {
        "title": "Dinner",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 6000,
        "split_method": "even",
        "payments": [{"paid_by": g.alice["id"], "amount": 6000}],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
    })
    expense_id = expense["id"]
    assert expense["created_by"] == g.alice["id"]

    # GET the expense and verify top-level fields are stable
    resp = await client.get(f"/api/v1/expenses/{expense_id}")
    assert resp.status_code == 200
    fetched = resp.json()
    assert fetched["id"] == expense_id
    assert fetched["title"] == "Dinner"
    assert fetched["split_method"] == "even"

    # Effective attributions: 6000 / 3 = 2000 each
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 2000
    assert ea[g.bob["id"]] == 2000
    assert ea[g.carol["id"]] == 2000

    # Group balances: Alice paid 6000, owes 2000 → +4000; others owe 2000 → -2000
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 4000
    assert balances[g.bob["id"]] == -2000
    assert balances[g.carol["id"]] == -2000


async def test_simple_expense_explicit(db, simple_group, client_factory):
    """
    As above but with explicit amounts: Alice owes £10, Bob owes £20, Carol owes
    £30.
    """
    g = simple_group
    group_id = g.group["id"]
    client = client_factory(g.alice)

    expense = await create_expense(client, group_id, {
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
    expense_id = expense["id"]
    assert expense["created_by"] == g.alice["id"]
    assert expense["split_method"] == "explicit"

    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 1000
    assert ea[g.bob["id"]] == 2000
    assert ea[g.carol["id"]] == 3000

    # Alice paid 6000, owes 1000 → +5000; Bob: -2000; Carol: -3000
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 5000
    assert balances[g.bob["id"]] == -2000
    assert balances[g.carol["id"]] == -3000


async def test_simple_expense_multi_payors(db, simple_group, client_factory):
    """
    As above with even split and with multiple payors: Alice pays £40 and Bob
    pays £20 of the £60 total.
    """
    g = simple_group
    group_id = g.group["id"]
    client = client_factory(g.alice)

    expense = await create_expense(client, group_id, {
        "title": "Dinner",
        "type": "simple",
        "currency": "GBP",
        "total_amount": 6000,
        "split_method": "even",
        "payments": [
            {"paid_by": g.alice["id"], "amount": 4000},
            {"paid_by": g.bob["id"],   "amount": 2000},
        ],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
    })
    expense_id = expense["id"]

    # Even split: 6000 / 3 = 2000 each
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 2000
    assert ea[g.bob["id"]] == 2000
    assert ea[g.carol["id"]] == 2000

    # Alice: 4000 - 2000 = +2000; Bob: 2000 - 2000 = 0; Carol: -2000
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 2000
    assert balances[g.bob["id"]] == 0
    assert balances[g.carol["id"]] == -2000


async def test_itemised_expense_pre_assigned(db, simple_group, client_factory):
    """
    Create an itemised expense (Pizza £30, Beer £10, Wine £10) between two people
    with attributions. 
    """
    g = simple_group
    group_id = g.group["id"]
    client = client_factory(g.alice)

    expense = await create_expense(client, group_id, {
        "title": "Restaurant",
        "type": "itemised",
        "currency": "GBP",
        "total_amount": 5000,
        "payments": [{"paid_by": g.alice["id"], "amount": 5000}],
        "participant_ids": [g.alice["id"], g.bob["id"]],
        "items": [
            {"name": "Pizza", "unit_price": 3000, "quantity": 1, "attributions": [
                {"user_id": g.alice["id"], "instances": 1},
            ]},
            {"name": "Beer",  "unit_price": 1000, "quantity": 2, "attributions": [
                {"user_id": g.alice["id"], "instances": 1},
                {"user_id": g.bob["id"],   "instances": 1},
            ]},
        ],
    })
    expense_id = expense["id"]

    client_factory(g.alice)
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 4000  # 3000 + 1000
    assert ea[g.bob["id"]] == 1000    # 1000

    # Balances: Alice paid 5000, owes 4000 → +1000 | Bob: -1000
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 1000
    assert balances[g.bob["id"]] == -1000


async def test_itemised_expense_multi_payors(db, simple_group, client_factory):
    """
    As above but with multiple payors: Alice pays £30 and Bob pays £20 of the
    £50 total.
    """
    g = simple_group
    group_id = g.group["id"]
    client = client_factory(g.alice)

    expense = await create_expense(client, group_id, {
        "title": "Restaurant",
        "type": "itemised",
        "currency": "GBP",
        "total_amount": 5000,
        "payments": [
            {"paid_by": g.alice["id"], "amount": 3000},
            {"paid_by": g.bob["id"],   "amount": 2000},
        ],
        "participant_ids": [g.alice["id"], g.bob["id"]],
        "items": [
            {"name": "Pizza", "unit_price": 3000, "quantity": 1, "attributions": [
                {"user_id": g.alice["id"], "instances": 1},
            ]},
            {"name": "Beer", "unit_price": 1000, "quantity": 2, "attributions": [
                {"user_id": g.alice["id"], "instances": 1},
                {"user_id": g.bob["id"],   "instances": 1},
            ]},
        ],
    })
    expense_id = expense["id"]

    # EA unchanged from pre_assigned: Alice=4000, Bob=1000
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 4000
    assert ea[g.bob["id"]] == 1000

    # Alice: 3000 - 4000 = -1000; Bob: 2000 - 1000 = +1000
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == -1000
    assert balances[g.bob["id"]] == 1000


async def test_itemised_expense_self_assignment(db, simple_group, client_factory):
    """
    Create an itemised expense (Pizza £30, 2x Beer £10) between two people
    with no initial attributions. Alice assigns herself the pizza and one beer;
    Bob assigns himself the other beer. Verify balances at each stage.
    """
    g = simple_group
    group_id = g.group["id"]
    client = client_factory(g.alice)

    # £50 total paid by Alice; three even-split items with no attributions,
    # so both participants start in the remainder pool for every item.
    expense = await create_expense(client, group_id, {
        "title": "Restaurant",
        "type": "itemised",
        "currency": "GBP",
        "total_amount": 5000,
        "payments": [{"paid_by": g.alice["id"], "amount": 5000}],
        "participant_ids": [g.alice["id"], g.bob["id"]],
        "items": [
            {"name": "Pizza", "unit_price": 3000, "quantity": 1, "attributions": []},
            {"name": "Beer",  "unit_price": 1000, "quantity": 2, "attributions": []},
        ],
    })
    expense_id = expense["id"]
    items = {item["name"]: item for item in expense["items"]}
    pizza_id = items["Pizza"]["id"]
    beer_id  = items["Beer"]["id"]

    # Initial balances: all items split evenly across 2.
    # Pizza (3000)/2=1500; Beer (2*1000)/2=1000; → each owes 2500
    # Alice: paid 5000, owes 2500 → +2500 | Bob: -2500
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 2500
    assert balances[g.bob["id"]] == -2500

    # Alice assigns: Pizza=3000, Beer=1000
    await submit_assignment(client, expense_id, g.alice["id"], [
        {"item_id": pizza_id, "instances": 1},
        {"item_id": beer_id,  "instances": 1},
    ])

    # Remaining beer (1000) gets split evenly
    # So Alice owes 3000+1000+500=4500; Bob owes 500
    client_factory(g.alice)
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 4500
    # Implicitly Bob owes the remaining beer
    assert ea[g.bob["id"]] == 500

    # Bob assigns himself the remaining beer
    client_factory(g.bob)
    await submit_assignment(client, expense_id, g.bob["id"], [
        {"item_id": beer_id, "instances": 1},
    ])

    client_factory(g.alice)
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 4000  # 3000 + 1000
    assert ea[g.bob["id"]] == 1000    # 1000

    # Final balances: Alice paid 5000, owes 4000 → +1000 | Bob: -1000
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 1000
    assert balances[g.bob["id"]] == -1000


async def test_itemised_expense_with_tip(db, simple_group, client_factory):
    """As above but with tip that is shared among all."""
    g = simple_group
    group_id = g.group["id"]
    client = client_factory(g.alice)

    expense = await create_expense(client, group_id, {
        "title": "Restaurant",
        "type": "itemised",
        "currency": "GBP",
        "total_amount": 5000,
        "payments": [{"paid_by": g.alice["id"], "amount": 5500}],
        "participant_ids": [g.alice["id"], g.bob["id"]],
        "items": [
            {"name": "Pizza", "unit_price": 3000, "quantity": 1, "attributions": []},
            {"name": "Beer",  "unit_price": 1000, "quantity": 2, "attributions": []},
            {"name": "Tip",  "unit_price": 500, "quantity": 1, "attributions": []},
        ],
    })
    expense_id = expense["id"]
    items = {item["name"]: item for item in expense["items"]}
    pizza_id = items["Pizza"]["id"]
    beer_id  = items["Beer"]["id"]
    tip_id  = items["Tip"]["id"]

    # Initial balances: all items split evenly across 2.
    # 5500 / 2 ; → each owes 2750
    # Alice: paid 5500, owes 2750 → +2750 | Bob: -2750
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 2750
    assert balances[g.bob["id"]] == -2750

    # Alice assigns: Pizza=3000, Beer=1000
    # Bob assigns: Beer=1000
    await submit_assignment(client, expense_id, g.alice["id"], [
        {"item_id": pizza_id, "instances": 1},
        {"item_id": beer_id,  "instances": 1},
    ])
    client_factory(g.bob)
    await submit_assignment(client, expense_id, g.bob["id"], [
        {"item_id": beer_id, "instances": 1},
    ])

    # Tip is unassigned, so split evenly → 250 each;
    # Alice owes 3000+1000+250=4250, Bob owes 1000+250=1250

    client_factory(g.alice)
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 4250
    assert ea[g.bob["id"]] == 1250

    # Final balances: Alice paid 5500, owes 4250 → +1250 | Bob: -1250
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 1250
    assert balances[g.bob["id"]] == -1250


async def test_itemised_expense_explicit_amounts(db, simple_group, client_factory):
    """
    Alice and Bob self-assign for explicit amounts of the shared item (tip).

    Bob pays £1 and Alice pays £3 of the £5 tip, leaving £1 unassigned that
    should be split evenly. The rest of the expense is also unassigned and split
    evenly.
    """
    g = simple_group
    group_id = g.group["id"]
    client = client_factory(g.alice)

    # Pizza £30 + Beer 2×£10 + Tip £5 = £55, all unassigned initially
    expense = await create_expense(client, group_id, {
        "title": "Restaurant",
        "type": "itemised",
        "currency": "GBP",
        "total_amount": 5500,
        "payments": [{"paid_by": g.alice["id"], "amount": 5500}],
        "participant_ids": [g.alice["id"], g.bob["id"]],
        "items": [
            {"name": "Pizza", "unit_price": 3000, "quantity": 1, "attributions": []},
            {"name": "Beer",  "unit_price": 1000, "quantity": 2, "attributions": []},
            {"name": "Tip",   "unit_price": 500,  "quantity": 1, "attributions": []},
        ],
    })
    expense_id = expense["id"]
    items = {item["name"]: item for item in expense["items"]}
    tip_id = items["Tip"]["id"]

    # Alice claims £3 of the tip explicitly
    await submit_assignment(client, expense_id, g.alice["id"], [
        {"item_id": tip_id, "amount": 300},
    ])

    # Bob claims £1 of the tip explicitly
    client_factory(g.bob)
    await submit_assignment(client, expense_id, g.bob["id"], [
        {"item_id": tip_id, "amount": 100},
    ])

    # Tip: Alice=300, Bob=100, remainder=100 → 50 each
    # Pizza (3000) and Beer (2000) unassigned → 1500 and 1000 each
    # EA: Alice=1500+1000+300+50=2850; Bob=1500+1000+100+50=2650
    client_factory(g.alice)
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 2850
    assert ea[g.bob["id"]] == 2650

    # Alice: 5500 - 2850 = +2650; Bob: -2650
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 2650
    assert balances[g.bob["id"]] == -2650


async def test_itemised_expense_partly_self_assigned(db, simple_group, client_factory):
    """
    Alice's assignments are registered at creation time; Bob self-assigns later.
    Check correct effective attributions before and after Bob's self-assignment.
    """
    g = simple_group
    group_id = g.group["id"]
    client = client_factory(g.alice)

    # Pizza: qty=2, unit_price=1500. Alice claims 1 instance at creation.
    # 3 participants (Alice, Bob, Carol). Alice pays the full £30.
    expense = await create_expense(client, group_id, {
        "title": "Pizza Night",
        "type": "itemised",
        "currency": "GBP",
        "total_amount": 3000,
        "payments": [{"paid_by": g.alice["id"], "amount": 3000}],
        "participant_ids": [g.alice["id"], g.bob["id"], g.carol["id"]],
        "items": [
            {"name": "Pizza", "unit_price": 1500, "quantity": 2, "attributions": [
                {"user_id": g.alice["id"], "instances": 1},
            ]},
        ],
    })
    expense_id = expense["id"]
    items = {item["name"]: item for item in expense["items"]}
    pizza_id = items["Pizza"]["id"]

    # Alice claimed 1500; remainder=1500 split evenly across all 3 → 500 each
    # EA: Alice=1500+500=2000, Bob=500, Carol=500
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 2000
    assert ea[g.bob["id"]] == 500
    assert ea[g.carol["id"]] == 500

    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 1000
    assert balances[g.bob["id"]] == -500
    assert balances[g.carol["id"]] == -500

    # Bob self-assigns the remaining instance; item is now fully claimed
    client_factory(g.bob)
    await submit_assignment(client, expense_id, g.bob["id"], [
        {"item_id": pizza_id, "instances": 1},
    ])

    # Alice=1500, Bob=1500, Carol=0 (remainder=0)
    client_factory(g.alice)
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 1500
    assert ea[g.bob["id"]] == 1500
    assert ea[g.carol["id"]] == 0

    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 1500
    assert balances[g.bob["id"]] == -1500
    assert balances[g.carol["id"]] == 0


async def test_itemised_expense_add_participant(db, simple_group, client_factory):
    """
    Create an itemised expense with attributions for some of the items.
    Adding a participant should change the effective attributions for any
    unattributed items.
    """
    g = simple_group
    group_id = g.group["id"]
    client = client_factory(g.alice)

    # Pizza £20 (all Alice) + Beer 3×£10 (unassigned) = £50; Alice pays all.
    # Initial participants: Alice, Bob.
    expense = await create_expense(client, group_id, {
        "title": "Restaurant",
        "type": "itemised",
        "currency": "GBP",
        "total_amount": 5000,
        "payments": [{"paid_by": g.alice["id"], "amount": 5000}],
        "participant_ids": [g.alice["id"], g.bob["id"]],
        "items": [
            {"name": "Pizza", "unit_price": 2000, "quantity": 1, "attributions": [
                {"user_id": g.alice["id"], "instances": 1},
            ]},
            {"name": "Beer", "unit_price": 1000, "quantity": 3, "attributions": []},
        ],
    })
    expense_id = expense["id"]

    # Beer (3000) split between 2 → 1500 each; Pizza all Alice
    # EA: Alice=2000+1500=3500, Bob=1500
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 3500
    assert ea[g.bob["id"]] == 1500

    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 1500
    assert balances[g.bob["id"]] == -1500

    # Add Carol as a participant
    resp = await client.put(f"/api/v1/expenses/{expense_id}/participants", json=[
        g.alice["id"], g.bob["id"], g.carol["id"],
    ])
    assert resp.status_code == 200

    # Beer (3000) now split between 3 → 1000 each; Pizza still all Alice
    # EA: Alice=2000+1000=3000, Bob=1000, Carol=1000
    resp = await client.get(f"/api/v1/expenses/{expense_id}/effective-attributions")
    assert resp.status_code == 200
    ea = {row["user_id"]: row["effective_amount"] for row in resp.json()}
    assert ea[g.alice["id"]] == 3000
    assert ea[g.bob["id"]] == 1000
    assert ea[g.carol["id"]] == 1000

    # Alice: 5000 - 3000 = +2000; Bob: -1000; Carol: -1000
    resp = await client.get(f"/api/v1/groups/{group_id}/balances")
    assert resp.status_code == 200
    balances = {row["user_id"]: row["net_balance"] for row in resp.json()}
    assert balances[g.alice["id"]] == 2000
    assert balances[g.bob["id"]] == -1000
    assert balances[g.carol["id"]] == -1000