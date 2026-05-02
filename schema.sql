-- ============================================================
-- EXPENSE SHARING APP — PostgreSQL Schema
-- ============================================================

-- Use a custom domain for minor units (e.g. pence) to make intent clear
CREATE DOMAIN minor_units AS INTEGER
    CHECK (VALUE > 0);

-- ============================================================
-- USERS & GROUPS
-- ============================================================

CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    email       TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE groups (
    id          SERIAL PRIMARY KEY,
    name        TEXT        NOT NULL,
    created_by  INTEGER     NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE group_members (
    group_id    INTEGER     NOT NULL REFERENCES groups(id)  ON DELETE CASCADE,
    user_id     INTEGER     NOT NULL REFERENCES users(id),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

-- ============================================================
-- SPLIT RULES
-- ============================================================

CREATE TYPE split_method AS ENUM ('even', 'explicit');
-- Adding new methods in future: ALTER TYPE split_method ADD VALUE 'percentage';

CREATE TABLE split_rules (
    id      SERIAL PRIMARY KEY,
    method  split_method NOT NULL
);

-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TYPE expense_type AS ENUM ('simple', 'itemised');

CREATE TABLE expenses (
    id              SERIAL PRIMARY KEY,
    group_id        INTEGER      NOT NULL REFERENCES groups(id),
    title           TEXT         NOT NULL,
    description       TEXT,
    -- Opaque key referencing the receipt image in object storage; NULL if no receipt was uploaded
    receipt_image_key TEXT,
    type            expense_type NOT NULL,
    currency        CHAR(3)      NOT NULL DEFAULT 'GBP',
    total_amount    minor_units  NOT NULL,
    -- Only set for simple expenses; NULL for itemised
    split_rule_id   INTEGER      REFERENCES split_rules(id),
    created_by      INTEGER      NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT simple_expense_has_split_rule
        CHECK (type = 'itemised' OR split_rule_id IS NOT NULL),

    CONSTRAINT itemised_expense_has_no_split_rule
        CHECK (type = 'simple'   OR split_rule_id IS NULL)
);

CREATE TABLE expense_items (
    id              SERIAL      PRIMARY KEY,
    expense_id      INTEGER     NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    unit_price      minor_units NOT NULL,
    quantity        INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
    split_rule_id   INTEGER     NOT NULL REFERENCES split_rules(id)
);

-- ============================================================
-- PAYMENTS
-- ============================================================

CREATE TABLE payments (
    id          SERIAL      PRIMARY KEY,
    expense_id  INTEGER     NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    paid_by     INTEGER     NOT NULL REFERENCES users(id),
    amount      minor_units NOT NULL,
    paid_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes       TEXT
);

-- ============================================================
-- PARTICIPANTS & ATTRIBUTIONS
-- ============================================================

CREATE TABLE expense_participants (
    id                  SERIAL  PRIMARY KEY,
    expense_id          INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    user_id             INTEGER NOT NULL REFERENCES users(id),
    -- Only meaningful for itemised expenses; ignored for simple
    is_accounted_for    BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (expense_id, user_id)
);

CREATE TABLE attributions (
    id                  SERIAL  PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),

    -- Exactly one of these must be set
    expense_id          INTEGER REFERENCES expenses(id)      ON DELETE CASCADE,
    expense_item_id     INTEGER REFERENCES expense_items(id) ON DELETE CASCADE,

    -- NULL iff the parent's split_rule.method = 'even'
    explicit_amount     INTEGER CHECK (explicit_amount > 0),

    CONSTRAINT attribution_has_exactly_one_target CHECK (
        (expense_id IS NOT NULL AND expense_item_id IS NULL) OR
        (expense_id IS NULL     AND expense_item_id IS NOT NULL)
    ),
    UNIQUE NULLS NOT DISTINCT (user_id, expense_id),
    UNIQUE NULLS NOT DISTINCT (user_id, expense_item_id)
);

-- ============================================================
-- SETTLEMENTS
-- ============================================================

CREATE TABLE settlements (
    id          SERIAL      PRIMARY KEY,
    group_id    INTEGER     NOT NULL REFERENCES groups(id),
    paid_by     INTEGER     NOT NULL REFERENCES users(id),
    paid_to     INTEGER     NOT NULL REFERENCES users(id),
    amount      minor_units NOT NULL,
    settled_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes       TEXT,

    CONSTRAINT settlement_not_self CHECK (paid_by <> paid_to)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_expenses_group       ON expenses(group_id);
CREATE INDEX idx_payments_expense     ON payments(expense_id);
CREATE INDEX idx_expense_items_expense ON expense_items(expense_id);
CREATE INDEX idx_participants_expense ON expense_participants(expense_id);
CREATE INDEX idx_participants_user    ON expense_participants(user_id);
CREATE INDEX idx_attributions_expense ON attributions(expense_id);
CREATE INDEX idx_attributions_item    ON attributions(expense_item_id);
CREATE INDEX idx_settlements_group    ON settlements(group_id);
CREATE INDEX idx_settlements_paid_by  ON settlements(paid_by);
CREATE INDEX idx_settlements_paid_to  ON settlements(paid_to);

-- ============================================================
-- TRIGGERS — Application Invariants Enforced at DB Level
-- ============================================================

-- ----------------------------------------------------------------
-- 1. Payer must be a member of the expense's group
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_payment_payer_in_group()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM expenses e
        JOIN group_members gm ON gm.group_id = e.group_id
        WHERE e.id = NEW.expense_id AND gm.user_id = NEW.paid_by
    ) THEN
        RAISE EXCEPTION 'Payment payer (user %) is not a member of the expense group', NEW.paid_by;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_payer_in_group
    BEFORE INSERT OR UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION check_payment_payer_in_group();

-- ----------------------------------------------------------------
-- 2. Expense participant must be a member of the expense's group
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_participant_in_group()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM expenses e
        JOIN group_members gm ON gm.group_id = e.group_id
        WHERE e.id = NEW.expense_id AND gm.user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Participant (user %) is not a member of the expense group', NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_participant_in_group
    BEFORE INSERT OR UPDATE ON expense_participants
    FOR EACH ROW EXECUTE FUNCTION check_participant_in_group();

-- ----------------------------------------------------------------
-- 3. Settlement parties must both be members of the group
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_settlement_parties_in_group()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM group_members WHERE group_id = NEW.group_id AND user_id = NEW.paid_by
    ) THEN
        RAISE EXCEPTION 'Settlement paid_by (user %) is not a member of group %', NEW.paid_by, NEW.group_id;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM group_members WHERE group_id = NEW.group_id AND user_id = NEW.paid_to
    ) THEN
        RAISE EXCEPTION 'Settlement paid_to (user %) is not a member of group %', NEW.paid_to, NEW.group_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_settlement_parties_in_group
    BEFORE INSERT OR UPDATE ON settlements
    FOR EACH ROW EXECUTE FUNCTION check_settlement_parties_in_group();

