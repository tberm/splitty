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
-- EXPENSES
-- ============================================================

CREATE TYPE split_method AS ENUM ('even', 'explicit', 'instances');
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
    split_method    split_method,
    -- When true, participants are shown a self-assignment reminder; only valid for itemised expenses
    request_self_assignments BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      INTEGER      NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT simple_expense_has_split_method
        CHECK (type = 'itemised' OR split_method IS NOT NULL),

    CONSTRAINT itemised_expense_has_no_split_method
        CHECK (type = 'simple'   OR split_method IS NULL),

    CONSTRAINT request_self_assignments_only_for_itemised
        CHECK (type = 'itemised' OR request_self_assignments = FALSE)
);

CREATE TABLE expense_items (
    id              SERIAL      PRIMARY KEY,
    expense_id      INTEGER     NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    unit_price      minor_units NOT NULL,
    quantity        INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),

    -- NULL until the first attribution claim establishes it as 'explicit' or 'instances'.
    -- Set by trigger; not writable directly once non-NULL.
    split_method    split_method,

    CONSTRAINT item_split_method_valid
        CHECK (split_method IS NULL OR split_method IN ('explicit', 'instances'))
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
    -- Set by participant to dismiss the self-assignment reminder
    acknowledged        BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (expense_id, user_id)
);

CREATE TABLE attributions (
    id                  SERIAL  PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id),

    -- Exactly one of these must be set
    expense_id          INTEGER REFERENCES expenses(id)      ON DELETE CASCADE,
    expense_item_id     INTEGER REFERENCES expense_items(id) ON DELETE CASCADE,

    -- For expense-level (simple) attributions:
    --   explicit_amount is set for 'explicit' split; NULL for 'even'.
    -- For item-level attributions:
    --   exactly one of explicit_amount or claimed_instances must be set.
    explicit_amount     INTEGER CHECK (explicit_amount > 0),
    claimed_instances   INTEGER CHECK (claimed_instances > 0),

    CONSTRAINT attribution_has_exactly_one_target CHECK (
        (expense_id IS NOT NULL AND expense_item_id IS NULL) OR
        (expense_id IS NULL     AND expense_item_id IS NOT NULL)
    ),
    -- explicit_amount and claimed_instances are mutually exclusive
    CONSTRAINT attribution_amount_xor_instances CHECK (
        NOT (explicit_amount IS NOT NULL AND claimed_instances IS NOT NULL)
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
-- 5. Validate attribution fields against split method; establish
--    item split_method on the first claim if not yet set.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_attribution_fields_vs_method()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_method split_method;
BEGIN
    -- ---- Expense-level attributions (simple expenses) ----
    IF NEW.expense_id IS NOT NULL THEN
        SELECT split_method INTO v_method FROM expenses WHERE id = NEW.expense_id;

        IF v_method = 'even' AND NEW.explicit_amount IS NOT NULL THEN
            RAISE EXCEPTION 'explicit_amount must be NULL for even split';
        END IF;
        IF v_method = 'explicit' AND NEW.explicit_amount IS NULL THEN
            RAISE EXCEPTION 'explicit_amount must be set for explicit split';
        END IF;
        IF NEW.claimed_instances IS NOT NULL THEN
            RAISE EXCEPTION 'claimed_instances is only valid for item attributions';
        END IF;
        RETURN NEW;
    END IF;

    -- ---- Item-level attributions ----
    -- Exactly one of explicit_amount / claimed_instances must be provided
    IF NEW.explicit_amount IS NULL AND NEW.claimed_instances IS NULL THEN
        RAISE EXCEPTION 'Item attribution must provide either explicit_amount or claimed_instances';
    END IF;
    -- (Both non-null is already blocked by the table CHECK constraint)

    SELECT split_method INTO v_method FROM expense_items WHERE id = NEW.expense_item_id;

    IF v_method IS NULL THEN
        -- First claim: establish the item's split method
        IF NEW.explicit_amount IS NOT NULL THEN
            UPDATE expense_items SET split_method = 'explicit'  WHERE id = NEW.expense_item_id;
        ELSE
            UPDATE expense_items SET split_method = 'instances' WHERE id = NEW.expense_item_id;
        END IF;
    ELSIF v_method = 'explicit' AND NEW.explicit_amount IS NULL THEN
        RAISE EXCEPTION 'Item % uses explicit split — provide explicit_amount', NEW.expense_item_id;
    ELSIF v_method = 'instances' AND NEW.claimed_instances IS NULL THEN
        RAISE EXCEPTION 'Item % uses instances split — provide claimed_instances', NEW.expense_item_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attribution_fields_vs_method
    BEFORE INSERT OR UPDATE ON attributions
    FOR EACH ROW EXECUTE FUNCTION check_attribution_fields_vs_method();

-- ----------------------------------------------------------------
-- 5b. Block direct changes to a item's split_method once established
--     (it is set only via the attribution trigger above)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_item_split_method_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.split_method IS NOT NULL AND NEW.split_method IS DISTINCT FROM OLD.split_method THEN
        RAISE EXCEPTION
            'Cannot change split_method of item % once attributions have been made', OLD.id;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_item_split_method_immutable
    BEFORE UPDATE OF split_method ON expense_items
    FOR EACH ROW EXECUTE FUNCTION check_item_split_method_immutable();

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
-- 7. Block reducing an item's price/quantity below what is already claimed.
--    For 'explicit' items: monetary floor = SUM(explicit_amount).
--    For 'instances' items: quantity floor = SUM(claimed_instances).
--    Unit_price changes are always allowed for instances items.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_item_price_reduction()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_explicit_sum  INTEGER;
    v_instances_sum INTEGER;
    v_new_total     INTEGER;
BEGIN
    v_new_total := NEW.unit_price * NEW.quantity;

    IF OLD.split_method = 'instances' THEN
        -- Only quantity matters for instances items
        IF NEW.quantity < OLD.quantity THEN
            SELECT COALESCE(SUM(claimed_instances), 0) INTO v_instances_sum
            FROM attributions WHERE expense_item_id = NEW.id;

            IF v_instances_sum > NEW.quantity THEN
                RAISE EXCEPTION
                    'Cannot reduce item quantity to % — existing instance claims sum to %',
                    NEW.quantity, v_instances_sum;
            END IF;
        END IF;
    ELSE
        -- For explicit (or not-yet-established) items: monetary floor
        IF v_new_total < (OLD.unit_price * OLD.quantity) THEN
            SELECT COALESCE(SUM(explicit_amount), 0) INTO v_explicit_sum
            FROM attributions WHERE expense_item_id = NEW.id;

            IF v_explicit_sum > v_new_total THEN
                RAISE EXCEPTION
                    'Cannot reduce item total to % — existing explicit attributions sum to %',
                    v_new_total, v_explicit_sum;
            END IF;
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
          AND (a.explicit_amount IS NOT NULL OR a.claimed_instances IS NOT NULL)
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
--   - 'even':     total_amount / participant count (remainder to lowest id)
--   - 'explicit': stored explicit_amount
--
-- For itemised expenses, computed per item then summed:
--   - NULL (unclaimed): full item_total enters the remainder pool
--   - 'explicit': explicit_amount + share of remainder
--   - 'instances': claimed_instances * unit_price + share of remainder
--   Remainder is always split evenly across all participants.
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
    WHERE e.type = 'simple'
      AND e.split_method = 'even'
),

