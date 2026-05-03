# Handoff: Splitty — Expense Entry & Group Summary Screens

## Overview

Splitty is a mobile app for recording shared expenses and tracking who owes whom. This handoff covers two screens selected for initial implementation:

1. **Screen E — Add/Edit Expense** (a single-screen form with drill-down sub-screens)
2. **Screen G — Group Summary Page** (hero header + Expenses/Balances tabs)

## About the Design Files

The file `wireframes.html` (included in this package) is a **low-fidelity wireframe reference** built in HTML/React for rapid exploration. It is **not** production code. The task is to recreate these screens in Expo (React Native) using your project's established patterns, design system, and component library.

Visual styling (fonts, exact colours, border styles) in the wireframes use a sketchy/hand-drawn aesthetic that is **not** the intended final look — use your app's design system for all styling decisions. The wireframes define **layout, information hierarchy, interactions, and navigation flows** only.

## Fidelity

**Low-fidelity.** These are structural wireframes. Layout, component positions, field order, navigation flows, and interaction logic should be followed closely. Visual styling should be implemented using your own design system.

---

## Screen E — Add/Edit Expense

### Overview

A modal screen for creating or editing a shared expense. Designed around progressive disclosure: the simple case (one payer, even split) is handled entirely on the main screen; advanced options push to dedicated sub-screens.

### Navigation Structure

This screen is a mini stack navigator with four screens:

```
Main (modal root)
 ├── Items          (push)  — itemised receipt entry
 ├── Paid By        (push)  — who paid and how much each
 └── Split          (push)  — split method configuration
```

All sub-screens navigate back to Main via a Back button. The main screen has Cancel (dismiss modal) and Save.

---

### E.1 — Main Screen

**Header / Navigation Bar**
- Left: "Cancel" button — dismisses the modal without saving
- Centre: title "Add Expense" (or "Edit Expense" when editing)
- Right: "Save" button — validates and submits; disabled until minimum fields are filled (description + amount + at least one participant)

**Section: Who's involved**
- Label: "Who's involved"
- A horizontal wrapping chip list showing members of the current group
- Each chip: avatar (coloured circle with initial) + name
- Chips toggle selected/deselected on tap; selected chips have filled background
- At least one participant must be selected
- A dashed "+ Add" chip at the end opens a participant search (out of scope for this handoff)
- Default: all group members selected

**Section: Description**
- Label: "Description"
- Single-line text input
- Placeholder: "e.g. Dinner at Nobu"
- Required field

**Section: Amount**
- Label: "Amount"
- Row: currency selector pill (e.g. "£ GBP") + large numeric input
- Currency pill: tappable, opens a currency picker (can be a simple modal list for now)
- Numeric input: large, monospace font, right-aligned; numeric keyboard
- Below the amount row: a secondary button labelled "Add items from receipt"
  - Dashed border style to indicate it's optional/secondary
  - Icon: 🧾
  - When items have been added, label changes to e.g. "3 items · £84.50" (count + running total)
  - Tapping navigates to the Items sub-screen (E.3)

**Section: Paid by**
- Label: "Paid by"
- A tappable summary row (full-width, bordered) showing:
  - Avatar(s) of the payer(s)
  - Text summary: single payer → person's name; multiple payers → "Alex £50.00, Beth £34.50"
  - Trailing chevron (›)
- Helper text below: "Tap to change who paid or split the bill"
- Default: the current user is the sole payer for the full amount
- Tapping navigates to the Paid By sub-screen (E.4)

**Section: Split method**
- Label: "Split method"
- A tappable summary row (full-width, bordered) showing:
  - Icon representing the current method (⚖️ even / 💰 exact amounts / % percentage / 🔢 shares)
  - Text summary: e.g. "Even ÷ 3 · £28.17 each"
  - Trailing chevron (›)
- Helper text below: "Tap to customise the split"
- Default: even split among selected participants
- Tapping navigates to the Split sub-screen (E.5)

**Footer**
- Full-width primary "Save Expense" button, pinned to bottom above safe area

---

### E.2 — State: Editing an existing expense

Same as E.1 with all fields pre-populated from the existing expense object. Header title changes to "Edit Expense". Save button updates rather than creates.

---

### E.3 — Items Sub-screen

Accessed from: tapping "Add items from receipt" on E.1.

**Header**
- Left: Back button
- Centre: "Items"
- Right: "Done" — returns to main screen applying current items

**Section: Receipt**
Three states:

*State: empty*
- Large dashed upload zone with:
  - Placeholder illustration (striped rectangle representing a receipt)
  - Heading: "Tap to photograph receipt"
  - Sub-text: "We'll scan it and pull out the line items automatically"
  - Two secondary buttons: "📷 Camera" and "🖼 Library"
