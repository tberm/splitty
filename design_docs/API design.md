# Expense Sharing App — API Design

## Overview

REST API to be implemented with FastAPI. All endpoints are prefixed with `/api/v1`.

### Conventions

- **Amounts** — all monetary values are in minor units (e.g. pence). The `currency` field uses ISO 4217 (e.g. `"GBP"`).
- **Timestamps** — ISO 8601 with UTC timezone (e.g. `"2026-03-07T12:00:00Z"`).
- **Authentication** — JWT Bearer tokens. All endpoints except `/auth/*` require `Authorization: Bearer <token>`.
- **Split method** — the API exposes `split_method: "even" | "explicit"` inline on expenses and items; the underlying `split_rules` table is an implementation detail invisible to callers.
- **Partial updates** — `PUT` endpoints accept only the fields you want to change; omitted fields are left unchanged.
- **Pagination** — list endpoints return `{ "items": [...], "total": N, "page": N, "page_size": N }`. Default `page_size` is 20.

### Standard Error Shape

```json
{
  "detail": "Human-readable message",
  "code": "machine_readable_code"
}
```

FastAPI validation errors (422) use FastAPI's default `detail` array format.

---

## Auth

### `POST /api/v1/auth/register`

**Request**
```json
{
  "name": "Alice",
  "email": "alice@example.com",
  "password": "hunter2"
}
```

