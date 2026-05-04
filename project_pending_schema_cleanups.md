# Pending schema cleanups

A running list of schema changes that are deferred — usually because they involve
constraint additions on tables with no data yet, or column drops that the app
isn't ready to live without. Each entry says **what** to change and **why it
was deferred**, so a future migration author can apply them in a single sweep.

> **Note (added phase 3):** Migration files for `03` (companies / properties),
> `04a` (subcontracts + line items), and `04c` (project_financials view) were
> applied directly to Supabase but never committed to `supabase/migrations/`.
> The repo has no `supabase/` directory at all. Before applying any of the
> cleanups below, capture the as-applied schema for those migrations into
> versioned SQL files so the cleanup migrations have a known baseline.

---

## subcontracts

### Add CHECK on `subcontracts.status`
Currently a plain `text` column, defaulting to `'active'`, with no enforcement.
The phase-3 API enforces the allowlist
`['draft', 'signed', 'in_progress', 'complete', 'terminated']`, but the DB
will accept anything. Move the allowlist into a `CHECK` constraint and set
the default to `'draft'` to match the API.

**Deferred because:** if any pre-existing rows have `status='active'`, the
constraint add will fail. Audit + reconcile first, then migrate.

### Drop denormalized `subcontracts.amount_paid` and `subcontracts.amount_retained`
Both columns default to 0 and are never written. The phase-3 API computes both
values from `SUM(subcontract_line_items.paid_to_date)` /
`SUM(subcontract_line_items.retainage_held)` and never reads the header
columns. Once we're confident no other consumer reads them, drop them.

**Deferred because:** zero risk of stale data today (nothing writes them) but
some future caller might still be reading them. Verify no external readers
before dropping.

---

## subcontract_line_items

### Add CHECK `paid_to_date <= contract_amount`
Currently the only amount constraints are `>= 0`. Overbilling silently produces
a negative `remaining_balance` (which is a generated column). The phase-3 API
returns a 400 with `error: 'paid_exceeds_scheduled'` to block it, but a direct
SQL write would bypass that.

**Deferred because:** wanted to ship phase 3 without a DB change. Add the
constraint in the same migration as the cleanups above.

---

## project_draws

### Add CHECK `amount >= 0`
Schema enforces NOT NULL but no sign check. The phase-4 API rejects negative
amounts before insert/update. Bare SQL would still let a negative draw
through and silently flip `total_spent` math.

**Deferred because:** ship phase 4 without a DB change. Bundle with the other
phase-4 cleanups below.

### Add CHECK on `lien_waiver_type` allowlist when `lien_waiver_received=true`
`lien_waiver_type` is currently free text with no enforcement. The phase-4
API enforces the AIA allowlist
`['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final']`
but only when `lien_waiver_received=true`. Move into a partial CHECK:

```sql
ALTER TABLE project_draws ADD CONSTRAINT project_draws_lien_waiver_type_check
  CHECK (
    lien_waiver_received = false
    OR lien_waiver_type IN ('conditional_progress', 'unconditional_progress',
                            'conditional_final', 'unconditional_final')
  );
```

**Deferred because:** API-side gate is sufficient short-term; constraint
needs the same data audit as the other cleanups.

### Add `updated_at` column
Sibling tables (`subcontracts`, `subcontract_line_items`,
`project_budget_categories`, `project_phases`, `project_expenses`,
`project_loans`) all have `updated_at` and the API stamps it on PATCH.
`project_draws` only has `created_at`, so the phase-4 PATCH route
intentionally skips it. Add the column with `default now()` and start
stamping from the API.

**Deferred because:** missing column is a soft inconsistency, not a
correctness issue; bundle with the other cleanups.

### Auto-clear stamped dates on draw status transitions away from terminal states
On draw status transitions away from `'paid'` (e.g. `paid → cancelled`,
`paid → approved`, `paid → rejected`), the `paid_date` column is not
cleared. PATCH auto-stamps but never auto-clears. Affects audit trail
accuracy if a draw moves through `paid` and back. Doesn't affect financials
view (which keys off `status`). Polish: clear `paid_date` on transitions
away from `'paid'`. Same logic applies to `approved_date` if `status` moves
backward to `pending`.

**Deferred because:** API-only change, not a schema change; does not affect
correctness of any aggregation. Bundle with the other phase-4 cleanups when
addressed.

---

## tasks

### Add CHECK on `tasks.status`
Phase-5 API enforces the allowlist
`['pending', 'in_progress', 'completed', 'cancelled']` (matches the
`counts.open_tasks` math: open = not completed/cancelled). DB has no
CHECK on this column today, so direct SQL writes can produce arbitrary
status values that the app won't classify correctly.

**Deferred because:** existing rows from the cleaning/maintenance flows
may use other status values; an audit + reconcile is needed before adding
the constraint.

---

## change_orders

### Add CHECK on `change_orders.status`
Phase-5 API enforces `['pending', 'approved', 'rejected', 'cancelled']`.
DB has no CHECK; default is `'pending'`. Move into a CHECK constraint to
match.

### Add `updated_at` column
Same gap as `project_draws` — `change_orders` only has `created_at`. The
phase-5 PATCH route intentionally skips stamping. Add the column with
`default now()` and start stamping from the API.

### `co_number` is text-numbered ('CO-001', 'CO-002', …) by API only
Schema is `text`, nullable, no auto. Phase-5 API parses the existing max
`CO-###` per project and auto-assigns the next slot. Two parallel POSTs
could race and produce duplicates. Long-term options:
- Add a unique constraint on `(project_id, co_number)` so the second
  POST cleanly fails with a constraint violation
- Move numbering into a SERIAL/sequence column

**Deferred because:** sequential CO creation in practice has no race risk
for the current single-user deployment; revisit when multi-user comes online.

---

## inspections

### Add CHECK on `inspections.result`
Phase-5 API enforces
`['passed', 'failed', 'conditional_pass', 'rescheduled']` (when set).
DB has no CHECK.

### Add CHECK or reference table for `inspections.inspection_type`
Free text today (common values: building, electrical, plumbing, mechanical,
fire, framing, foundation, rough-in, final, third-party). UI uses a
`<datalist>` for hints. If standardization becomes important (e.g. for
reporting), promote to a reference table or CHECK enum.

**Deferred because:** type vocabulary varies by jurisdiction — premature
standardization will block real-world usage.

---

## tasks (multi-tenancy)

### `tasks.org_id` is currently treated as a singleton
The `tasks` table has `org_id` NOT NULL with FK to `organizations`.
Phase-5 API queries the singleton organization row at request time and
stamps it. Works for the current single-org deployment; will break once a
second org row exists. Add a real per-caller org lookup (probably via the
`app_users` row already used by `assertConstructionAccess`) before
standing up a second tenant.

---

## Cross-cutting UX caveat (not a schema cleanup)

`project_financials.total_spent = expenses_paid + draws_paid`. If the same
cash event is logged as both a paid expense AND a paid draw, it
double-counts in `total_spent`. Schema doesn't (and probably shouldn't)
prevent this — the two ledgers serve different purposes. Track to surface a
tooltip on the project header explaining what `total_spent` includes; not a
DB change.
