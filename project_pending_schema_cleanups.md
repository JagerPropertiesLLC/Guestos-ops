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