**Response `201`**
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "created_at": "2026-03-07T12:00:00Z"
}
```

---

### `POST /api/v1/auth/login`

**Request**
```json
{
  "email": "alice@example.com",
  "password": "hunter2"
}
```

**Response `200`**
```json
{
  "access_token": "<jwt>",
  "refresh_token": "<jwt>",
  "token_type": "bearer"
}
```

---

### `POST /api/v1/auth/refresh`

**Request**
```json
{ "refresh_token": "<jwt>" }
```

**Response `200`**
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

---

## Users

### `GET /api/v1/users/me`

Returns the authenticated user's profile.

**Response `200`**
```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "created_at": "2026-03-07T12:00:00Z"
}
```

---

### `PUT /api/v1/users/me`

Update name or email.

**Request** *(all fields optional)*
```json
{ "name": "Alice Smith" }
```

**Response `200`** — updated user object.

---

### `GET /api/v1/users?email={email}`

Look up a user by exact email address, for inviting them to a group. Returns `404` if not found.

**Response `200`**
```json
{
  "id": 2,
  "name": "Bob",
  "email": "bob@example.com"
}
```

---

## Groups

### `GET /api/v1/groups`

List all groups the authenticated user belongs to.

**Response `200`**
```json
[
  {
    "id": 1,
    "name": "Weekend Trip",
    "created_by": 1,
    "created_at": "2026-03-01T09:00:00Z",
    "member_count": 4
  }
]
```

---

### `POST /api/v1/groups`

Create a new group. The creator is automatically added as the first member.

**Request**
```json
{ "name": "Weekend Trip" }
```

**Response `201`**
```json
{
  "id": 1,
  "name": "Weekend Trip",
  "created_by": 1,
  "created_at": "2026-03-01T09:00:00Z",
  "member_count": 1
}
```

---

### `GET /api/v1/groups/{group_id}`

Full group detail including members.

**Response `200`**
```json
{
  "id": 1,
  "name": "Weekend Trip",
  "created_by": 1,
  "created_at": "2026-03-01T09:00:00Z",
  "members": [
    { "user_id": 1, "name": "Alice", "email": "alice@example.com", "joined_at": "2026-03-01T09:00:00Z" },
    { "user_id": 2, "name": "Bob",   "email": "bob@example.com",   "joined_at": "2026-03-01T09:05:00Z" }
  ]
}
```

---

### `PUT /api/v1/groups/{group_id}`

**Request**
```json
{ "name": "Scotland Trip" }
```

**Response `200`** — updated group object (same shape as `GET`).

---

### `DELETE /api/v1/groups/{group_id}`

**Response `204`**

---

### `GET /api/v1/groups/{group_id}/members`

**Response `200`**
```json
[
  { "user_id": 1, "name": "Alice", "email": "alice@example.com", "joined_at": "2026-03-01T09:00:00Z" }
]
```

---

### `POST /api/v1/groups/{group_id}/members`

Add a user to the group.

**Request**
```json
{ "user_id": 3 }
```

**Response `201`**
```json
{ "user_id": 3, "name": "Carol", "email": "carol@example.com", "joined_at": "2026-03-07T10:00:00Z" }
```

---

### `DELETE /api/v1/groups/{group_id}/members/{user_id}`

Remove a member from the group.

**Response `204`**

---

### `GET /api/v1/groups/{group_id}/summary`

Convenience endpoint for the mobile home screen — returns group info, member list, balances, and the 10 most recent expenses in one request.

**Response `200`**
```json
{
  "group": { "id": 1, "name": "Weekend Trip", "created_by": 1, "created_at": "..." },
  "members": [ ... ],
  "balances": [
    { "user_id": 1, "name": "Alice", "net_balance": 4500 },
    { "user_id": 2, "name": "Bob",   "net_balance": -4500 }
  ],
  "recent_expenses": [ ... ]
}
```

---

## Balances

### `GET /api/v1/groups/{group_id}/balances`

Returns the net balance for every group member (from the `group_balances` view). A positive value means the group owes that user money; negative means they owe the group.

**Response `200`**
```json
[
  { "user_id": 1, "name": "Alice", "net_balance":  4500 },
  { "user_id": 2, "name": "Bob",   "net_balance": -4500 }
]
```

---

## Settlements

### `GET /api/v1/groups/{group_id}/settlements`

Paginated list of settlements for the group, ordered by `settled_at` descending.

**Response `200`** — paginated list of settlement objects.

---

### `POST /api/v1/groups/{group_id}/settlements`

Record a direct payment between two members.

**Request**
```json
{
  "paid_by": 2,
  "paid_to": 1,
  "amount": 4500,
  "settled_at": "2026-03-07T14:00:00Z",
  "notes": "Paying back for hotel"
}
```
`settled_at` defaults to the server's current time if omitted.

**Response `201`**
```json
{
  "id": 7,
  "group_id": 1,
  "paid_by": 2,
  "paid_to": 1,
  "amount": 4500,
  "settled_at": "2026-03-07T14:00:00Z",
  "notes": "Paying back for hotel"
}
```

---

### `DELETE /api/v1/groups/{group_id}/settlements/{settlement_id}`

**Response `204`**

---

## Receipt Scanning

### `POST /api/v1/receipts/scan`

Uploads a receipt image to the server, which forwards it to an external cloud AI service for extraction. Returns suggested item details that the client uses to pre-populate the itemised expense creation form. The user then reviews, edits, and submits the expense through the normal flow.

This endpoint is stateless — nothing is persisted. It is intentionally decoupled from expense creation so the user can correct AI errors before any data is saved.

The response may take several seconds while the AI service processes the image. Clients should show a loading indicator.

**Request** — `multipart/form-data`

| Field   | Type | Notes                                      |
| ------- | ---- | ------------------------------------------ |
| `image` | file | JPEG, PNG, HEIC, or PDF. Maximum 10 MB.    |

**Response `200`**
```json
{
  "receipt_image_key": "r_a1b2c3d4",
  "currency": "GBP",
  "suggested_total": 7500,
  "items": [
    { "name": "Margherita Pizza", "unit_price": 1200, "quantity": 1 },
    { "name": "Garlic Bread",     "unit_price":  450, "quantity": 2 },
    { "name": "House Wine",       "unit_price": 2400, "quantity": 1 }
  ]
}
```

- `receipt_image_key` — an opaque server-assigned key identifying the uploaded image in object storage. Pass this in the subsequent expense creation request. The key is meaningless to the client; never attempt to construct a storage URL from it — use `GET /expenses/{id}/receipt-image` to retrieve a signed URL when the image needs to be displayed.
- `currency` — ISO 4217 code detected from the receipt, or `null` if not determinable. The client falls back to the group's currency when `null`.
- `suggested_total` — the receipt grand total in minor units as read by the AI, or `null` if not found. Intended as a cross-check for the user against the sum of the returned items.
- `items[].unit_price` — in minor units of the detected currency.

> **Orphaned images:** if the user abandons expense creation after scanning, the image remains in storage with no DB record referencing it. A periodic server-side cleanup job should delete unreferenced objects after a suitable TTL (e.g. 48 hours).

**Error responses**

| Status | Condition |
| ------ | --------- |
| `400`  | Unsupported file type or file exceeds 10 MB |
| `422`  | Image was processed but no items could be extracted (too blurry, not a receipt, etc.) |
| `502`  | External AI service unavailable |

On `422` the client should surface a clear message and allow the user to enter items manually.

---

## Expenses

### `GET /api/v1/groups/{group_id}/expenses`

Paginated list of expenses for the group, ordered by `created_at` descending. Each item is a summary (no items or attributions).

**Response `200`** — paginated list:
```json
{
  "items": [
    {
      "id": 5,
      "title": "Hotel",
      "type": "simple",
      "currency": "GBP",
      "total_amount": 24000,
      "created_by": 1,
      "created_at": "2026-03-05T15:00:00Z"
    }
  ],
  "total": 12,
  "page": 1,
  "page_size": 20
}
```

---

### `POST /api/v1/groups/{group_id}/expenses`

Create an expense with all its parts in one request. For itemised expenses created from a scanned receipt, the client pre-populates the `items` array with the data returned by `POST /api/v1/receipts/scan`, after the user has reviewed and edited it.

#### Simple — even split

```json
{
  "title": "Dinner",
  "description": "Italian place",
  "type": "simple",
  "currency": "GBP",
  "total_amount": 6000,
  "split_method": "even",
  "payments": [
    { "paid_by": 1, "amount": 6000 }
  ],
  "participant_ids": [1, 2, 3]
}
```

#### Simple — explicit split

`attributions` implicitly defines the participant list; `participant_ids` is not used.

```json
{
  "title": "Dinner",
  "type": "simple",
  "currency": "GBP",
  "total_amount": 6000,
  "split_method": "explicit",
  "payments": [
    { "paid_by": 1, "amount": 6000 }
  ],
  "attributions": [
    { "user_id": 1, "amount": 2500 },
    { "user_id": 2, "amount": 2000 },
    { "user_id": 3, "amount": 1500 }
  ]
}
```

#### Itemised

`items` and per-item `attributions` may be omitted (or empty) to support the self-assignment flow where participants fill in their own items later.

```json
{
  "title": "Restaurant",
  "type": "itemised",
  "currency": "GBP",
  "total_amount": 7500,
  "receipt_image_key": "r_a1b2c3d4",
  "payments": [
    { "paid_by": 1, "amount": 7500 }
  ],
  "participant_ids": [1, 2, 3, 4],
  "items": [
    {
      "name": "Margherita",
      "unit_price": 1200,
      "quantity": 2,
      "split_method": "even",
      "attributions": []
    },
    {
      "name": "Wine",
      "unit_price": 3000,
      "quantity": 1,
      "split_method": "explicit",
      "attributions": [
        { "user_id": 1, "amount": 2000 },
        { "user_id": 2, "amount": 1000 }
      ]
    }
  ]
}
```

**Response `201`** — full expense object (same shape as `GET /api/v1/expenses/{expense_id}`).

---

### `GET /api/v1/expenses/{expense_id}`

Full expense detail including payments, participants, and (for itemised) items with their attributions.

**Response `200`**
```json
{
  "id": 5,
  "group_id": 1,
  "title": "Restaurant",
  "description": null,
  "type": "itemised",
  "currency": "GBP",
  "total_amount": 7500,
  "split_method": null,
  "created_by": 1,
  "created_at": "2026-03-05T19:00:00Z",
  "has_receipt": true,
  "payments": [
    { "id": 3, "paid_by": 1, "amount": 7500, "paid_at": "2026-03-05T19:00:00Z", "notes": null }
  ],
  "participants": [
    { "user_id": 1, "name": "Alice", "is_accounted_for": true  },
    { "user_id": 2, "name": "Bob",   "is_accounted_for": false }
  ],
  "items": [
    {
      "id": 10,
      "name": "Margherita",
      "unit_price": 1200,
      "quantity": 2,
      "item_total": 2400,
      "split_method": "even",
      "attributions": []
    },
    {
      "id": 11,
      "name": "Wine",
      "unit_price": 3000,
      "quantity": 1,
      "item_total": 3000,
      "split_method": "explicit",
      "attributions": [
        { "user_id": 1, "amount": 2000 },
        { "user_id": 2, "amount": 1000 }
      ]
    }
  ]
}
```

`split_method` is `null` for itemised expenses (the method is per-item). `items` is `null` for simple expenses. `has_receipt` is `true` if a receipt image is stored; use the endpoint below to retrieve it.

---

### `GET /api/v1/expenses/{expense_id}/receipt-image`

Returns a short-lived signed URL for the expense's receipt image. The client fetches the image directly from object storage using this URL — the image is never proxied through the API server.

Returns `404` if no receipt is associated with the expense.

**Response `200`**
```json
{
  "url": "https://storage.example.com/receipts/r_a1b2c3d4?X-Amz-Expires=900&X-Amz-Signature=...",
  "expires_at": "2026-03-07T12:15:00Z"
}
```

The URL is valid for 15 minutes. Clients should request a fresh URL each time the user navigates to the receipt view rather than caching it.

---

### `PUT /api/v1/expenses/{expense_id}`

Update mutable top-level fields. The DB enforces that `total_amount` cannot be reduced below the sum of existing explicit attributions.

**Request** *(all fields optional)*
```json
{
  "title": "Restaurant (updated)",
  "description": "Friday dinner",
  "total_amount": 7600
}
```

**Response `200`** — updated expense object.

---

### `DELETE /api/v1/expenses/{expense_id}`

**Response `204`**

---

## Payments

### `GET /api/v1/expenses/{expense_id}/payments`

**Response `200`**
```json
[
  { "id": 3, "paid_by": 1, "amount": 7500, "paid_at": "2026-03-05T19:00:00Z", "notes": null }
]
```

---

### `POST /api/v1/expenses/{expense_id}/payments`

**Request**
```json
{ "paid_by": 2, "amount": 3000, "paid_at": "2026-03-05T19:00:00Z", "notes": "Split at the till" }
```
`paid_at` defaults to server time if omitted.

**Response `201`** — payment object.

---

### `PUT /api/v1/expenses/{expense_id}/payments/{payment_id}`

**Request** *(all fields optional)*
```json
{ "amount": 3500, "notes": "Corrected amount" }
```

**Response `200`** — updated payment object.

---

### `DELETE /api/v1/expenses/{expense_id}/payments/{payment_id}`

**Response `204`**

---

## Expense Participants

### `GET /api/v1/expenses/{expense_id}/participants`

**Response `200`**
```json
[
  { "user_id": 1, "name": "Alice", "is_accounted_for": true  },
  { "user_id": 2, "name": "Bob",   "is_accounted_for": false }
]
```

---

### `POST /api/v1/expenses/{expense_id}/participants`

Add a participant to the expense. Must be a member of the expense's group.

**Request**
```json
{ "user_id": 4 }
```

**Response `201`**
```json
{ "user_id": 4, "name": "Dave", "is_accounted_for": false }
```

---

### `PUT /api/v1/expenses/{expense_id}/participants/{user_id}`

Ad-hoc update to a participant's `is_accounted_for` flag. Prefer the compound `/assignment` endpoint below for the normal self-assignment flow.

**Request**
```json
{ "is_accounted_for": true }
```

**Response `200`** — updated participant object.

---

### `PUT /api/v1/expenses/{expense_id}/participants/{user_id}/assignment`

The primary endpoint for the self-assignment flow. Submits a participant's item attributions and marks them as accounted for in a single atomic transaction — either everything commits or nothing does. This prevents the broken intermediate state that would arise if attributions were saved but the `is_accounted_for` flag was never set (e.g. due to a dropped connection).

Idempotent: re-submitting the same payload is safe.

**Request**
```json
{
  "attributions": [
    { "item_id": 10, "amount": 1500 },
    { "item_id": 11, "amount": 2000 }
  ],
  "is_accounted_for": true
}
```

`attributions` is an array of explicit item claims. Items omitted from the array are not touched — the participant will absorb a share of those items' remainder until they or someone else accounts for them. `is_accounted_for` may be `false` to save a draft without finalising.

The server validates that each submitted `amount` does not exceed the corresponding item's total.

**Response `200`**
```json
{
  "user_id": 2,
  "name": "Bob",
  "is_accounted_for": true,
  "attributions": [
    { "item_id": 10, "amount": 1500 },
    { "item_id": 11, "amount": 2000 }
  ]
}
```

---

### `DELETE /api/v1/expenses/{expense_id}/participants/{user_id}`

Fails (`409`) if the participant has any explicit attributions on the expense or its items.

**Response `204`**

---

## Attributions — Simple Expenses

These endpoints manage the attribution rows for a simple expense.

### `GET /api/v1/expenses/{expense_id}/attributions`

**Response `200`**
```json
[
  { "user_id": 1, "amount": 2500 },
  { "user_id": 2, "amount": 2000 }
]
```
For `even` splits the stored rows have no amount (`null`); amounts are derived from `effective-attributions`.

---

### `POST /api/v1/expenses/{expense_id}/attributions`

Add an attribution for a participant. `amount` must be `null` for `even` splits and set for `explicit`.

**Request**
```json
{ "user_id": 3, "amount": 1500 }
```

**Response `201`** — attribution object.

---

### `PUT /api/v1/expenses/{expense_id}/attributions/{user_id}`

**Request**
```json
{ "amount": 1800 }
```

**Response `200`** — updated attribution object.

---

### `DELETE /api/v1/expenses/{expense_id}/attributions/{user_id}`

**Response `204`**

---

## Expense Items

These endpoints apply only to itemised expenses.

### `GET /api/v1/expenses/{expense_id}/items`

**Response `200`** — array of item objects (same shape as items in the full expense response).

---

### `POST /api/v1/expenses/{expense_id}/items`

**Request**
```json
{
  "name": "Tiramisu",
  "unit_price": 700,
  "quantity": 2,
  "split_method": "even",
  "attributions": []
}
```

**Response `201`** — item object.

---

### `PUT /api/v1/expenses/{expense_id}/items/{item_id}`

The DB enforces that `unit_price * quantity` cannot be reduced below the sum of existing explicit attributions for the item.

**Request** *(all fields optional)*
```json
{ "name": "Tiramisu x2", "unit_price": 750, "quantity": 2 }
```

**Response `200`** — updated item object.

---

### `DELETE /api/v1/expenses/{expense_id}/items/{item_id}`

Cascades to the item's attributions.

**Response `204`**

---

## Attributions — Expense Items

### `GET /api/v1/expenses/{expense_id}/items/{item_id}/attributions`

**Response `200`**
```json
[
  { "user_id": 1, "amount": 2000 },
  { "user_id": 2, "amount": 1000 }
]
```

---

### `POST /api/v1/expenses/{expense_id}/items/{item_id}/attributions`

Add a single item attribution. For the normal self-assignment flow use the compound `/assignment` endpoint instead; this endpoint is for ad-hoc additions and admin corrections.

**Request**
```json
{ "user_id": 3, "amount": 1500 }
```

**Response `201`** — attribution object.

---

### `PUT /api/v1/expenses/{expense_id}/items/{item_id}/attributions/{user_id}`

**Request**
```json
{ "amount": 1800 }
```

**Response `200`** — updated attribution object.

---

### `DELETE /api/v1/expenses/{expense_id}/items/{item_id}/attributions/{user_id}`

**Response `204`**

---

## Effective Attributions

### `GET /api/v1/expenses/{expense_id}/effective-attributions`

Returns each participant's computed share, derived from the `effective_attributions` view. This is the live estimate that updates as participants complete their self-assignment.

**Response `200`**
```json
[
  { "user_id": 1, "name": "Alice", "effective_amount": 2567 },
  { "user_id": 2, "name": "Bob",   "effective_amount": 2500 },
  { "user_id": 3, "name": "Carol", "effective_amount": 2433 }
]
```

---

## Authorisation Rules

| Action                         | Requirement                                 |
| ------------------------------ | ------------------------------------------- |
| View group, expenses, balances | Member of the group                         |
| Create expense / settlement    | Member of the group                         |
| Add participant to expense     | Member of the group                         |
| Mark self as accounted for     | The participant themselves (or group admin) |
| Submit attributions for a user | That user themselves (or group admin)       |
| Delete an expense / settlement | Creator or group admin                      |
|                                |                                             |

---

## Self-Assignment Flow Summary

1. Payer calls `POST /groups/{id}/expenses` with `participant_ids` and payments; items may be added at creation or afterwards via `POST /expenses/{id}/items`.
2. Each participant calls `GET /expenses/{id}` to see the item list, the current effective-attribution estimates, and which participants are still pending.
3. The participant selects their items in the UI. The client computes and displays a running total from their selections.
4. The participant ticks "I've selected all my items" and taps submit. The client calls `PUT /expenses/{id}/participants/{user_id}/assignment` with all their attributions and `"is_accounted_for": true` in a single request.
5. This atomically upserts the attributions and sets the flag, removing them from the remainder pool and stabilising other participants' estimates.
6. Once all participants are accounted for, `GET /expenses/{id}/effective-attributions` returns the final settled amounts.