simple_even_amounts AS (
    SELECT
        expense_id,
        group_id,
        user_id,
        -- Base share (integer division, floored)
        (total_amount / participant_count)
        -- First participant (lowest id) absorbs the remainder penny
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
    WHERE e.type = 'simple'
      AND e.split_method = 'explicit'
),

-- ----------------------------------------------------------------
-- BRANCH 3: Itemised expenses
-- Compute per-item, then aggregate to expense level
-- ----------------------------------------------------------------

-- All items with their totals, unit_price, and split method
item_totals AS (
    SELECT
        ei.id                           AS item_id,
        ei.expense_id,
        ei.unit_price,
        ei.quantity,
        ei.unit_price * ei.quantity     AS item_total,
        ei.split_method
    FROM expense_items ei
),

-- Count of participants per expense
expense_participant_counts AS (
    SELECT expense_id, COUNT(*) AS total_count
    FROM expense_participants
    GROUP BY expense_id
),

-- Monetary total already claimed per item, unified across both methods:
--   'explicit':  SUM(explicit_amount)
--   'instances': SUM(claimed_instances) * unit_price
--   NULL:        0 (no claims yet)
item_claimed_totals AS (
    SELECT
        it.item_id,
        CASE it.split_method
            WHEN 'instances' THEN COALESCE(SUM(a.claimed_instances), 0) * it.unit_price
            ELSE                  COALESCE(SUM(a.explicit_amount),   0)
        END AS claimed_total
    FROM item_totals it
    LEFT JOIN attributions a ON a.expense_item_id = it.item_id
    GROUP BY it.item_id, it.split_method, it.unit_price
),

-- Remainder per item = item_total - claimed_total
item_remainders AS (
    SELECT
        it.item_id,
        it.expense_id,
        it.item_total,
        it.unit_price,
        it.split_method,
        COALESCE(ict.claimed_total, 0)                  AS claimed_total,
        it.item_total - COALESCE(ict.claimed_total, 0)  AS remainder
    FROM item_totals it
    LEFT JOIN item_claimed_totals ict ON ict.item_id = it.item_id
),

-- For each participant, compute their base amount and remainder share per item
itemised_per_participant_item AS (
    SELECT
        ep.expense_id,
        ep.user_id,
        ir.item_id,
        ir.item_total,
        ir.unit_price,
        ir.split_method,
        ir.remainder,
        epc.total_count,

        -- Participant's explicitly claimed monetary share on this item
        CASE ir.split_method
            WHEN 'explicit'  THEN COALESCE(a.explicit_amount, 0)
            WHEN 'instances' THEN COALESCE(a.claimed_instances, 0) * ir.unit_price
            ELSE 0  -- NULL (unclaimed): base is 0
        END AS base_amount,

        -- Rank within remainder pool (all participants, ordered by user_id for rounding)
        ROW_NUMBER() OVER (
            PARTITION BY ir.item_id
            ORDER BY ep.user_id
        ) AS remainder_pool_rank

    FROM expense_participants ep
    JOIN item_remainders ir             ON ir.expense_id = ep.expense_id
    JOIN expense_participant_counts epc ON epc.expense_id = ep.expense_id
    LEFT JOIN attributions a
           ON a.expense_item_id = ir.item_id
          AND a.user_id = ep.user_id
),

-- Compute final amount per participant per item
itemised_item_amounts AS (
    SELECT
        expense_id,
        user_id,
        item_id,
        -- Base claim + equal share of unattributed remainder (remainder penny to lowest user_id)
        base_amount
        + (remainder / total_count)
        + CASE WHEN remainder_pool_rank = 1
               THEN remainder - (remainder / total_count) * total_count
               ELSE 0
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