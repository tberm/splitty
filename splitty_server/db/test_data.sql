-- ============================================================
-- Test / development seed data
-- 3 users, 1 group, 1 even-split expense paid by Alice
-- ============================================================

INSERT INTO users (name, email) VALUES
    ('Alice', 'alice@example.com'),
    ('Bob',   'bob@example.com'),
    ('Carol', 'carol@example.com');

INSERT INTO groups (name, created_by) VALUES
    ('Weekend Trip', 1);

INSERT INTO group_members (group_id, user_id) VALUES
    (1, 1),
    (1, 2),
    (1, 3);

-- £30.00 even-split expense, paid in full by Alice
INSERT INTO expenses (group_id, title, type, total_amount, split_method, created_by) VALUES
    (1, 'Dinner at Trattoria', 'simple', 3000, 'even', 1);

INSERT INTO payments (expense_id, paid_by, amount) VALUES
    (1, 1, 3000);

INSERT INTO expense_participants (expense_id, user_id) VALUES
    (1, 1),
    (1, 2),
    (1, 3);

-- Even split: no explicit_amount needed; the view computes £10 each
INSERT INTO attributions (user_id, expense_id) VALUES
    (1, 1),
    (2, 1),
    (3, 1);