-- ----------------------------------------------------------------
-- 4. Attribution user must be a participant of the expense
--    (checked via expense_id directly or via the item's expense)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_attribution_user_is_participant()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_expense_id INTEGER;
BEGIN
    IF NEW.expense_id IS NOT NULL THEN
        v_expense_id := NEW.expense_id;
    ELSE
        SELECT expense_id INTO v_expense_id FROM expense_items WHERE id = NEW.expense_item_id;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM expense_participants
        WHERE expense_id = v_expense_id AND user_id = NEW.user_id
    ) THEN
        RAISE EXCEPTION 'Attribution user (%) is not a participant of expense %', NEW.user_id, v_expense_id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attribution_user_is_participant
    BEFORE INSERT OR UPDATE ON attributions
    FOR EACH ROW EXECUTE FUNCTION check_attribution_user_is_participant();

-- ----------------------------------------------------------------
-- 5. explicit_amount must be NULL iff split_rule method is 'even'
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_attribution_amount_vs_method()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_method split_method;
BEGIN
    SELECT method INTO v_method FROM split_rules WHERE id = NEW.split_rule_id;

    IF v_method = 'even' AND NEW.explicit_amount IS NOT NULL THEN
        RAISE EXCEPTION 'explicit_amount must be NULL for even split rules';
    END IF;

    IF v_method = 'explicit' AND NEW.explicit_amount IS NULL THEN
        RAISE EXCEPTION 'explicit_amount must be set for explicit split rules';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attribution_amount_vs_method
    BEFORE INSERT OR UPDATE ON attributions
    FOR EACH ROW EXECUTE FUNCTION check_attribution_amount_vs_method();

