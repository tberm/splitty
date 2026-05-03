"""
Helper functions for API end-to-end tests.

Each function makes one or more HTTP requests, asserts that the response is
consistent with the data that was sent, and returns the parsed response body
for further assertions in the calling test.
"""

from httpx import AsyncClient


async def create_expense(client: AsyncClient, group_id: int, payload: dict) -> dict:
    """POST /api/v1/groups/{group_id}/expenses and verify the response matches
    the submitted payload. Returns the created expense object."""
    resp = await client.post(f"/api/v1/groups/{group_id}/expenses", json=payload)
    assert resp.status_code == 201
    expense = resp.json()

    assert expense["group_id"] == group_id
    assert expense["title"] == payload["title"]
    assert expense["type"] == payload["type"]
    assert expense["total_amount"] == payload["total_amount"]
    assert expense["currency"] == payload.get("currency", "GBP")

    expected_payments = {(p["paid_by"], p["amount"]) for p in payload["payments"]}
    actual_payments = {(p["paid_by"], p["amount"]) for p in expense["payments"]}
    assert actual_payments == expected_payments

    if payload["type"] == "simple":
        assert expense["split_method"] == payload["split_method"]
        assert "items" not in expense
        if "participant_ids" in payload:
            expected_participant_ids = set(payload["participant_ids"])
        else:
            expected_participant_ids = {a["user_id"] for a in payload.get("attributions", [])}
        actual_participant_ids = {p["user_id"] for p in expense["participants"]}
        assert actual_participant_ids == expected_participant_ids

    elif payload["type"] == "itemised":
        assert "split_method" not in expense
        expected_items = payload.get("items", [])
        assert len(expense["items"]) == len(expected_items)
        actual_items = {item["name"]: item for item in expense["items"]}
        for expected in expected_items:
            actual = actual_items[expected["name"]]
            assert actual["unit_price"] == expected["unit_price"]
            assert actual["quantity"] == expected["quantity"]
            assert actual["item_total"] == expected["unit_price"] * expected["quantity"]
            # split_method is not in the creation payload; infer expected value from
            # the attributions shape: amount → explicit, instances → instances, none → null
            attrs = expected.get("attributions", [])
            if not attrs:
                expected_method = None
            elif "amount" in attrs[0]:
                expected_method = "explicit"
            else:
                expected_method = "instances"
            assert actual["split_method"] == expected_method
        expected_participant_ids = set(payload["participant_ids"])
        actual_participant_ids = {p["user_id"] for p in expense["participants"]}
        assert actual_participant_ids == expected_participant_ids

    return expense


async def submit_assignment(
    client: AsyncClient,
    expense_id: int,
    user_id: int,
    attributions: list[dict],
    acknowledged: bool = True,
) -> dict:
    """PUT /expenses/{expense_id}/participants/{user_id}/assignment and verify
    the response reflects the submitted attributions and acknowledged status.
    Returns the response body."""
    payload = {"attributions": attributions, "acknowledged": acknowledged}
    resp = await client.put(
        f"/api/v1/expenses/{expense_id}/participants/{user_id}/assignment",
        json=payload,
    )
    assert resp.status_code == 200
    result = resp.json()

    assert result["user_id"] == user_id
    assert result["acknowledged"] == acknowledged
    actual_attrs = {a["item_id"]: a["amount"] for a in result["attributions"]}
    for expected in attributions:
        if "amount" in expected:
            assert actual_attrs[expected["item_id"]] == expected["amount"]

    return result