- Tapping the zone or Camera button requests camera permission and opens camera
- Tapping Library opens the photo library

*State: scanning*
- The upload zone is replaced with an animated scanning indicator
- Text: "Scanning receipt…" / "Identifying line items"
- Non-interactive while scanning

*State: done*
- Compact row showing a thumbnail of the receipt image + "Receipt scanned ✓"
- Sub-text: "{n} items detected · tap to rescan"
- Tapping opens the camera/library picker again

**Section: Line items**
- Section label: "Line items" with a "+ Add" button on the right
- Each item row:
  - Index number (left, muted)
  - Text input: item name (flex, fills available space)
  - Currency symbol + numeric input: item amount (fixed width, ~80px)
  - ✕ delete button (right)
- Items are editable regardless of how they were added (scanned or manual)
- "+ Add" button appends a blank row

**Reconciliation footer** (shown when items.length > 0):
- "Items total": running sum of all item amounts
- "Expense total": the amount set on the main screen
- If they match (within £0.01): green confirmation note "✓ Items match the total"
- If they differ: warning note showing the difference and direction ("items exceed total" / "some spend unaccounted")

**Important:** the items list is informational and used for itemised splitting (future feature). For now it is stored against the expense but does not affect the split calculation.

---

### E.4 — Paid By Sub-screen

Accessed from: tapping the "Paid by" row on E.1.

**Header**
- Left: Back
- Centre: "Paid by"
- Right: "Done"

**Toggle: Payment type**
- Segmented control: "One person" | "Multiple payers"
- Default: "One person"

*When "One person" selected:*
- List of selected participants (from E.1), each as a full-width tappable row:
  - Avatar + name (flex)
  - Checkmark when selected
- Single-select: tapping one deselects the others
- Default: the current user

*When "Multiple payers" selected:*
- List of selected participants, each row:
  - Avatar + name (flex)
  - Currency symbol + numeric amount input (right-aligned)
- Leave blank = did not pay
- Helper text: "Leave blank if not a payer"
- Running totals below the list:
  - "Total entered": sum of filled amounts
  - "Expense total": amount from E.1
- Validation note: green "✓ Amounts match the total" when the sum equals the expense total (within £0.01); otherwise amber warning

**On Done:** the selected payer(s) and amounts are written back to the main screen state and reflected in the "Paid by" summary row.

---

### E.5 — Split Sub-screen

Accessed from: tapping the "Split method" row on E.1.

**Header**
- Left: Back
- Centre: "Split method"
- Right: "Done"

**Method selector:** segmented control with four options:
`Even` | `Exact £` | `Percent` | `Shares`

*Even (default):*
- Read-only list of participants, each showing their equal share amount
- Note: "Each person owes £{amount}"
- No inputs — fully automatic

*Exact £:*
- List of participants, each with a currency + amount input
- Reconciliation row showing "Remaining to assign" (total minus sum of entered amounts)
- Remaining shown in red if > £0.01, green when zero

*Percent:*
- List of participants, each with a % input + computed £ amount (read-only)
- Running total of percentages shown below; red if ≠ 100%, green at 100%

*Shares:*
- List of participants, each with a − / [count] / + control
- Minimum 1 share per person
- Each person's computed amount shown (their shares ÷ total shares × expense total)

**On Done:** selected method + values are written back to main screen state and reflected in the "Split method" summary row.

---

### E — State Management

```typescript
// Expense form state
interface ExpenseFormState {
  description: string;
  amount: number;
  currencyCode: string;          // e.g. "GBP"
  participants: UserId[];        // members selected in "Who's involved"
  
  // Paid by
  payerMode: 'one' | 'multi';
  singlePayerId: UserId;
  multiPayerAmounts: Record<UserId, number>;  // only populated in multi mode
  
  // Split
  splitMode: 'even' | 'amounts' | 'percent' | 'shares';
  splitAmounts: Record<UserId, number>;       // for 'amounts' mode
  splitPercents: Record<UserId, number>;      // for 'percent' mode
  splitShares: Record<UserId, number>;        // for 'shares' mode; default 1
  
  // Items
  items: { id: string; name: string; amount: number }[];
  receiptImageUri?: string;
}
```