-- ----------------------------------------------------------------
-- 6. Block reducing total_amount below sum of existing explicit attributions
--    (simple expenses only — itemised expenses are guarded at item level)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_expense_total_reduction()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_explicit_sum INTEGER;
BEGIN
    IF NEW.total_amount < OLD.total_amount THEN
        SELECT COALESCE(SUM(a.explicit_amount), 0) INTO v_explicit_sum
        FROM attributions a
        WHERE a.expense_id = NEW.id;

        IF v_explicit_sum > NEW.total_amount THEN
            RAISE EXCEPTION
                'Cannot reduce total_amount to % — existing explicit attributions sum to %',
                NEW.total_amount, v_explicit_sum;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_expense_total_reduction
    BEFORE UPDATE OF total_amount ON expenses
    FOR EACH ROW EXECUTE FUNCTION check_expense_total_reduction();

-- ----------------------------------------------------------------
-- 7. Block reducing an item's (unit_price * quantity) below its explicit attributions
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_item_price_reduction()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_explicit_sum INTEGER;
    v_new_total    INTEGER;
BEGIN
    v_new_total := NEW.unit_price * NEW.quantity;

    IF v_new_total < (OLD.unit_price * OLD.quantity) THEN
        SELECT COALESCE(SUM(explicit_amount), 0) INTO v_explicit_sum
        FROM attributions
        WHERE expense_item_id = NEW.id;

        IF v_explicit_sum > v_new_total THEN
            RAISE EXCEPTION
                'Cannot reduce item total to % — existing explicit attributions sum to %',
                v_new_total, v_explicit_sum;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_item_price_reduction
    BEFORE UPDATE OF unit_price, quantity ON expense_items
    FOR EACH ROW EXECUTE FUNCTION check_item_price_reduction();

-- ----------------------------------------------------------------
-- 8. Block removing a participant who has explicit attributions
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_participant_removal()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM attributions a
        LEFT JOIN expense_items ei ON ei.id = a.expense_item_id
        WHERE a.user_id = OLD.user_id
          AND (a.expense_id = OLD.expense_id OR ei.expense_id = OLD.expense_id)
          AND a.explicit_amount IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'Cannot remove participant (user %) — they have explicit attributions on expense %',
            OLD.user_id, OLD.expense_id;
    END IF;
    RETURN OLD;
END;
$$;

CREATE TRIGGER trg_participant_removal
    BEFORE DELETE ON expense_participants
    FOR EACH ROW EXECUTE FUNCTION check_participant_removal();


-- ============================================================
-- VIEW: effective_attributions
--
-- Computes what each participant actually owes per expense,
-- combining explicit attributions with remainder logic.
--
-- For simple expenses:
--   - 'even':     total_amount / participant count (remainder to first by id)
--   - 'explicit': stored explicit_amount
--
-- For itemised expenses, computed per item then summed:
--   - 'even':     item_total / participant count (remainder to first by id)
--   - 'explicit': explicit_amount + share of (item_total - SUM(explicit)) 
--                 distributed evenly across non-accounted-for participants
--                 (or all participants if everyone is accounted for)
-- ============================================================

CREATE OR REPLACE VIEW effective_attributions AS

-- ----------------------------------------------------------------
-- BRANCH 1: Simple expenses — even split
-- ----------------------------------------------------------------
WITH simple_even AS (
    SELECT
        e.id                                        AS expense_id,
        e.group_id,
        ep.user_id,
        e.total_amount,
        COUNT(ep.user_id) OVER (PARTITION BY e.id) AS participant_count,
        ROW_NUMBER() OVER (
            PARTITION BY e.id ORDER BY ep.user_id
        )                                           AS participant_rank
    FROM expenses e
    JOIN expense_participants ep ON ep.expense_id = e.id
    JOIN split_rules sr          ON sr.id = e.split_rule_id
    WHERE e.type = 'simple'
      AND sr.method = 'even'
),

simple_even_amounts AS (
    SELECT
        expense_id,
        group_id,
        user_id,
        -- Base share (integer division, floored)
        (total_amount / participant_count)
        -- First participant absorbs the remainder penny/pence
        + CASE WHEN participant_rank = 1
               THEN total_amount - (total_amount / participant_count) * participant_count
               ELSE 0
          END                                       AS effective_amount
    FROM simple_even
),

