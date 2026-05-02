# Expense Sharing App — Core Concepts

## Overview

This app allows groups of people to track shared expenses and settle debts between members. It handles everything from simple evenly-split bills to complex itemised receipts where each person selects exactly what they're responsible for.

---

## Groups and Users

Users belong to **groups**, which are the top-level organising unit of the app. All expenses, payments, and settlements are scoped to a group, and a user's net balance is computed within each group independently. A user can belong to multiple groups.

---

## Expenses

An **expense** represents an event where money was spent on behalf of the group — a restaurant bill, a grocery run, a hotel booking, and so on. Every expense belongs to a group and has a total amount stored in minor currency units (e.g. pence).

There are two kinds of expense:

### Simple Expenses

A single total amount split between participants according to a single split rule. The simplest case is "£60 dinner, split evenly between four people."

### Itemised Expenses

A collection of line items (e.g. individual dishes on a restaurant receipt), each with its own price, quantity, and split rule. Payments still attach to the expense as a whole, but attributions are calculated per item and then summed.

Itemised expenses support a self-assignment flow where participants select their own items rather than having everything assigned upfront (see [Self-Assignment](https://claude.ai/chat/e61a0c25-c637-4c64-95d4-061a0b1b8629#self-assignment-itemised-expenses) below).

---

## Payments

A **payment** records money that a user actually paid out — for example, the person who put the bill on their card. An expense can have multiple payments (e.g. two people splitting a bill at the till). The sum of all payments on an expense must equal the expense's total amount.

Payments record _who paid_, not _who owes_. These are tracked separately via attributions.

---

## Split Rules

A **split rule** defines how an expense or item is divided among participants. The method is set at the expense level (for simple expenses) or at the item level (for itemised expenses).

**Simple expenses** use a single split method set at creation:

|Method|Behaviour|
|---|---|
|`even`|The total is divided equally among all participants. No explicit amounts are stored — the share is computed at read time.|
|`explicit`|Each participant's share is stored as an explicit monetary amount. The sum of explicit amounts may be less than the total; any remainder is handled by the attribution logic below.|

**Itemised expense items** do not have a split method at creation. The method is established by the first attribution claim made against the item and determines how all subsequent claims for that item must be expressed:

|Method|Behaviour|
|---|---|
|`explicit`|Each participant's share is stored as an explicit monetary amount. Established when the first attribution is submitted with an `amount`.|
|`instances`|Each participant claims a whole-number count of item instances. Their monetary share is derived as `claimed_instances × unit_price`. Established when the first attribution is submitted with an `instances` count.|

An item with no attributions yet has `split_method: null`. Its full cost flows into the remainder pool until claims are made.

The model is designed to accommodate additional methods in future (e.g. percentage-based splits or weighted shares) by adding new values to the `split_method` type.

---

## Attributions

An **attribution** represents a participant's responsibility for a portion of an expense or item. Attributions are the counterpart to payments: where payments track who paid, attributions track who owes.

For `explicit` split rules, each attribution stores the participant's specific monetary amount. For `even` splits, attribution rows serve as a participant list — the amounts are computed dynamically at read time. For `instances` split rules, each attribution stores the participant's claimed instance count; the monetary amount is derived as `claimed_instances × unit_price` at read time.

---

## Participants

Every user involved in an expense is recorded as an **expense participant**. Participants must be members of the expense's group.

For itemised expenses with `request_self_assignments` enabled, each participant has an `acknowledged` flag they can set to indicate they have finished selecting their items and no longer need the self-assignment reminder.

---

## Self-Assignment: Itemised Expenses

Itemised expenses support a flow where the payer creates the expense and adds participants, but each participant then marks their own items rather than having everything pre-assigned. When `request_self_assignments` is `true` on the expense, participants see a prompt in the app to complete their self-assignment. A participant dismisses this prompt by setting their `acknowledged` flag to `true`.

Items are created without a split method. When a participant first claims an item they implicitly establish that item's method for all subsequent claimants:

- Submitting an `amount` establishes the item as `explicit` — subsequent claims must also supply an `amount`.
- Submitting an `instances` count establishes the item as `instances` — subsequent claims must also supply an `instances` count.

The key concept is **remainder attribution**: at any point in time, some portion of the total cost may not yet have been explicitly attributed to anyone. The app resolves this implicitly:

1. **Remainder per item:**
   - Unclaimed item (no attributions): full item total
   - `explicit` item: item total − sum of claimed amounts
   - `instances` item: `(quantity − sum of claimed instances) × unit_price`
2. The remainder across all items is pooled and split evenly across **all participants**

Each person's effective share is a live estimate that shifts as participants make their claims. The amounts stabilise once all items are fully claimed.

---

## Effective Attributions

Because `even` splits and itemised remainders are computed dynamically, the app exposes an **effective attributions** view that calculates what each participant actually owes at query time. This combines:

- Even division of the expense total (for simple `even` expenses)
- Explicit attribution amounts (for `explicit` splits)
- Instance-derived amounts — `claimed_instances × unit_price` (for `instances` item splits)
- Each participant's share of any unattributed remainder (unclaimed items, or the unattributed portion of partially-claimed items)

Integer rounding is handled by assigning any indivisible pence to the participant with the lowest ID in the relevant pool.

---

## Settlements

A **settlement** records a direct payment between two group members to resolve a debt — for example, Alice transferring £30 to Bob outside the app. Settlements are not linked to any specific expense; they adjust the overall group balance between the two parties.

Both participants must be members of the group, and a user cannot settle with themselves.

---

## Balances

A user's **net balance** within a group is:

```
net balance = (total payments made) − (total effective attributions) + (settlements received) − (settlements sent)
```

A positive balance means the group owes that user money. A negative balance means they owe the group.

---

## Key Constraints

The following rules are enforced by the database:

- Payment payers, expense participants, and settlement parties must all be members of the relevant group
- Attribution users must be participants of the relevant expense
- A participant cannot be removed from an expense if they have explicit attributions
- An expense's total amount cannot be reduced below the sum of existing explicit attributions
- An item's `unit_price × quantity` cannot be reduced below the sum of existing claimed amounts (for `explicit` items) or `sum of claimed instances × unit_price` (for `instances` items)
- Once an item has at least one attribution, its established split method cannot be changed
- All attributions on a given item must use the same method: either all supply `amount` (`explicit`) or all supply `instances` (`instances`)
- For `instances` items, the sum of claimed instances across all attributions must not exceed the item's `quantity`; each individual claim must be ≥ 1
- For `explicit` items, the sum of claimed amounts must not exceed `unit_price × quantity`
- Updating an attribution's value must not change its method (e.g. replacing `instances` with `amount` is rejected)
- Explicit amounts must be `NULL` for `even` split rules on simple expenses, and must be set for `explicit` split rules