Derived values (compute, don't store):
- `itemsTotal`: sum of items[].amount
- `payerTotal`: sum of multiPayerAmounts values
- `splitTotal`: sum of splitAmounts / percent totals / computed from shares
- `splitSummaryText`: human-readable summary for the main screen row

---

### E — API Endpoints

Based on the data model, the following endpoints are expected:

| Action | Method | Path |
|--------|--------|------|
| Create expense | `POST` | `/groups/{groupId}/expenses` |
| Update expense | `PUT` | `/groups/{groupId}/expenses/{expenseId}` |
| Upload receipt image | `POST` | `/expenses/{expenseId}/receipt` |
| Scan receipt (OCR) | `POST` | `/expenses/{expenseId}/receipt/scan` → returns `{ items: [{name, amount}] }` |

---

## Screen G — Group Summary Page

### Overview

The main page a user sees when they open a group/trip. A dark hero header shows the group name and key financial stats; below it, a tab bar switches between a scrollable expense list and a balance breakdown.

### G.1 — Full Screen Layout

```
┌─────────────────────────────────┐
│  ← Trips          [group name]  │  ← nav row (inside hero)
│  [Group name + emoji]           │  ← hero header (dark bg)
│  [Members] · [n] expenses       │
│  ┌───────────┐ ┌───────────┐    │
│  │ My spend  │ │ Your bal. │    │
│  │ £190.24   │ │ +£42.30   │    │
│  └───────────┘ └───────────┘    │
├─────────────────────────────────┤
│     Expenses  │  Balances       │  ← tab bar
├─────────────────────────────────┤
│  [Search bar]                   │  ← only on Expenses tab
│  [All] [Mine]                   │  ← filter chips
├─────────────────────────────────┤
│  TODAY                          │  ← date section header
│  [expense row]                  │
│  [expense row]                  │
│  YESTERDAY                      │
│  [expense row]                  │
│  ...                            │
├─────────────────────────────────┤
│        ＋ New expense           │  ← FAB (floating)
└─────────────────────────────────┘
```

---

### G.2 — Hero Header

Background: dark (near-black). Text: light.

**Navigation row** (inside the hero):
- Left: "← Trips" text button — navigates back to trips/groups list
- Right: "⋯" overflow button — group settings, leave group, etc.

**Group identity:**
- Group name in large bold type
- Member names joined by comma + "· {n} expenses" in muted smaller type

**Stats row:** two equal-width cards side by side, semi-transparent background with subtle border.

*Left card — configurable stat:*
- Label: "My spend" (preferred default) or "Group total" (alternate)
- Value: monetary amount
- "My spend" = sum of (expense.amount / expense.participants.length) for all expenses where the current user is a participant
- "Group total" = sum of all expense amounts in the group

*Right card — Your balance:*
- Label: "Your balance"
- Value: net balance for the current user (positive = others owe you, negative = you owe others)
- Positive value: green text (e.g. `#6fcf97`)
- Negative value: red text (e.g. `#eb5757`)
- Format: `+£42.30` or `-£28.10`

---

### G.3 — Tab Bar

Two tabs: "Expenses" and "Balances".
- Active tab: underline indicator, full-opacity label
- Inactive tab: no underline, muted label
- Sits immediately below the hero header, sticky

---

### G.4 — Expenses Tab

**Search bar:**
- Full-width text input with a search icon on the left
- Placeholder: "Search expenses…"
- Filters the expense list live as the user types (matches against expense description, case-insensitive)
- Slightly tinted background to distinguish from list

**Filter chips** (horizontal row below search):
- "All expenses" — shows all group expenses (default)
- "Includes me" — shows only expenses where the current user is a participant
- Single-select; active chip has filled/inverted style

**Expense list:**
- Grouped by date (section headers: "Today", "Yesterday", "1 May", etc.)
- Date headers: small, uppercase, muted
- Sorted most-recent first within each group

**Expense row** layout:
```
[category icon]  [description]          [total amount]
                 [payer avatar + name · date]  [my share label]
```
- Category icon: square with rounded corners, emoji or icon
- Description: bold, truncated to one line
- Payer avatar + name: small avatar (16px) + "{name} paid · {date}" in muted text
- Total amount: monospace, right-aligned
- My share label (right, below total amount):
  - If current user paid: "you get back" in green
  - If current user is a participant but didn't pay: "you owe £{share}" in red
  - If current user is not a participant: no label
- Tapping a row navigates to the expense detail screen (out of scope for this handoff)

---

### G.5 — Balances Tab

**Per-person balance rows:**
Each group member gets a row:
- Avatar (26px) + Name (bold)
- "(you)" suffix for the current user
- Net balance amount (right-aligned, monospaced)
  - Positive (owed money): green
  - Negative (owes money): red
  - Zero (settled): muted "—"
- Progress bar beneath name row:
  - Width proportional to |net| relative to the highest absolute net in the group
  - Green for positive, red for negative
  - Not shown when net is zero

**Suggested settlements section:**
- Section label: "Suggested settlements"
- One row per debt, showing the minimum-transaction settlement:
  - Debtor avatar + name → Creditor avatar + name
  - Amount
  - "Settle" button — records a settlement payment (links to settlement flow, out of scope)
- Algorithm: simplified debt (minimise number of transactions), not per-pair

---

### G.6 — New Expense Button

- Floating action button (FAB), bottom-right corner, above the safe area
- Label: "＋ New expense"
- Tapping opens Screen E (Add Expense) as a modal, pre-scoped to the current group
- Stays visible on both tabs

---

### G — State Management

```typescript
interface GroupPageState {
  groupId: string;
  activeTab: 'expenses' | 'balances';
  search: string;
  filter: 'all' | 'mine';
}
```

Loaded from API:
```typescript
interface GroupSummary {
  id: string;
  name: string;
  emoji?: string;
  members: User[];
  expenses: Expense[];        // paginated in production; load all for MVP
  balances: Balance[];        // pre-computed by server
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  currencyCode: string;
  paidBy: UserId | PayerSplit[];
  participants: UserId[];
  splitMode: SplitMode;
  date: string;               // ISO 8601
  category?: string;          // emoji or category key
  items?: LineItem[];
}

interface Balance {
  userId: UserId;
  net: number;                // positive = owed, negative = owes
  settlements: Settlement[];  // suggested transactions to settle
}

interface Settlement {
  fromUserId: UserId;
  toUserId: UserId;
  amount: number;
}
```

---

### G — API Endpoints

| Action | Method | Path |
|--------|--------|------|
| Load group + members | `GET` | `/groups/{groupId}` |
| Load expenses | `GET` | `/groups/{groupId}/expenses?sort=date_desc` |
| Load balances | `GET` | `/groups/{groupId}/balances` |
| Record settlement | `POST` | `/groups/{groupId}/settlements` |

---

## Navigation Context

These two screens fit into a broader navigation structure like:

```
App Root
└── (Tab navigator or drawer — home, groups, profile)
    └── Groups list
        └── Group detail [Screen G] ← this handoff
            └── Add/Edit expense [Screen E] ← this handoff (modal)
                ├── Items sub-screen
                ├── Paid By sub-screen
                └── Split sub-screen
```

Recommended Expo navigation: `expo-router` with a stack for Group detail and a modal stack for the Add/Edit expense flow.

---

## Design Tokens (to map to your design system)

The following semantic values appear in the wireframes. Map these to your design system's equivalents:

| Token | Purpose | Wireframe value |
|-------|---------|-----------------|
| `color.positive` | Positive balance, owed to you | `#4a7c59` / `#6fcf97` (on dark) |
| `color.negative` | Negative balance, you owe | `#c0392b` / `#eb5757` (on dark) |
| `color.neutral` | Settled / zero balance | muted grey |
| `color.hero.bg` | Group hero background | near-black (`#1a1a1a`) |
| `color.hero.card.bg` | Stat card inside hero | `rgba(255,255,255,0.07)` |
| `font.mono` | Monetary amounts | monospace |
| `spacing.section` | Between form sections | ~12px |
| `radius.chip` | Participant chips | pill (20px) |
| `radius.card` | Stat cards, summary rows | 4–6px |

---

## Assets

No image assets are required for the initial implementation. Category icons are emoji characters embedded in expense data. Avatars are generated from user initials with a consistent colour derived from the user ID.

**Avatar colour generation (suggested):**
```typescript
const AVATAR_PALETTE = [
  { bg: '#d4e8d0', fg: '#2d5a3d' },
  { bg: '#d0dff5', fg: '#1e3a6e' },
  { bg: '#f5d0d0', fg: '#6e1e1e' },
  { bg: '#f5e8d0', fg: '#6e4a1e' },
  { bg: '#e8d0f5', fg: '#4a1e6e' },
];
// Pick by: AVATAR_PALETTE[hashUserId(userId) % AVATAR_PALETTE.length]
```

---

## Files in This Package

| File | Purpose |
|------|---------|
| `HANDOFF.md` | This document |
| `wireframes.html` | Interactive wireframe reference — open in a browser to explore all screens |

Open `Expense Screen Wireframes.html` in a browser and scroll to:
- **"E · Hybrid (A+B)"** section — the four screens of the expense add/edit flow
- **"Group Page · Wireframe Explorations"** section — the "G · Hero Header" artboard

All screens are interactive: tap buttons, toggle tabs, enter text, and navigate sub-screens to understand the intended behaviour.
