# Casitas En Pueblo — Property & Construction Management Platform

**Owner:** Judson Jager (judson@duracoproperties.com)
**Last updated:** May 4, 2026 (Phase 7a + 7b shipped)

---

## How to use this file

This is the single source of truth for every Claude session working on this platform. **Read it before doing anything.** Both this Claude project and any Claude Code session should orient from this file first.

**Update rhythm:**
- The chat that ships work also updates the relevant section ("State" or "In flight") and commits the change as part of the same commit.
- Strategic decisions go in "Decisions log" so we don't re-litigate them in future sessions.
- "Open questions / Next up" is the queue for whatever's coming.
- When you find drift between this doc and the real codebase, fix the doc in the same chat. (May 4 lesson — six weeks of LTR / Marina / CAM / Insurance work shipped without anyone updating this file, and the next session almost built Phase 6 against a fictional schema.)

**Role separation across sessions:**
- **Strategic chat (Claude project, this file's home)** — planning, screenshot review, direction, updating this doc. Doesn't write production code.
- **Claude Code sessions** — execution. Builds what's in "In flight." Updates "State" when shipping.
- **One-off side chats** — try not to. If used, they don't touch this doc.

---

## Push discipline

NEVER push directly to main on either repo. Always:
1. Create a feature branch
2. Push the branch
3. Open a PR
4. Merge via `gh pr merge` or GitHub UI

`Guestos-ops` enforces this with GitHub branch protection on `main` (PRs required, no direct pushes). `CasitasEnPueblo-Agent` has no enforced protection (private repo on Free plan) — treat the convention as if it were enforced.

Both repos also have a guard at the top of `deploy.bat` that aborts if the current branch is `main` (and `gh pr` is the deploy path now). Don't disable the guard.

---

## What we're building

A property and construction management platform with three sides:
- **STR (Short-term rentals)** — 5 properties / 16 units in Pueblo, CO. Live, in `TEST_MODE`.
- **LTR (Long-term tenants)** — schema fully built, UI mostly stubbed.
- **Construction project management** — fully built (Phase 5 shipped May 3). Two live projects:
  - **West Center Tech** — warehouse development at 201 N Laredo St, Aurora, CO 80011
  - **La Maison Moderne** — Judson's personal home renovation at 917 N Kalamath St, Denver, CO

Eventually replaces Hostaway as its own channel manager (direct sync to Airbnb / VRBO / Booking.com). Web today, mobile later. Multi-org capable, currently single-org.

---

## Modules in production

| Module | What's there | Status |
|---|---|---|
| **STR** | GuestOS agent, cleaning schedule, approvals queue, tasks, dream-team roster | Live in TEST_MODE |
| **LTR** | Full tenant/lease/portal/comms schema; `/long-term/leases` page (degraded — calls 404 APIs and shows empty) | Schema + 1 page |
| **Marina / commercial** | Slips, addons, annual launch passes, daily launch log | Schema only, no UI |
| **CAM reconciliation** | Annual rollup with snapshot fields, monthly QBO totals as source of truth | Schema only, no UI |
| **Maintenance** | Generic kanban over `maintenance_requests`, filterable by module | Shipped |
| **Tasks + Scheduler** | Unified `tasks` table (STR + construction), 14-day staff scheduler grid, AI rewrite | Shipped |
| **Insurance & Compliance** | Property × coverage traffic-light grid, vendor COI table, renewal-request stub | Shipped |
| **Property Tax** | Records list with paid/due/overdue pills | Shipped |
| **Auth / RBAC** | Capabilities catalog, per-grant overrides, super-admin hardcode for now | Shipped scaffold, RLS off |
| **Construction** | Projects, phases, budget, expenses, subs (G702/G703), loans, draws, COs, inspections, permits, SWPPP, project files + photos | Phase 6 shipped |
| **Files / Required Docs** | Property + subcontractor checklists driven by 55 templates, slot auto-gen on insert, signed-URL document store | Phase 6 shipped |
| **Field Log** | Mobile capture, untagged inbox, batch tagging, route-to-task (with AI rewrite) or route-to-document | Phase 6 shipped |
| **Photo Reports** | Date-range PDF export with cover page + chronological grid, brand-aware header (Casitas vs DuraCo) | Phase 6 shipped |
| **Unit Inspections** | Sam's post-checkout workflow on `/inspections/[id]`, Judson's review queue at `/inspections/review`, finding line items with photos, promotion to `pending_charges` / `pending_insurance_claims` | Phase 7a shipped |
| **Parallel Cleaning** | Per-unit time-tracking on `schedule_units` (start/pause/resume/complete), `cleaning_pause_windows` for elapsed-time math, field-log unit picker pins active jobs | Phase 7b shipped |

The audit also found ~24 sidebar nav entries that 404 (mostly `/short-term/*` and `/long-term/*` placeholders) and a couple of API routes referenced from UI that don't exist (`/api/leases`, `/api/tenants`). Tracked under "Open questions."

---

## Repo & deployment map

| Layer | Repo | Hosted | URL |
|---|---|---|---|
| **Server / agent brain** | `JagerPropertiesLLC/CasitasEnPueblo-Agent` | Railway (project: `aware-embrace`, service: `CasitasEnPueblo-Agent`) | `casitasenpueblo-agent-production.up.railway.app` |
| **Ops frontend** | `JagerPropertiesLLC/Guestos-ops` | Vercel | `guestos-ops.vercel.app` |
| **Database + Storage** | n/a (Supabase project: JagerPropertiesLLC's Project) | Supabase (us-east-2, Ohio) | `wlopfprejttqpdyqntrr.supabase.co` |

Local paths (Windows machine):
- `C:\Users\jjager\Desktop\CasitasEnPueblo-Agent` — server (also has its own `CLAUDE.md` with architecture detail; read it before changing the agent)
- `C:\Users\jjager\Desktop\Guestos-ops` — frontend

Auto-deploys: Railway and Vercel both auto-deploy from `main` on push. Vercel env var changes require manual redeploy from Deployments tab. **Important:** ignore the Railway project `faithful-strength`. The live one is `aware-embrace`. There's a second Supabase project `ACC-CRM-DEV` (us-west-1) — unrelated, belongs to Asphalt Coatings; do not touch.

---

## Planning docs / Pointers

- **`LTR_ROADMAP.md`** (root of `Guestos-ops`) — Phase 8–16 sequencing for the LTR module, plus Colorado 2024–2026 compliance reference (PTSR, for-cause eviction, security-deposit overhaul) and vendor research. Read before doing any LTR work.
- **`project_pending_schema_cleanups.md`** (root of `Guestos-ops`) — deferred construction-module schema cleanups (CHECK constraints, `updated_at` columns, `co_number` race-safety, denormalized field cleanup). Bundle in one cleanup migration when picked up.
- **`CasitasEnPueblo-Agent/CLAUDE.md`** — Railway server architecture detail; read before changing the agent.

---

## STR side — State

### Properties

| Property | Entity | Units | WiFi | Notes |
|---|---|---|---|---|
| **904 E 5th St** | Casitas en Pueblo LLC | APT 1–5 (5) | Pueblo Casitas / 904Casitas | Stripe active |
| **403 W 13th St** | Bear River Assets LLC | APT 101–104, 201–204 (8) | Netgear78 / redmango345 | Building code 7829#; Stripe active |
| **1609 E Orman Ave** | SoCO Development Group LLC | 1 | Ormanbnb / Password123! | Stripe active |
| **325 Washington St** | Delaware Crossing LLC | 1 | Washington_Casita / Casitas1232 | Stripe active |
| **1930 Acero Ave** | AA Pueblo LLC | 1 | Acero_Casitas / Pueblo4123 | Stripe pending; Zelle judjager@gmail.com; **not in Hostaway yet** |

Universal rules: check-in 4 PM, checkout 11 AM, all Schlage Encode locks, $30 early check-in fee before 2 PM, free 3 PM only as pushback negotiation.

### What's working
- **GuestOS** (Hostaway + Quo SMS → Claude → reply) running on Railway with 14 training rules baked into the prompt
- **Cleaning schedule** built nightly at 7 PM Mountain Time, Sam gets SMS at 7 PM and 7:30 AM day-of
- **Approvals** persist to Supabase (replaced in-memory Map; survive restarts)
- **Schedule UI** at `/schedule` with timezone bug fixed
- **524 guests / 2,170 messages** backfilled from Hostaway + Quo (April 27)
- **AI drafts** logged for training (`ai_drafts`, 262 rows)
- **Maintenance task system** at `/tasks`, `/tasks/new`, `/tasks/[id]` (photo upload, AI rewrite via Railway `/tasks/rewrite`, completion-photo gate)
- **Dream team** roster (`dream_team`, 6 rows): Darcee, Jaime, JWV, Judson Jager, Sam, Wendy

### Still TODO
- Flip `TEST_MODE` to false (currently `true` on Railway)
- Resume training session — 5 of 184 AI drafts reviewed
- Schedule UI "completed today" view (currently shows latest push only)
- Acero Hostaway integration + Zelle setup for Washington/Orman
- `listings` backfill with Hostaway IDs (`LISTING_ID_MAP` in `server.js`)
- Quo calls — 69 of ~180 captured, 111 recoverable from business-number cleanup
- Main guest line not yet pulled from OpenPhone

---

## LTR side — State

**Schema is in, app is essentially not built.** May 4 audit (`LTR_ROADMAP.md`) confirmed: **14 LTR-domain tables + `comms_thread_participants`** (tenants, leases, lease_tenants, lease_rent_changes, security_deposits, tenant_invoices, tenant_payments, tenant_documents, tenant_screening, tenant_portal_users, tenant_favors, rent_reminder_log, comms_threads, comms_messages, comms_thread_participants), **5 RLS-ready views** (`comms_thread_inbox`, `rent_reminders_due_today`, `tenant_payments_effective`, `tenant_visible_lease`, `tenant_visible_property`), **8 helper functions** (`current_app_user_id`, `current_tenant_id`, `current_tenant_portal_user_id`, `bump_comms_thread_on_message`, `mark_comms_thread_read`, `tenant_can_see_property`, `tenant_has_lease`, `tenant_payments_status_from_amount`), and **2 active triggers**. Every LTR table is **0 rows** — no real tenants yet, so no schema/data drift risk.

**Frontend:** 3 pages exist — `/long-term` (lists LTR properties; just Kalamath today), `/long-term/leases` (Tenants & Leases tabs but stub — calls 404 `/api/leases` + `/api/tenants` and renders empty), `/long-term/properties/[id]` (shared `PropertyDetail` wrapper). 9 of 10 sidebar items 404. **Zero LTR-specific API routes implemented.** Tenant portal guard exists in `AppShell` but no page files.

**Phase 8 onward is sequenced in `LTR_ROADMAP.md`** — also captures the 2026 Colorado compliance constraints (PTSR acceptance HB23-1099/HB25-1236, for-cause eviction HB24-1098, security-deposit overhaul HB25-1249) that need to land in the schema/UI before any tenant data goes in.

Property tax and insurance UIs are shipped but live at the cross-module roots (`/property-tax`, `/insurance`), not under `/long-term/*`.

---

## Marina / commercial side — State

Schema built for slip/RV/container rentals plus annual launch passes and the bulk daily launch log. CAM reconciliation tables (`cam_reconciliations`, `cam_reconciliation_line_items`, `property_cam_monthly_totals`) sit alongside; `properties.is_cam_property` and `properties.total_rentable_sf` are already there. `leases.marina_unit_id` exists for slip leases (mutually exclusive with `unit_id`).

No UI, no API, no nav entry. `marina_unit_types` is the only table with seeded rows (12 — slug catalog).

---

## Maintenance task system — State (shipped)

Two flavors coexist and need eventual reconciliation:
- **`/tasks`** — STR-original flow over the unified `tasks` table. Photo upload to `task-photos` Storage bucket, Railway `/tasks/rewrite` for Claude-vision text cleanup ("flix gutter pipe" → polished version, side-by-side approval). Completion photo required. Sam's view rolls into her schedule page.
- **`/maintenance`** — kanban (New / Acknowledged / Assigned / In progress / Completed) over `maintenance_requests`. Filterable by module (`str` / `ltr` / `construction`).

`/scheduler` is a 14-day staff grid built on `task_assignments` + `staff_availability`. `/api/scheduler/auto-fill` handles auto-assignment of recurring `target_tasks`.

---

## Construction module — State (Phases 1–6 shipped)

Lives at `/construction` and `/construction/[id]`.

**Projects in production:**
- **West Center Tech** — warehouse development, 201 N Laredo St, Aurora, CO 80011. **The project that started the construction module** — needing SWPPP for the warehouse kicked off the entire build (SWPPP → inspections → subcontracts → draws → lien waivers → tasks → change orders).
- **Kalamath / La Maison Moderne** — Judson's personal home reno, 917 N Kalamath St, Denver, CO — project ID `a3137184-7589-4f42-bdb8-159da24319e6`. Same module.

### Phases shipped

| Phase | What shipped |
|---|---|
| **1** | Projects, lookups (entities/markets), project header with `counts` shape |
| **2** | Budget categories, phases, expenses |
| **3** | Subcontracts (AIA G702/G703 line items), loans, draws |
| **4** | SWPPP — projects, inspections, BMPs, signature image, PDF export, weather-driven SMS workflow |
| **5** *(May 3)* | Tasks, change orders, construction inspections, SwpppTab inline section, DELETE retrofit (sub w/ deps → 409 with combined `draws + change_orders` count), `open_inspections` added to counts shape |
| **6** *(May 4)* | Documents extension (sections/subsections, slot link, signed-URL store), required-doc templates + auto-gen slots for properties + sub companies, field-log capture/inbox/route, ContactPicker + CompanyPicker components, company + contact detail pages with linked records, project Documents + Photos sections (replacing the stub), photo report PDF generator |

**Project page sections (9 total):** Overview · Subcontractors · Inspections · Permits · SWPPP · Change Orders · Draws & Lien Waivers · Documents · Photos. All wired as of Phase 6.

**`counts` shape on project header:** `open_tasks`, `pending_change_orders`, `subcontracts`, `open_inspections`.

### Construction tables (correct names — yesterday's CONTEXT had these wrong)

Tables are **not prefixed `construction_`**. Real names: `projects`, `project_phases`, `project_budget_categories`, `project_expenses`, `project_loans`, `project_draws`, `project_reports`, `project_contacts`, `subcontracts`, `subcontract_line_items`, `change_orders`, `inspections`, `permits`, `licenses`. **Tasks live in the unified `tasks` table** with `project_id`/`phase_id`/`subcontract_id` columns — STR maintenance and construction tasks share one table.

The Rolodex pieces are already wired in: `subcontracts.company_id` + `.contact_id`, `inspections.inspector_company_id` + `.inspector_contact_id`, `coi_records.company_id` + `.document_id`, `project_expenses.vendor_company_id` + `.vendor_contact_id`. **Phase 6 should build on top of this, not replace it.**

Views: `project_financials` (`total_spent = expenses_paid + draws_paid`, replaces deprecated column), `project_loan_status` (live drawn-to-date / available balance per loan).

### Deferred construction items (in `project_pending_schema_cleanups.md`)

CHECK constraints + `updated_at` columns on `subcontracts`, `subcontract_line_items`, `project_draws`, `change_orders`, `inspections`, `tasks`. Drop the denormalized `subcontracts.amount_paid` / `.amount_retained` once we're sure nothing reads them. `co_number` race-safety. Real per-caller `tasks.org_id` resolution before second tenant. Bundle in one cleanup migration.

### Phase 6 — what shipped

- **`documents` extended** with `org_id`, `description`, `mime_type`, `file_size_bytes`, `section`, `subsection`, `storage_bucket`, `storage_path`, `updated_at`, `required_doc_slot_id`. Existing FK consumers (`coi_records.document_id`, `licenses.document_id`, etc.) untouched.
- **`required_doc_templates`** seeded with 55 rows: 27 STR-property, 23 LTR-property, 5 subcontractor-company. CHECK constraint on `entity_type` keeps the seed honest.
- **`required_doc_slots`** auto-generated via `AFTER INSERT` triggers on `properties` (per `property_type[]` tag) and `companies` (when `type='sub'`, including UPDATE → `'sub'` flips). Backfilled the 6 existing properties (5 × 27 STR + 1 × 23 LTR = 158 slots).
- **`field_log_photos`** with resolved-status lifecycle (`untagged` → `tagged` → `routed`), GPS columns, and FKs to the routed task or document.
- **`tasks.source text`** added; field-log-routed issue tasks get `source='field_log'`.
- **Storage buckets** `platform-files` (private, all documents) and `field-log` (private, raw captures) created. `task-photos` (existing public bucket) keeps its role for STR maintenance + field-log issue routing.
- **Convention pinned:** `companies.type='sub'` triggers subcontractor required-docs (matches existing UI vocab in `app/contacts/page.js`).

### Phase 6 — endpoints + UI

- `/api/documents` (GET list with parent shorthand filters; POST multipart upload with optional `fulfills_slot_id`); `/api/documents/[id]` (GET signed URL, PATCH metadata, DELETE with bucket cleanup + slot reset).
- `/api/properties/[id]` (metadata + units), `/api/properties/[id]/required-docs`, `/api/companies/[id]/required-docs`, `/api/required-doc-slots/[id]` (PATCH for `not_applicable`/`required`).
- `/api/companies/[id]/linked` and `/api/contacts/[id]/linked` for the Linked Records tabs. `DELETE` on `/api/companies/[id]` and `/api/contacts/[id]` retrofitted with 409 + dependency breakdown via `lib/rolodexDeps.js`.
- `/api/field-log/capture`, `/api/field-log/inbox`, `/api/field-log/photos/[id]` (PATCH), `/api/field-log/photos/[id]/route` (POST), `/api/field-log/batch-tag`.
- `/api/photo-reports/generate` — PDF via `lib/photoReportPdf.js` (cover + 2×3 grid per page), uploaded to `platform-files`, also stored as a `documents` row in `subsection='reports'` so it shows up in the All Files tab.
- New UI: `/short-term/properties/[id]` and `/long-term/properties/[id]` (shared `components/property/PropertyDetail.js` with Required Documents | All Files | Site Visits tabs), `/companies/[id]`, `/contacts/[id]`, `/field-log`, `/field-log/capture`, `/field-log/inbox`. Construction project page now renders `ProjectFilesSection` and `ProjectPhotosSection` instead of the old "Files & contacts" stub.
- `ContactPicker` and `CompanyPicker` components added (typeahead + create-new inline). Existing `VendorPicker` in construction modals already covered the company side, so it stays — the new components are reused on the new detail pages and available for future modals.

### Phase 6 — deferred / not done

- Did **not** retrofit `VendorPicker` calls in construction modals to swap in the new `CompanyPicker`. The existing wiring works; not worth the risk this phase.
- Did **not** add a contact-side picker to Subcontract / Inspection / CO modals. Those modals only deal with `company_id`; adding `contact_id` UI is future polish.
- Did **not** wire the `/short-term/properties` or `/long-term/properties` index routes — sidebar still links to those (and to the unbuilt routes listed in "Open questions"). Property cards on `/short-term` and `/long-term` already work as a workaround.

---

## Inspections & parallel cleaning — State (Phase 7 just shipped May 4)

STR-side workflows that live next to (not inside) the construction module. Heads up: `unit_inspections` is distinct from construction's `inspections` — different table, different scope.

### Phase 7a — what shipped (post-checkout inspections)

- **`unit_inspections`** — Sam logs damage findings post-checkout, stamped with `unit_id`, `property_id`, `reservation_id` (best-effort lookup of latest non-cancelled departure ≤ today), `schedule_unit_id` (links back to the cleaning task), `inspected_by`, `started_at`/`completed_at`, status (`in_progress|submitted|reviewed|closed`), `damage_summary`, `review_notes`, `reviewed_by`/`reviewed_at`. Distinct from construction `inspections` (project-scoped).
- **`inspection_findings`** — line items per inspection: `finding_type` (damage/missing/extra_cleaning/other), severity, description, `estimated_cost_cents`, `charge_to` (guest/none/tbd), `claim_eligible`. Cascade-deletes with parent inspection.
- **`pending_charges`** — guest-billable charges proposed during review. Status flow: `pending → approved → collected | waived | disputed`. Linked to inspection + finding (SET NULL on delete).
- **`pending_insurance_claims`** — insurance claims proposed during review. Status: `pending → filed → denied | paid | dropped` plus `claim_number`, `filed_by`/`filed_at`, `resolution_amount_cents`.
- **Photos** attach polymorphically via `documents.parent_type IN ('unit_inspection','inspection_finding')` — no parallel photos table. Documents API allowlist extended for both new parent types.
- **Endpoints:** `/api/inspections/units` (GET list, POST create with `schedule_unit_id` resolver: property `short_name` + unit_label fuzzy match), `/api/inspections/units/[id]` (GET full detail with findings + photos, PATCH for status/notes/summary, DELETE), `/api/inspections/units/[id]/promote` (Judson promotes selected findings to charges/claims and flips inspection to reviewed/closed), `/api/inspections/findings` + `/[id]` (CRUD), `/api/inspections/review-queue` (submitted-only by default, `?include_in_progress=1` to peek at drafts).
- **UI:** `/inspections/[id]` (Sam's mobile workspace — finding cards, per-finding photo capture, damage summary, submit-for-review button); `/inspections/review` (Judson's queue with finding-summary chips); `/inspections/review/[id]` (per-finding action grid: skip/charge/claim/both, with editable amount fields). `Start Post-Checkout Inspection` button added inside the expanded UnitCard on `/schedule`. `Inspections` tab added to `PropertyDetail`.

### Phase 7b — what shipped (parallel-unit cleaning)

- **`schedule_units`** extended additively (existing nightly Railway scheduler keeps working unchanged): `unit_id` (nullable FK to `units`, populated by future schedule builds), `reservation_id` (nullable), `started_at`, `stopped_at`, `cleaner_id` (FK to `app_users`), `unit_status text NOT NULL DEFAULT 'idle' CHECK IN (idle|cleaning|paused|complete)`. The new `unit_status` is distinct from the existing `status` (pending|in_progress|done|issue) — `status` remains Sam's manual override surface; `unit_status` is the time-tracked state machine.
- **`cleaning_pause_windows`** — open/close pairs (`paused_at`, `resumed_at`) per `schedule_unit_id` for accurate elapsed-time math (working time excludes pauses).
- **Endpoints:** `/api/cleaning/units/[id]/start` (stamps `started_at` + `cleaner_id`, idempotent), `/pause` (closes any stray open windows then opens a new one with optional `reason`), `/resume` (closes open window, flips back to cleaning), `/complete` (closes window, stamps `stopped_at`, returns `elapsed_seconds` excluding pauses, also flips legacy `status='done'`); `/api/cleaning/active-units?date=YYYY-MM-DD` (defaults today, lists `cleaning|paused`).
- **UI:** `/schedule` UnitCard gets Start / Pause / Resume / Complete buttons keyed off `unit_status`, plus a live elapsed-time counter (client-side ticks every 1s). Multiple units can be in flight simultaneously across different cleaners. Field-log `TargetPicker` adds a "Cleaning now" section pinned above Recent — picking one pre-fills `unit_id` on the next photo's tags.

---

## SWPPP sub-module — State (complete)

Per-project config in `swppp_projects` (1 active — West Center Tech). Hourly weather poll → `swppp_weather_readings` (155 rows). Rolling 24h rain ≥ project threshold creates a `swppp_weather_events` row triggering the 24-hour inspection clock. Mon 7 AM weekly report compiler PDFs the prior 7 days into Storage. SMS workflow on Railway (`backend/swppp-sms.js`) fires the weekly inspection SMS at a deterministic-but-random minute Mon 7–9 AM MT; replies POST to `/api/swppp/inspections/auto-create` which builds the inspection record + signed PDF.

Public-facing routes: `/swppp/inspect/[swpppId]` (smart form), `/swppp/qr/[swpppId]` (QR for the inspector), `/swppp/public/[token]` (auditor view, AppShell chrome stripped).

**Cron duplication caveat:** the hourly weather check + Monday weekly report exist in both Vercel `/api/cron/*` and Railway `swppp-cron.js`. Pick one canonical home before changing either.

---

## Database

Supabase Postgres 17 (us-east-2). RLS **disabled** platform-wide — must be enabled with proper policies before non-admin users get access.

88 tables, 10 views. The full inventory was audited May 4 and lives in chat history; the audit found the platform is significantly broader than the May-3 doc described (Marina, CAM, Tenant Portal, full Insurance/Compliance, full LTR scaffolding all in the schema). Module-by-module summaries are in the State sections above.

**Storage buckets in use:** `task-photos` (public — maintenance task issue + completion photos, also field-log routed-to-task copies), `platform-files` (private — all `documents` rows from Phase 6 onward), `field-log` (private — raw field-log captures pre-routing), plus paths embedded in `swppp_photos.storage_path` and `swppp_reports.storage_path`.

**Verified column names (don't guess these):** `properties.short_name`, `properties.full_address`, `units.unit_label`. `dream_team.display_name` UNIQUE.

**Multi-tenant scaffolding is in place but only one org row exists.** `DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'` is stamped on every Railway-side write. Phase-5 construction APIs use a singleton lookup of the one organization row; refactor to a real per-caller resolver before standing up tenant #2.

---

## Auth / RBAC

Capability-based model. `app_users` (7 staff/owners) auth-link to Supabase Auth. `entities` (8 LLCs) own `entity_stakeholders` (8 stake records). `user_access_grants` (7 active) issue per-(user, market, entity, property, module) role grants; `user_capabilities` overrides them per grant. `capabilities` (78) is the catalog.

Resolution lives in `lib/permissions.js`: `currentUserId()` is currently hardcoded to look up `judson@duracoproperties.com` (super_admin). Once Supabase Auth is wired into the frontend, swap with the real session lookup. `canUserDo(...)` calls Postgres `user_has_capability(...)`.

UI: `/settings`, `/settings/users/[id]`, `/settings/properties/[id]`. API under `/api/admin/*`.

---

## Environment variables

### Railway (CasitasEnPueblo-Agent service)
`ANTHROPIC_API_KEY`, `HOSTAWAY_ACCOUNT_ID=81734`, `HOSTAWAY_API_KEY`, `QUO_API_KEY`, `QUO_WEBHOOK_SECRET`, `QUO_BUSINESS_PHONE_ID`, `SAM_PHONE_NUMBER`, `OWNER_PHONE_NUMBER`, `STRIPE_PAYMENT_LINK`, `OPS_APP_URL=https://guestos-ops.vercel.app`, `SCHEDULE_API_SECRET=guestos_schedule_2026`, `SUPABASE_URL=https://wlopfprejttqpdyqntrr.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY` (new `sb_secret_...`), `OPENWEATHER_API_KEY` (SWPPP), `RAILWAY_SHARED_SECRET` (must match Vercel), **`TEST_MODE=true`**.

### Vercel (guestos-ops)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (new `sb_publishable_...`), `SCHEDULE_API_SECRET=guestos_schedule_2026`, `ANTHROPIC_API_KEY` (for `/tasks/rewrite` proxy and any future Claude calls), `RAILWAY_SHARED_SECRET` (must match Railway), `CRON_SECRET` (Vercel cron auth).

**Important:** legacy Supabase API keys are **disabled** (migrated April 26). Do NOT re-enable — the old `service_role` was exposed in chat.

---

## Endpoints

### Server (Railway)
`GET /debug` · `GET /env-check` · `GET /test-schedule` · `GET /test-morning` · `GET /schedule-status` · `GET /health` · `GET /approvals` · `POST /approvals/:id/approve` · `POST /approvals/:id/dismiss` · `POST /webhook/hostaway` · `POST /webhook/quo` · `POST /tasks/rewrite`. In-process crons handle the cleaning-schedule push (7 PM eve, 7:30 AM morn MT) and SWPPP (hourly weather, Mon 7 AM weekly report, Mon-window inspection SMS).

### Frontend (Vercel)
Shipped pages: `/dashboard` · `/short-term` · `/long-term` · `/long-term/leases` · `/construction` · `/construction/[id]` · `/construction/[id]/subcontracts/[subId]` · `/construction/[id]/loans/[loanId]` · `/contacts` · `/maintenance` · `/scheduler` · `/schedule` · `/tasks` · `/tasks/new` · `/tasks/[id]` · `/team` · `/team/new` · `/team/[id]` · `/insurance` · `/property-tax` · `/reports` · `/settings` · `/settings/users/[id]` · `/settings/properties/[id]` · `/swppp/inspect/[swpppId]` · `/swppp/qr/[swpppId]` · `/swppp/public/[token]`.

Stub pages (StubPage component): `/calendar`, `/inbox`, `/short-term/calendar`, `/short-term/inbox/messages`, `/short-term/inbox/approvals`.

API routes under `/api/construction/projects/[id]/*` (canonical), plus older un-namespaced `/api/projects`, `/api/subcontracts`, `/api/inspections`, `/api/companies`, `/api/contacts` (cleanup candidate). SWPPP under `/api/swppp/*`. Cross-module: `/api/dashboard`, `/api/dashboard-finance`, `/api/sidebar-nav`, `/api/insurance`, `/api/insurance-grid`, `/api/coi-renewal-request`, `/api/maintenance`, `/api/scheduler`, `/api/target-tasks`, `/api/property-tax`, `/api/users`, `/api/schedule` (POST from Railway w/ bearer). Crons: `/api/cron/weather-check`, `/api/cron/weekly-reports`. Admin: `/api/admin/*`.

---

## Decisions log

- **Apr 26** — Migrated Supabase to new key system. Old keys disabled. Anthropic key rotated.
- **Apr 26** — Approvals moved to DB (was in-memory Map). `replyFn` closures cached, reconstructed from `source + external_conv_id` after restart.
- **Apr 27** — 14 training rules baked into system prompt. Database state preserved before pause.
- **Apr 28** — Build construction as separate **module** in same platform (not separate system, not crammed into STR tables). Reason: shared core (org, payments, contacts), but data model and UI genuinely different.
- **Apr 28** — Maintenance task photos → Supabase Storage `task-photos` bucket. AI rewrite shows side-by-side, user approves. Completion photo required.
- **Apr 28** — Dream team uses `display_name` UNIQUE constraint. Roster locked: Darcee, Jaime, JWV, Judson Jager, Sam, Wendy.
- **May 3** — Phase 5 design decisions: `org_id` singleton lookup deferred (refactor later when 2nd org), SwpppTab inline (not detail page), `open_inspections` added to header counts shape.
- **May 4** — CONTEXT.md rewritten after audit found ~6 weeks of drift (full LTR / Marina / CAM / Tenant Portal / Insurance / Property Tax / Maintenance / Scheduler infrastructure built without documenting). Construction tables confirmed unprefixed (`projects` not `construction_projects`; tasks unified). Phase 6 paused pending corrected build prompt that uses existing `documents` + `contacts`/`companies` tables instead of inventing parallels.
- **May 4** — Phase 6 design decisions: extend `documents` rather than create parallel `files` (preserves 14+ upstream FKs); subcontractor required-docs live on `companies` (which already has `w9_on_file`/`coi_on_file`/`coi_expires`); `companies.type='sub'` is the slug that triggers slot auto-gen (matches existing UI convention); slot generation runs via Postgres `AFTER INSERT` triggers (bulletproof against direct Supabase Studio inserts); field-log issue routing copies photos to the existing public `task-photos` bucket so `/tasks/rewrite` vision Claude can read them via URL; photo report PDF uses text headers only this phase (no logo upload).
- **May 4** — Phase 7 design decisions: post-checkout inspections live in their own `unit_inspections` table (not reused construction `inspections`); finding photos attach polymorphically via `documents.parent_type` rather than a parallel photos table; `pending_charges` and `pending_insurance_claims` are separate destinations from `/promote` so the workflows can diverge without schema churn. Phase 7b extends `schedule_units` additively so the existing nightly Railway scheduler keeps working unchanged; new `unit_status` is distinct from existing `status` (Sam's manual override stays).
- **May 4** — Push discipline locked in: feature branch → PR → merge on **both** repos. `Guestos-ops` enforces via GitHub branch protection; `CasitasEnPueblo-Agent` is convention-only (private repo, Free plan, no enforcement available). `deploy.bat` on both repos has a guard that aborts on `main`.
- **May 4** — LTR audit pass (`LTR_ROADMAP.md`) before any Phase 8 code: confirmed schema is comprehensive (14 tables + 5 views + 8 fns + 2 triggers, all empty), confirmed zero LTR-specific API routes exist, mapped Colorado 2024–2026 compliance constraints (PTSR / HB24-1098 for-cause / HB25-1249 deposits) into design constraints. Multi-owner story will reuse existing `entities` table rather than introduce a parallel `ownership_entities`.

---

## In flight

Nothing actively building. Phase 7a + 7b just shipped (May 4). Manual smoke test still skipped — known risk if anything Phase 7 broke is inherited by Phase 8.

**Phase 8 queued — LTR core records.** Scope: stand up minimal `/api/leases` + `/api/tenants` (the endpoints `/long-term/leases` already calls), verify multi-owner story by wiring `properties.entity_id` rollups into LTR reporting, add move-in / move-out inspection capture (HB25-1249 walk-through-inspection foundation). Sequenced in `LTR_ROADMAP.md`.

**Three gating questions still open before Phase 8 starts:**
1. **Multi-owner story** — will third-party owners (not Judson's LLCs) ever live on this platform? If yes, Phase 8 needs an explicit owner-vs-property-manager separation; if no, `entities` is enough and we can keep the model simple.
2. **Judson's dad's QuickBooks version** — Desktop vs Online dictates the export format for Phase 14 accounting; impacts data shape decisions earlier (which fields we capture vs derive).
3. **PTSR opt-in/opt-out** — does Casitas/DuraCo accept tenant-supplied portable screening reports (HB23-1099/HB25-1236)? Default is "must accept" for residential; opting out (where legal) changes the Phase 12 screening flow significantly.

---

## Open questions / Next up

### Immediate
- **Manual click-through of Phase 6 in prod** — pick a property, upload a doc to a required slot, mark another N/A, capture a field-log photo on a phone, route it to a task and to a document, generate a photo report, delete a doc and confirm the slot resets. Do this on both West Center Tech and Kalamath (project-side) plus one STR property.
- **Manual click-through of Phase 7a/7b in prod** — start a cleaning from `/schedule` (verify timer ticks, pause/resume bookkeeping is right), open a Post-Checkout Inspection from the same card, add a finding with a photo, submit, then on `/inspections/review/[id]` promote it to a pending charge with a custom dollar amount and confirm the row appears in `pending_charges`. Verify the field-log target picker pins the active unit when a cleaning is in progress.
- **Schedule build hardening** — Phase 7b adds nullable `schedule_units.unit_id` + `reservation_id`. Update the Railway nightly schedule build (`casitasenpueblo-agent`) to populate them so the inspection auto-resolver doesn't have to fall back to `short_name`/`unit_label` text matching.
- **Pending charges / claims dashboards** — tables exist + are populated by `/promote`, but no UI to view/work the queue yet. Likely Phase 8 work.
- Trim or build the ~24 dead sidebar nav links — they 404 silently right now.
- Decide canonical SWPPP cron home (Vercel `/api/cron/*` vs Railway `swppp-cron.js`) and remove the duplicate.
- Build `/api/leases` + `/api/tenants` (the minimal endpoints `/long-term/leases` is already calling).

### STR side (medium priority)
- Resume training session (5 of 184 AI drafts reviewed)
- Schedule UI "completed today" view
- Acero Hostaway integration + Zelle setup for Washington/Orman
- Listings table backfill

### Eventually
- Flip `TEST_MODE` → false (after training session lands)
- Build channel manager (direct sync Airbnb/VRBO/Booking.com)
- LTR module fleshed out — first real tenant, rent-roll, aged receivables, tenant portal, comms wiring
- Marina / CAM UI build-out
- Mobile app for Sam and field staff
- Real Supabase Auth wired in, replace `HARDCODED_SUPER_ADMIN_EMAIL` in `lib/permissions.js`
- Enable RLS with capability-based policies

---

## Working style (Judson)

- Full file rewrites > inline edits
- One step at a time (multi-step instructions are overwhelming)
- Hands-off execution — Claude does the work, Judson copy/pastes/runs
- Plain unformatted text in chat (formatted code blocks are hard to copy on his setup)
- Terminal + git for deployments
- Verify existing schema before writing SQL that depends on it (don't guess column names)
- When CONTEXT.md is wrong, fix it in the same chat — don't ship work on top of stale context

### Guest communication tone
- Casual & warm: "Hey [name]", "No sweat!", "My pleasure!"
- Emojis sparingly (😊 🙏)
- Sign off: "Judson" or "Your Pueblo Hosting Team"
- Spanish with Spanish-speaking guests
- **Never says:** "Sound good?", "I apologize for any inconvenience", "per our policy"
- Free 3 PM check-in only as pushback negotiation
- Sam contacted only when her input is needed
