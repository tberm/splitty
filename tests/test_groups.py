async def test_simple_group_has_three_members(db, simple_group):
    g = simple_group
    count = await db.fetchval(
        "SELECT COUNT(*) FROM group_members WHERE group_id = $1",
        g.group["id"],
    )
    assert count == 3
