## To add to API

- **Participant list on expense summary** — `SimpleExpenseSummaryOut` / `ItemisedExpenseSummaryOut` don't include participant IDs or counts. The group overview screen needs this to: (a) compute each user's fair share for the "My spend" hero stat, (b) show a per-row "you owe £x" label, and (c) make the "Includes me" expense filter accurate (currently approximated by `created_by`).

- **Payer(s) on expense summary** — the summary only exposes `created_by` (who recorded the expense), not who actually paid. The expense row shows "{name} paid · {date}" using `created_by` as a proxy, which will be wrong whenever someone logs an expense on behalf of another payer.

- **Category/emoji on expenses** — no category field on any expense type. Currently using expense `type` (`simple` → 💸, `itemised` → 🧾) as a placeholder icon.

- **Suggested settlements endpoint** — there is no server-side endpoint for minimum-transaction settlement suggestions. Currently computed client-side with a greedy algorithm. Moving this to the server would allow for more sophisticated algorithms and ensure consistency across clients.