-- ----------------------------------------------------------------
-- BRANCH 2: Simple expenses — explicit split
-- ----------------------------------------------------------------
simple_explicit AS (
    SELECT
        e.id    AS expense_id,
        e.group_id,
        a.user_id,
        a.explicit_amount AS effective_amount
    FROM expenses e
    JOIN attributions a  ON a.expense_id = e.id
    JOIN split_rules sr  ON sr.id = e.split_rule_id
    WHERE e.type = 'simple'
      AND sr.method = 'explicit'
),

-- ----------------------------------------------------------------
-- BRANCH 3: Itemised expenses
-- Compute per-item, then aggregate to expense level
-- ----------------------------------------------------------------

-- All items with their totals and split method
item_totals AS (
    SELECT
        ei.id           AS item_id,
        ei.expense_id,
        ei.unit_price * ei.quantity AS item_total,
        sr.method       AS split_method
    FROM expense_items ei
    JOIN split_rules sr ON sr.id = ei.split_rule_id
),

-- Count of participants per expense
expense_participant_counts AS (
    SELECT expense_id, COUNT(*) AS total_count
    FROM expense_participants
    GROUP BY expense_id
),

-- Count of non-accounted-for participants per expense
non_accounted_counts AS (
    SELECT expense_id, COUNT(*) AS non_accounted_count
    FROM expense_participants
    WHERE is_accounted_for = FALSE
    GROUP BY expense_id
),

-- Sum of explicit attributions per item
item_explicit_sums AS (
    SELECT
        expense_item_id AS item_id,
        COALESCE(SUM(explicit_amount), 0) AS explicit_sum
    FROM attributions
    WHERE expense_item_id IS NOT NULL
    GROUP BY expense_item_id
),

-- Remainder per item (item_total - explicit_sum)
item_remainders AS (
    SELECT
        it.item_id,
        it.expense_id,
        it.item_total,
        it.split_method,
        COALESCE(ies.explicit_sum, 0)           AS explicit_sum,
        it.item_total - COALESCE(ies.explicit_sum, 0) AS remainder
    FROM item_totals it
    LEFT JOIN item_explicit_sums ies ON ies.item_id = it.item_id
),

-- For each participant, compute their share of each item
itemised_per_participant_item AS (
    SELECT
        ep.expense_id,
        ep.user_id,
        ir.item_id,
        ir.item_total,
        ir.split_method,
        ir.remainder,
        epc.total_count,
        COALESCE(nac.non_accounted_count, 0) AS non_accounted_count,
        ep.is_accounted_for,

        -- Their explicit amount on this item (if any)
        COALESCE(a.explicit_amount, 0) AS explicit_amount,

        -- Rank within remainder pool for this item
        -- Pool = non-accounted-for participants, or all if everyone is accounted for
        CASE
            WHEN COALESCE(nac.non_accounted_count, 0) = 0
                -- Everyone accounted for: all participants share remainder
                THEN ROW_NUMBER() OVER (
                        PARTITION BY ir.item_id
                        ORDER BY ep.user_id
                     )
            WHEN ep.is_accounted_for = FALSE
                -- In the remainder pool
                THEN ROW_NUMBER() OVER (
                        PARTITION BY ir.item_id, ep.is_accounted_for
                        ORDER BY ep.user_id
                     )
            ELSE NULL  -- accounted-for: not in remainder pool
        END AS remainder_pool_rank,

        -- Size of the remainder pool for this item
        CASE
            WHEN COALESCE(nac.non_accounted_count, 0) = 0 THEN epc.total_count
            ELSE COALESCE(nac.non_accounted_count, 0)
        END AS remainder_pool_size,

        -- Is this participant in the remainder pool?
        CASE
            WHEN COALESCE(nac.non_accounted_count, 0) = 0 THEN TRUE   -- all in pool
            WHEN ep.is_accounted_for = FALSE              THEN TRUE   -- non-accounted
            ELSE FALSE
        END AS in_remainder_pool

    FROM expense_participants ep
    JOIN item_remainders ir          ON ir.expense_id = ep.expense_id
    JOIN expense_participant_counts epc ON epc.expense_id = ep.expense_id
    LEFT JOIN non_accounted_counts nac  ON nac.expense_id = ep.expense_id
    -- Their explicit attribution for this item (NULL if none)
    LEFT JOIN attributions a
           ON a.expense_item_id = ir.item_id
          AND a.user_id = ep.user_id

    -- For even-split items every participant is included;
    -- for explicit items only those with attributions OR in remainder pool
    WHERE ir.split_method = 'even'
       OR a.user_id IS NOT NULL
       OR (ir.split_method = 'explicit' AND (
               COALESCE(nac.non_accounted_count, 0) = 0
               OR ep.is_accounted_for = FALSE
           )
       )
),

