## Entities
    
---

### User

|Property|Type|Notes|
|---|---|---|
|`id`|UUID||
|`name`|string||
|`email`|string||

---

### Group

|Property|Type|Notes|
|---|---|---|
|`id`|UUID||
|`members`|User[]||

---

### SplitRule

The shared mechanism for dividing a cost among a set of users. Used by both `GeneralExpense` (to split the total) and `Item` (to split item cost). The same resolution logic applies in both cases.

|Property|Type|Notes|
|---|---|---|
|`method`|`even` \| `explicit` \| `residual`||
|`shares`|SplitShare[]||

**SplitShare**

|Property|Type|Notes|
|---|---|---|
|`user`|User||
|`amount`|decimal \| null|Required when `method = explicit`; null otherwise|

**Resolution logic** (given a `total` to be split):

- `even` — `total` is divided equally among all users in `shares`
- `explicit` — each user's `amount` is used directly; amounts must sum to `total`
- `residual` — each user with a non-null `amount` pays that amount; the remainder of `total` is split equally among users with a null `amount`

---

### Expense _(abstract base)_

|Property|Type|Notes|
|---|---|---|
|`id`|UUID||
|`group`|Group||
|`description`|string||
|`currency`|string||
|`created_at`|timestamp||
|`created_by`|User|The user who logged the expense|
|`payers`|PayerShare[]|Who paid and how much each paid; must sum to expense total|

**PayerShare**

|Property|Type|Notes|
|---|---|---|
|`user`|User||
|`amount`|decimal||

---

### GeneralExpense _extends Expense_

A single-total expense with an explicit participant list and a single `SplitRule` applied to that total.

|Property|Type|Notes|
|---|---|---|
|`total`|decimal|Positive for an expense, negative for a payment|
|`participants`|User[]|Explicit list of who owes a share|
|`split_rule`|SplitRule|Applied to `total` across `participants`|

> **Payments** are `GeneralExpense` records with a negative `total`. The semantic inversion is: `payers` are the recipients of the money, and `participants` are those who sent it. No special type is needed.

*Don't like this model. Expense costs should sum to the actual money that has been spent by group and should not include money moving between group members. Conversely, attributions should some to the within-group balance of each member. Correct way would be to model payments as expenses with 0 total and 2 participants, where one has negative cost attribution (making the payment) and the other has the same cost but positive (receiving the payment).*

---

### ItemisedExpense _extends Expense_

An expense composed of individual items. The total is derived from the items. Payers are responsible for the derived total.

|Property|Type|Notes|
|---|---|---|
|`items`|Item[]||
|`participants`|ItemisedParticipant[]|Everyone present (e.g. everyone at the table)|

**`ItemisedExpense.total`** is derived: `sum(item.total for all items)`

---

### Item

A single line within an `ItemisedExpense`.

|Property|Type|Notes|
|---|---|---|
|`id`|UUID||
|`description`|string||
|`total`|decimal||
|`split_rule`|SplitRule|How this item's cost is divided — see below|

The `split_rule` on an item operates over a subset of `ItemisedExpense.participants` determined by the item's type:

- **Shared item** (e.g. tip, service charge) — `split_rule` applies to _all_ participants. The `even` method is typical. The item is excluded from the unassigned pool.
- **Assigned item** — `split_rule` uses `explicit` or `residual`, where shares identify which participants claimed a portion. Unassigned remainder (null-amount users) contributes to the unassigned pool.

---

### ItemisedParticipant

Tracks each participant's status within an `ItemisedExpense`.

|Property|Type|Notes|
|---|---|---|
|`user`|User|Must be in `ItemisedExpense.participants`|
|`is_accounted_for`|boolean|Set by the participant when they have finished selecting all their items|

---

## Derived Values for ItemisedExpense

These are computed, not stored.

**Unassigned pool** — the portion of non-shared item cost not yet claimed by any participant:

```
unassigned_pool = sum(item.total for non-shared items)
                − sum(all explicit share amounts across all non-shared items)
```

**Amount owed by participant `p`:**

```
shared_cost(p)   = sum of p's share from each shared item's split_rule

assigned_cost(p) = sum of p's explicit amounts across all non-shared items

residual_cost(p) = unassigned_pool / count(participants where is_accounted_for = false)
                   if p is not accounted_for, else 0

total_owed(p)    = shared_cost(p) + assigned_cost(p) + residual_cost(p)
```

> **Invariant:** `sum(total_owed for all participants)` must equal `ItemisedExpense.total`.

---

## Relationships

```
Group               ──< User
Expense             >── Group
Expense             ──< PayerShare >── User
GeneralExpense      ──  SplitRule ──< SplitShare >── User
ItemisedExpense     ──< Item ──  SplitRule ──< SplitShare >── User
ItemisedExpense     ──< ItemisedParticipant >── User
```

---

## Constraints & Validation Rules

- `sum(PayerShare.amount)` must equal the expense total
- `sum(SplitShare.amount)` for `explicit` splits must equal the total being split
- All users referenced in payer shares, split shares, or participants must be members of the group
- A participant should not be able to mark `is_accounted_for = true` if they have no share assignments and the unassigned pool is non-zero (optional UX guard)
- Shared items must use the `even` method and apply to all participants (no selective shares)