-- Compute final amount per participant per item
itemised_item_amounts AS (
    SELECT
        expense_id,
        user_id,
        item_id,
        CASE split_method
            WHEN 'even' THEN
                -- Even split across all participants; remainder to first
                (item_total / total_count)
                + CASE WHEN ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY user_id) = 1
                       THEN item_total - (item_total / total_count) * total_count
                       ELSE 0
                  END

            WHEN 'explicit' THEN
                explicit_amount
                + CASE WHEN in_remainder_pool THEN
                    -- Base remainder share
                    (remainder / remainder_pool_size)
                    -- First in pool absorbs rounding
                    + CASE WHEN remainder_pool_rank = 1
                           THEN remainder - (remainder / remainder_pool_size) * remainder_pool_size
                           ELSE 0
                      END
                  ELSE 0
                  END
        END AS item_effective_amount

    FROM itemised_per_participant_item
),

-- Sum across all items per participant per expense
itemised_totals AS (
    SELECT
        ep.expense_id,
        e.group_id,
        ep.user_id,
        COALESCE(SUM(iam.item_effective_amount), 0) AS effective_amount
    FROM expense_participants ep
    JOIN expenses e ON e.id = ep.expense_id AND e.type = 'itemised'
    LEFT JOIN itemised_item_amounts iam
           ON iam.expense_id = ep.expense_id
          AND iam.user_id    = ep.user_id
    GROUP BY ep.expense_id, e.group_id, ep.user_id
)

-- ----------------------------------------------------------------
-- UNION all branches
-- ----------------------------------------------------------------
SELECT expense_id, group_id, user_id, effective_amount FROM simple_even_amounts
UNION ALL
SELECT expense_id, group_id, user_id, effective_amount FROM simple_explicit
UNION ALL
SELECT expense_id, group_id, user_id, effective_amount FROM itemised_totals;


-- ============================================================
-- VIEW: group_balances
--
-- Net balance per user per group:
--   + what they paid (payments)
--   - what they owe (effective attributions)
--   + what they received in settlements
--   - what they paid in settlements
--
-- Positive = group owes them money
-- Negative = they owe the group money
-- ============================================================

CREATE OR REPLACE VIEW group_balances AS

WITH payment_totals AS (
    SELECT e.group_id, p.paid_by AS user_id, SUM(p.amount) AS total_paid
    FROM payments p
    JOIN expenses e ON e.id = p.expense_id
    GROUP BY e.group_id, p.paid_by
),

attribution_totals AS (
    SELECT group_id, user_id, SUM(effective_amount) AS total_owed
    FROM effective_attributions
    GROUP BY group_id, user_id
),

settlement_sent AS (
    SELECT group_id, paid_by AS user_id, SUM(amount) AS total_sent
    FROM settlements
    GROUP BY group_id, paid_by
),

settlement_received AS (
    SELECT group_id, paid_to AS user_id, SUM(amount) AS total_received
    FROM settlements
    GROUP BY group_id, paid_to
),

all_users AS (
    SELECT DISTINCT group_id, user_id FROM (
        SELECT group_id, user_id FROM payment_totals
        UNION
        SELECT group_id, user_id FROM attribution_totals
        UNION
        SELECT group_id, user_id FROM settlement_sent
        UNION
        SELECT group_id, user_id FROM settlement_received
    ) sub
)

SELECT
    au.group_id,
    au.user_id,
    COALESCE(pt.total_paid,     0)
    - COALESCE(at.total_owed,   0)
    + COALESCE(sr.total_received, 0)
    - COALESCE(ss.total_sent,   0) AS net_balance
FROM all_users au
LEFT JOIN payment_totals     pt ON pt.group_id = au.group_id AND pt.user_id = au.user_id
LEFT JOIN attribution_totals at ON at.group_id = au.group_id AND at.user_id = au.user_id
LEFT JOIN settlement_received sr ON sr.group_id = au.group_id AND sr.user_id = au.user_id
LEFT JOIN settlement_sent     ss ON ss.group_id = au.group_id AND ss.user_id = au.user_id;