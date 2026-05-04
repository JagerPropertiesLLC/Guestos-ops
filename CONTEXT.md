# Casitas En Pueblo / DuraCo Properties — Platform context

**Owner:** Judson Jager (judson@duracoproperties.com)
**Last updated:** May 4, 2026 (full audit rewrite — replaces the partial May 3 snapshot)

---

## How to use this file

Single source of truth for every Claude session working on this platform. **Read it before doing anything.** Both this Claude project and any Claude Code session should orient from this file first.

**Update rhythm:**
- The chat that ships work also updates the relevant section ("State" or "In flight") and commits the change as part of the same commit.
- Strategic decisions go in "Decisions log" so we don't re-litigate them in future sessions.
- "Open questions / Next up" is the queue for whatever's coming.

**When you find drift between this doc and the real codebase, fix this doc as part of the same chat.** That's how we got into a 6-week stale CONTEXT.md the last time around.

**Role separation across sessions:**
- **Strategic chat (Claude project, this file's home)** — planning, screenshot review, direction, updating this doc. Doesn't write production code.
- **Claude Code sessions** — execution. Builds what's in "In flight." Updates "State" when shipping.
- **One-off side chats** — try not to. If used, they don't touch this doc.

**Audit verification:** the inventory in the "State" sections below was generated May 4, 2026 by reading every table in Supabase, every API route in both repos, every page.js in Guestos-ops, and the AppShell sidebar. Numbers in parentheses on table names are row counts at audit time.

---

## What we're building

A property + construction management platform with multiple shipped or in-progress modules:

- **STR (Short-term rentals)** — 5 properties / 16 units in Pueblo, CO. Live in `TEST_MODE`. The original module.
- **LTR (Long-term tenants)** — schema fully built, UI mostly stubbed. Includes a tenant portal scaffold.
- **Construction project management** — fully built (5 phases shipped). Two live projects.
- **SWPPP** — full sub-module: inspections, BMPs, weather-driven SMS workflow, public report viewer.
- **Marina / RV / commercial** — schema built (slips, addons, launch passes, CAM reconciliation), no UI yet.
- **Insurance & compliance** — policies + COIs UI shipped; coverage matrix grid view.
- **Maintenance** — generic kanban board for `maintenance_requests` (LTR + STR + construction).
- **Tasks + Scheduler** — unified `tasks` table (STR maintenance + construction tasks); `task_assignments` + `staff_availability` drive the 14-day scheduler view.
- **GuestOS Agent** — Hostaway + Quo SMS → Claude → reply, with approvals queue. Lives in the Railway repo.
- **Admin / RBAC** — users, entities, properties, capability-based permissions, working super-admin override.

Eventually replaces Hostaway as its own channel manager (direct sync to Airbnb / VRBO / Booking.com).

Web today. Mobile app eventually. Multi-org capable, currently single-org.

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

Auto-deploys: Railway and Vercel both auto-deploy from `main` on push. Vercel env var changes require manual redeploy from Deployments tab.

**Important:** ignore the Railway project `faithful-strength`. The live one is `aware-embrace`.

There is a second Supabase project `ACC-CRM-DEV` (`hhhismqeqrwmymjvuhzt`, us-west-1) — **unrelated**, belongs to Asphalt Coatings. Do not touch.

---

## STR — State (live, in TEST_MODE)

**Properties (5 STR + 1 LTR + room for marina = 6 total `properties` rows):**

| Property | Entity | Units | WiFi | Notes |
|---|---|---|---|---|
| 904 E 5th St | Casitas en Pueblo LLC | APT 1–5 (5) | Pueblo Casitas / 904Casitas | Stripe active |
| 403 W 13th St | Bear River Assets LLC | APT 101–104, 201–204 (8) | Netgear78 / redmango345 | Building code 7829#; Stripe active |
| 1609 E Orman Ave | SoCO Development Group LLC | 1 | Ormanbnb / Password123! | Stripe active |
| 325 Washington St | Delaware Crossing LLC | 1 | Washington_Casita / Casitas1232 | Stripe active |
| 1930 Acero Ave | AA Pueblo LLC | 1 | Acero_Casitas / Pueblo4123 | Stripe pending; Zelle judjager@gmail.com; **not in Hostaway yet** |

Universal STR rules: check-in 4 PM, checkout 11 AM, all Schlage Encode locks, $30 early check-in fee before 2 PM, free 3 PM only as pushback negotiation.

**What's working in production:**
- **GuestOS agent** (Hostaway + Quo SMS → Claude → reply) on Railway with 14 training rules baked into the prompt
- **Cleaning schedule** built nightly at 7 PM Mountain Time, Sam gets SMS at 7 PM and 7:30 AM day-of
- **Approvals** persist to Supabase (`approvals` table, currently 24 rows; survives restarts via `replyFnCache` reconstruction in `server.js`)
- **Schedule UI** at `/schedule` with timezone bug fixed
- **524 guests / 2,170 messages backfilled** from Hostaway + Quo (April 27)
- **AI drafts logged** — every Claude draft writes to `ai_drafts` (262 rows) for training review
- **Dream team** roster (`dream_team` table, 6 rows): Darcee, Jaime, JWV, Judson Jager, Sam, Wendy

**STR-specific tables (live):**
- `properties` (6) — also serves LTR + marina; STR-vs-LTR derived from entity slug today (Kalamath → LTR, all else → STR)
- `units` (16)
- `listings` (0) — channel listing IDs per unit; **Hostaway IDs not backfilled yet**
- `guests` (525) — includes blacklist/strikes/AI summary fields
- `conversations` (649), `messages` (2171)
- `reservations` (328)
- `approvals` (24), `ai_drafts` (262)
- `training_rules` (23) — baked into agent's system prompt
- `cleaning_schedules` (2), `schedule_units` (16)
- `cleaning_reports` (0), `cleaning_tag_options` (25)
- `damage_reports` (0)
- `guest_feedback` (0)
- `house_manuals` (0) — schema there, no content yet
- `payments` (0) — external payment records (Stripe etc.)

**Still TODO on STR:**
- Flip `TEST_MODE` to false on Railway (currently `true`)
- Resume training session — 5 of 184 AI drafts reviewed
- Schedule UI: "13 of 13 completed today" view (currently shows latest push only)
- Acero Hostaway listing setup
- Zelle for Washington and Orman
- `listings` backfill with Hostaway IDs (`LISTING_ID_MAP` in `server.js`)
- Quo calls — 69 of ~180 captured, 111 recoverable from business-number cleanup
- Main guest line not yet pulled from OpenPhone

---

## LTR — State (mostly schema, partial UI)

**Schema is fully built.** UI is partial — leases page is shipped but missing supporting APIs; per-property and per-tenant views are scaffolded only.

**Tables (all 0 rows; no live LTR tenants yet):**
- `tenants`, `leases`, `lease_tenants`, `lease_rent_changes`, `security_deposits`
- `tenant_invoices`, `tenant_payments`, `rent_reminder_log`
- `tenant_screening` (applicant pipeline), `tenant_documents`, `tenant_favors` (goodwill log)
- `tenant_portal_users` (auth scaffold for the tenant portal)
- `comms_threads`, `comms_thread_participants`, `comms_messages` — LTR-side messaging (separate from STR `conversations`/`messages`)

**Views:** `tenant_payments_effective`, `tenant_visible_lease`, `tenant_visible_property`, `rent_reminders_due_today`.

**Shipped LTR UI:**
- `/long-term` — lists LTR properties (currently just Kalamath via entity-slug check)
- `/long-term/leases` — Tenants & Leases dashboard with active/expiring/all tabs. **Calls `/api/leases` and `/api/tenants`, neither of which exist** — page handles 404 gracefully and shows empty state.

**Stubbed in sidebar but not built (will 404):** `/long-term/properties`, `/long-term/properties/[id]`, `/long-term/rent-roll`, `/long-term/aged-receivables`, `/long-term/maintenance`, `/long-term/vendors`, `/long-term/property-tax`, `/long-term/insurance`, `/long-term/utilities`, `/long-term/financials`.

**Property-tax module is shared LTR/STR** — `/property-tax` page + `/api/property-tax` is shipped against `property_taxes` table (0 rows).

**Utilities** (`utility_accounts`, `utility_bills`) — schema only, no UI.

---

## Marina / commercial — State (schema only, no UI)

Schema is built for slips/RV/container rentals (e.g. Lake Pueblo State Park-style) and CAM reconciliation for commercial leases.

**Tables:**
- `marina_units` (0), `marina_unit_types` (12 — slug catalog seeded: slip, RV, container, etc.)
- `marina_addons` (0) — per-lease addons (parking, shore power, water, pump-out)
- `marina_launch_log` (0) — daily/weekly launch totals (cash + Stripe split)
- `marina_launch_passes` (0) — annual passes
- `cam_reconciliations` + `cam_reconciliation_line_items` (annual CAM rollups, snapshot fields freeze at finalization)
- `property_cam_monthly_totals` (manual QBO entry — current source of truth for CAM pool)
- `property_expenses` — itemized opex, marked skeleton in table comment

`leases.marina_unit_id` exists for slip leases (mutually exclusive with `unit_id`).

`properties.is_cam_property` boolean + `properties.total_rentable_sf` exist.

**No UI yet.** No API routes. No nav entry. Schema-only.

---

## Construction module — State (Phase 5 shipped May 3)

Lives at `/construction` and `/construction/[id]` with deep nav for each project's subcontracts and loans.

**Live projects (`projects` table, 2 rows):**
- **West Center Tech** — warehouse development, 201 N Laredo St, Aurora, CO 80011. Started the construction module — needing SWPPP for the warehouse kicked off the build (SWPPP → inspections → subcontracts → draws → lien waivers → tasks → change orders, all the rest grew out from there).
- **La Maison Moderne (Kalamath)** — Judson's personal home reno, 917 N Kalamath St, Denver, CO. Project ID `a3137184-7589-4f42-bdb8-159da24319e6`.

**Phases shipped:**

| Phase | What shipped |
|---|---|
| 1 | Projects, lookups (entities/markets), project header with `counts` shape |
| 2 | Budget categories, phases, expenses |
| 3 | Subcontracts with AIA G702/G703 line items, loans, draws |
| 4 | SWPPP module — projects, inspections, BMPs, signature image, PDF export |
| 5 (May 3) | Tasks, change orders, construction inspections, SwpppTab inline section, DELETE retrofit (sub w/ deps → 409 with combined `draws + change_orders` count), `open_inspections` added to counts shape |

**Project page sections (9 total):** Overview · Subcontractors · Inspections · Permits · SWPPP · Change Orders · Draws & Lien Waivers · Documents · Photos. Documents and Photos are stubs (this is what Phase 6 fills in).

**`counts` shape on project header:** `open_tasks`, `pending_change_orders`, `subcontracts`, `open_inspections`.

**Construction tables:**
- `projects` (2) — **note: NOT prefixed `construction_`**. The May-3 CONTEXT.md described "construction_projects/construction_tasks/construction_inspections" — those names were aspirational. Actual table names are: `projects`, `project_phases`, `project_budget_categories`, `project_expenses`, `project_loans`, `project_draws`, `project_reports`, `project_contacts`, `subcontracts`, `subcontract_line_items`, `change_orders`, `inspections`, `permits`, `licenses`. **Tasks live in the unified `tasks` table** with `project_id`/`phase_id`/`subcontract_id` columns — STR maintenance and construction tasks share one table.
- `entities` (8) — owning LLCs
- `entity_stakeholders` (8) — who owns what % of which entity
- `markets` (2) — pueblo, aurora
- `companies` (0) — vendor/sub/lender/insurer companies (master entity for vendors)
- `contacts` (0) — people, FK to companies (the human at a vendor)
- `project_contacts` (0) — junction project↔contact/company with `role_on_project`

**Views:** `project_financials` (`total_spent = expenses_paid + draws_paid`, replaces deprecated column), `project_loan_status` (live drawn-to-date / available balance per loan).

**Cross-project reusable Rolodex pieces already in place:**
- `subcontracts` already has `company_id` + `contact_id`
- `inspections` already has `inspector_company_id` + `inspector_contact_id`
- `coi_records` already FKs to `companies` and stores expiration + `document_id`
- `project_expenses` already has `vendor_company_id` + `vendor_contact_id`

**Deferred construction items (in `project_pending_schema_cleanups.md`):**
- `subcontracts.status` CHECK constraint, drop denormalized `amount_paid`/`amount_retained` columns
- `subcontract_line_items` overbilling CHECK
- `project_draws.amount >= 0` CHECK, `lien_waiver_type` allowlist CHECK, missing `updated_at`, auto-clear `paid_date` on backward status moves
- `tasks.status` CHECK + `change_orders.status` CHECK + `change_orders.updated_at`
- `co_number` race-safety (unique constraint or sequence)
- `inspections.result` + `inspections.inspection_type` CHECK / reference table
- `tasks.org_id` real per-caller resolution before second tenant onboards
- Deprecated `projects.total_spent` column (now in `project_financials` view)

**Phase 6 (queued, but not yet greenlit):** Files + required-doc checklists + Rolodex pickers + field log + photo report PDF. **Phase 6 must adapt to the existing schema** — `documents` and `contacts`/`companies` tables already exist. See "Open questions" for the design call to make.

---

## SWPPP — State (sub-module, complete)

Built specifically for construction projects with NPDES/CDPS stormwater obligations. West Center Tech is the only active SWPPP project today.

**Tables:** `swppp_projects` (1), `swppp_inspections` (2), `swppp_bmps` (3), `swppp_bmp_findings` (6), `swppp_site_checks` (12), `swppp_site_check_findings` (23), `swppp_corrective_actions` (0), `swppp_inspection_sms` (0), `swppp_weather_readings` (155), `swppp_weather_events` (0), `swppp_reports` (1), `swppp_photos` (0).

**Pieces:**
- Hourly weather poll → `swppp_weather_readings`. Rolling 24h rain ≥ project threshold creates a `swppp_weather_events` row triggering an inspection-required clock.
  - Cron: `app/api/cron/weather-check/route.js` (Vercel) and a parallel `swppp-cron.js` on Railway (overlapping; one of them is the canonical one — verify before changing).
- Weekly report (every Monday 7 AM) compiles last 7 days of inspections + storm events into a PDF in Supabase Storage. Cron: `app/api/cron/weekly-reports/route.js` + `swppp-cron.js`.
- SMS workflow (Railway-side `backend/swppp-sms.js`): minute-by-minute scheduler fires the weekly inspection SMS at a deterministic-but-random minute Mon 7–9 AM MT. SMS replies POST to `/api/swppp/inspections/auto-create` which creates the inspection record + PDF + signature embed.
- Public-facing pages: `/swppp/inspect/[swpppId]` (smart form), `/swppp/qr/[swpppId]` (QR for the inspector to scan onsite), `/swppp/public/[token]` (auditor-facing report viewer; AppShell chrome is stripped on this route).

---

## Maintenance — State (shipped)

`/maintenance` is a kanban (New / Acknowledged / Assigned / In progress / Completed) over `maintenance_requests` (0 rows live). Filterable by module (`str` / `ltr` / `construction`).

API: `/api/maintenance` (GET list, with module/status/property filters), `/api/maintenance/[id]` (CRUD).

This is **the generic / LTR-style maintenance queue.** The STR side also has the older `/tasks` flow on top of the unified `tasks` table — the two coexist and should eventually be merged or clearly delineated.

---

## Tasks + Scheduler — State (shipped)

**Tasks** — at `/tasks`, `/tasks/new`, `/tasks/[id]`. Built for STR maintenance originally; extended in construction Phase 5 to share the same table. Has photo upload (Supabase Storage `task-photos` bucket), AI rewrite via Railway `/tasks/rewrite` (Claude with vision), assignee from `dream_team`, completion-photo gate.

**Team** — at `/team`, `/team/new`, `/team/[id]` — manages `dream_team` roster.

**Scheduler** — at `/scheduler`. 14-day grid keyed off `task_assignments` (per-day rows joined to a user). Pulls per-user `staff_availability` (work days, capacity) and `staff_availability_exceptions`. `/api/scheduler/auto-fill` exists for auto-assigning targets.

`target_tasks` (0) — recurring task templates (e.g. quarterly filter changes), tied to a property and preferred assignee, used by the auto-fill route.

---

## Insurance & Compliance — State (shipped)

**`/insurance`** — two tabs: a property × coverage-type traffic-light grid, and a vendor-COI table. Backed by `policies` (parent_type/parent_id polymorphic; policy_type ∈ property/liability/umbrella/builders_risk) and `coi_records` (per-company COI with insurer, policy number, GL/auto/WC/umbrella amounts, expiration, document FK).

API: `/api/insurance`, `/api/insurance-grid`, `/api/coi-renewal-request` (POST → marks `last_renewal_request_sent`; **email composition + send is stubbed**, not yet wired through Claude/queue).

Dashboard surfaces: policies expiring in 60d, COIs expiring in 30d, with warn-tone styling.

---

## Property Tax — State (shipped)

`/property-tax` is a list view of `property_taxes` rows with status pills (paid / due_soon / overdue / unpaid). API at `/api/property-tax`. 0 records live.

---

## Documents / Contacts / Files — State (schema, partial UI; this is where Phase 6 will land)

This is the area where the May-3 CONTEXT.md was most outdated. Snapshot of what already exists:

**Existing tables:**
- `documents` (0) — polymorphic `parent_type` + `parent_id`, `title`, `doc_type`, `storage_url`, `uploaded_by`, `notes`. Already referenced as FK by `coi_records.document_id`, `licenses.document_id`, `permits.document_id`, `property_taxes.document_id`, `policies.document_id`, `tenant_documents.document_id`, `tenant_invoices.document_id`, `tenant_screening.document_id`, `lease_rent_changes.notice_document_id`, `house_manuals.document_id`, `project_loans.document_id`, `project_expenses.invoice_document_id`, `property_expenses.receipt_document_id`, `utility_bills.document_id`. **Lots of upstream FKs assume this table is the canonical doc store.**
- `contacts` (0) — `first_name`, `last_name`, `company_id` FK, `primary_market_id`, `multi_market`, `trade`, `phone`, `email`, `preferred_contact`, `rating`, `notes`. **Note:** schema is "people at companies", NOT a flat name-and-tags model.
- `companies` (0) — `name`, `type`, `primary_market_id`, `multi_market`, `website`, `phone`, `email`, `address`, `ein`, `w9_on_file`, `coi_on_file`, `coi_expires`, `notes`. This is the vendor/sub/lender/insurer master record.
- `project_contacts` (0) — junction project↔contact/company with `role_on_project`.

**Existing UI:**
- `/contacts` — Rolodex page with tabs: Contacts (people) and Companies. CRUD via `/api/contacts` and `/api/companies`. Working but limited — no per-contact detail page, no required-docs checklist.

**Existing API:**
- `/api/contacts` (GET, POST), `/api/contacts/[id]` (GET, PATCH, DELETE)
- `/api/companies` (GET, POST), `/api/companies/[id]` (GET, PATCH, DELETE)

**Phase 6 design implication:** the Phase 6 build prompt as originally written invented a parallel `files` table and a flat `contacts` table. Both would conflict. Phase 6 should instead:
- Extend `documents` with the section/subsection/fulfills-required-slot bits it needs
- Use existing `contacts` + `companies` tables (the vendor-as-company pattern is already in use; required docs like W-9/COI/license belong on the company, not the contact)
- Add new tables only for genuinely novel things: required-doc templates/slots, field-log photos, photo-report metadata

---

## Auth / RBAC — State (shipped scaffolding, hardcoded super-admin)

Capability-based permission model. RLS on tables is currently disabled (must enable with policies before non-admin users get production access).

**Tables:**
- `app_users` (7) — staff/owners with auth_user_id link to Supabase Auth
- `dream_team` (6) — STR cleaning crew (separate from app_users — it's a roster, not an auth principal yet)
- `entities` (8), `entity_stakeholders` (8) — who owns what stake of which LLC
- `user_access_grants` (7) — per-(user, market, entity, property, module) role grants
- `capabilities` (78) — capability catalog (slug, label, category, applies_to_modules, default-by-role)
- `user_capabilities` (0) — capability overrides per grant

**Resolution flow (in `lib/permissions.js`):**
- `currentUserId()` — currently hardcoded to look up `judson@duracoproperties.com` (super_admin override). Once Supabase Auth is wired into the frontend, swap with the real session lookup.
- `canUserDo(userId, capability_slug, { entityId, module })` — calls Postgres function `user_has_capability(...)`.
- `visibleEntityIds(userId, module)` — for super_admin or management-company stakeholder, all entities; otherwise stakeholder rows + grants.

**UI:** `/settings`, `/settings/users/[id]`, `/settings/properties/[id]`. Capability catalog viewer + per-grant capability overrides editor.

**API:** `/api/admin/users[/[id][/grants[/[grantId][/capabilities]]]]`, `/api/admin/properties[/[id]]`, `/api/admin/entities`, `/api/admin/capabilities`.

---

## GuestOS Agent (Railway server)

Lives in `CasitasEnPueblo-Agent` repo. Single Express app (`server.js`, ~1720 lines). The `CLAUDE.md` in that repo has the architecture deep-dive — read it before changing the agent.

**HTTP endpoints (server.js):**
- `POST /webhook/hostaway` — guest message webhook (Hostaway PMS)
- `POST /webhook/quo` — SMS webhook (Quo, formerly OpenPhone). Signature-verified via `QUO_WEBHOOK_SECRET`.
- `GET /approvals` · `POST /approvals/:id/approve` · `POST /approvals/:id/dismiss` — human-in-the-loop queue
- `POST /tasks/rewrite` — Claude vision endpoint that rewrites raw maintenance task text + optional photo into a clean title/description
- `GET /health` — full system status (env keys present, Supabase counts, recent errors). Implementation in `routes/health.js`.
- `GET /debug` `/test-schedule` `/test-morning` `/debug-hostaway` `/schedule-status` `/env-check` — operational/debug routes

**In-process crons (no external scheduler):**
- `startScheduler()` — 7 PM evening cleaning-schedule push, 7:30 AM morning reminder. Hardcoded `TZ_OFFSET` for Mountain Time → **does not auto-handle DST** (adjust seasonally).
- `swppp-cron.js` (`node-cron`) — hourly weather check, Mon 7 AM weekly report compiler.
- `backend/swppp-sms.js` — minute-by-minute SWPPP inspection-SMS scheduler + reply handler.

**Architecture highlights (from `CasitasEnPueblo-Agent/CLAUDE.md`):**
- Both Hostaway + Quo webhooks hand off to single `processGuestMessage(...)` (~line 942 of server.js). Add new sources by plugging into that function, not by reinventing the analysis loop.
- `PROPERTIES` (~line 71) is the source of truth for the 5 STR properties. `LISTING_ID_MAP` (~line 143) maps Hostaway listing IDs → human names. `findProperty()` does substring matching ('13th', 'orman', 'washington', 'acero', '904'/'5th'). Extend the maps, don't fancier the matcher.
- Approvals: DB-of-record + in-memory `replyFnCache` (Map of closures). On restart cache is empty; `rebuildReplyFn(row)` reconstructs by `source` + `external_conv_id` (Hostaway) or `guest_phone` (Quo). New sources must extend `rebuildReplyFn` or restarts silently drop replies.
- Sam confirmation flow lives in `pendingSamRequests` (in-memory Map). Restart drops pending Sam asks — intentional.
- `lib/logger.js` writes to Supabase `server_logs`. Use it (not bare `console.log`) for anything you'd want surfaced in `/health` recent_errors. The older `addDebug()` ring buffer at `/debug` is for chatty per-message traces.
- `lib/config.js` — Supabase-backed feature flags / config with 60s in-memory TTL via `getConfig(key)` / `getFlag(name, default)`. Toggle without redeploys.
- `TEST_MODE=true` short-circuits all outbound — drafts route to `OWNER_PHONE_NUMBER` via `notifyOwnerTest()`. Every outbound branch already has the `if (TEST_MODE) {...} else {...}` split — preserve when adding new outbound paths.
- `DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001'` is stamped on every Supabase write.

---

## Frontend route map (Guestos-ops)

| Route | Status | Notes |
|---|---|---|
| `/` | shipped | Redirects to `/dashboard` |
| `/dashboard` | shipped | Stat cards across modules |
| `/short-term` | shipped | STR property cards (links go to /short-term/properties/[id] which is missing) |
| `/short-term/calendar` | stub | StubPage |
| `/short-term/inbox/messages` | stub | StubPage |
| `/short-term/inbox/approvals` | stub | StubPage |
| `/long-term` | shipped | LTR property cards (links go to /long-term/properties/[id] which is missing) |
| `/long-term/leases` | shipped (degraded) | Page renders; calls `/api/leases` + `/api/tenants` which 404 — empty state |
| `/construction` | shipped | Project list + new-project modal |
| `/construction/[id]` | shipped | Project detail with 9 sections |
| `/construction/[id]/subcontracts/[subId]` | shipped | Sub detail with line items editor |
| `/construction/[id]/loans/[loanId]` | shipped | Loan detail |
| `/contacts` | shipped | Rolodex (Contacts + Companies tabs) |
| `/maintenance` | shipped | Kanban over `maintenance_requests` |
| `/insurance` | shipped | Coverage matrix + COI table |
| `/property-tax` | shipped | Property tax records |
| `/scheduler` | shipped | 14-day staff scheduler grid |
| `/schedule` | shipped | STR cleaning schedule (legacy, uses supabase client direct + `/api/schedule`) |
| `/tasks` | shipped | STR task feed |
| `/tasks/new` | shipped | New task with AI rewrite |
| `/tasks/[id]` | shipped | Task detail |
| `/team` | shipped | Dream team roster |
| `/team/new` | shipped | New team member |
| `/team/[id]` | shipped | Team member detail |
| `/reports` | shipped | Finance dashboard (rent collected MTD/YTD, costs) |
| `/settings` | shipped | Admin tabs (Users, Properties, Capabilities) |
| `/settings/users/[id]` | shipped | User RBAC editor |
| `/settings/properties/[id]` | shipped | Property RBAC editor |
| `/calendar` | stub | StubPage |
| `/inbox` | stub | StubPage |
| `/swppp/inspect/[swpppId]` | shipped | Public smart form |
| `/swppp/qr/[swpppId]` | shipped | QR code page |
| `/swppp/public/[token]` | shipped | Public report viewer (AppShell chrome stripped) |

**Sidebar nav links to routes that DON'T exist (will 404):** `/short-term/properties[/[id]]`, `/short-term/reservations`, `/short-term/listings`, `/short-term/cleaning`, `/short-term/maintenance`, `/short-term/channel-manager`, `/short-term/smart-locks`, `/short-term/pricing`, `/short-term/house-manuals`, `/short-term/financials`, `/long-term/properties[/[id]]`, `/long-term/rent-roll`, `/long-term/aged-receivables`, `/long-term/maintenance`, `/long-term/vendors`, `/long-term/property-tax`, `/long-term/insurance`, `/long-term/utilities`, `/long-term/financials`, `/construction/subcontractors`, `/construction/vendors`, `/construction/documents`, `/construction/inspections`, `/construction/subcontracts`.

These are aspirational nav entries. They render a 404. Either trim the sidebar or build them — currently they're misleading.

---

## API endpoint map (Guestos-ops, Next.js routes)

**Construction (canonical, scoped to project):**
- `/api/construction/projects` (GET, POST), `/[id]` (GET, PATCH)
- `/api/construction/projects/[id]/phases` + `[phaseId]` + `/reorder`
- `/api/construction/projects/[id]/budget-categories` + `[catId]`
- `/api/construction/projects/[id]/expenses` + `[expenseId]`
- `/api/construction/projects/[id]/subcontracts` + `[subId]` + `[subId]/line-items` + `[subId]/line-items/[lineId]`
- `/api/construction/projects/[id]/loans` + `[loanId]`
- `/api/construction/projects/[id]/draws` + `[drawId]`
- `/api/construction/projects/[id]/tasks` + `[taskId]`
- `/api/construction/projects/[id]/change-orders` + `[coId]`
- `/api/construction/projects/[id]/inspections` + `[inspId]`
- `/api/construction/companies`, `/api/construction/lookups`

**Older / un-namespaced (overlap with construction):** `/api/projects[/[id]|/meta]`, `/api/subcontracts[/[id]]`, `/api/inspections[/[id]]`, `/api/companies[/[id]]`, `/api/contacts[/[id]]`. Kept around for direct table access; some pages still use them. **Cleanup candidate** — fold into the namespaced versions or delete.

**SWPPP:** `/api/swppp[/[id]]`, `/api/swppp/projects[/[id]]`, `/api/swppp/inspections[/[id]/[pdf]]`, `/api/swppp/inspections/auto-create`, `/api/swppp/reports/[id]/pdf`. Plus folders for `/api/swppp/bmps` and `/api/swppp/weather-events` (verify these have route.js files when you touch them).

**Cross-module ops:**
- `/api/dashboard`, `/api/dashboard-finance`
- `/api/sidebar-nav`
- `/api/insurance`, `/api/insurance-grid`, `/api/coi-renewal-request`
- `/api/property-tax`
- `/api/maintenance[/[id]]`
- `/api/scheduler`, `/api/scheduler/auto-fill`
- `/api/target-tasks`
- `/api/users` (active app_users for assignee dropdowns)
- `/api/schedule` (POST from Railway w/ `Bearer SCHEDULE_API_SECRET`)

**Cron (Vercel-triggered):**
- `/api/cron/weather-check` (hourly)
- `/api/cron/weekly-reports` (Mondays)

**Admin / RBAC:**
- `/api/admin/properties[/[id]]`
- `/api/admin/users[/[id][/grants[/[grantId][/capabilities]]]]`
- `/api/admin/entities`
- `/api/admin/capabilities`

**Missing but referenced from UI:** `/api/leases`, `/api/tenants` — `/long-term/leases` calls these; both 404.

---

## Database — full inventory

Supabase Postgres 17 (us-east-2). RLS **disabled** platform-wide. Storage buckets in use today: `task-photos`, `swppp-photos` (or storage path embedded in `swppp_photos.storage_path`), and a SWPPP-report bucket via `swppp_reports.storage_path`. **Do not assume more buckets exist without listing.**

**88 tables, 10 views.** Grouped by module:

**STR + agent:** `properties` (6), `units` (16), `listings` (0), `guests` (525), `conversations` (649), `messages` (2171), `reservations` (328), `payments` (0), `approvals` (24), `ai_drafts` (262), `training_rules` (23), `cleaning_schedules` (2), `schedule_units` (16), `cleaning_reports` (0), `cleaning_tag_options` (25), `damage_reports` (0), `guest_feedback` (0), `house_manuals` (0), `alerts` (0).

**LTR / tenants:** `tenants`, `leases`, `lease_tenants`, `lease_rent_changes`, `security_deposits`, `tenant_invoices`, `tenant_payments`, `tenant_documents`, `tenant_screening`, `tenant_portal_users`, `tenant_favors`, `rent_reminder_log`, `comms_threads`, `comms_thread_participants`, `comms_messages` (all 0).

**Marina / commercial:** `marina_units`, `marina_unit_types` (12), `marina_addons`, `marina_launch_log`, `marina_launch_passes`, `cam_reconciliations`, `cam_reconciliation_line_items`, `property_cam_monthly_totals`, `property_expenses` (all 0 except marina_unit_types).

**Construction:** `projects` (2), `entities` (8), `entity_stakeholders` (8), `markets` (2), `companies` (0), `contacts` (0), `project_contacts` (0), `project_phases` (0), `project_budget_categories` (0), `project_expenses` (0), `project_loans` (0), `project_draws` (0), `project_reports` (0), `subcontracts` (0), `subcontract_line_items` (0), `change_orders` (0), `inspections` (0), `permits` (0), `licenses` (0), `task_assignments` (0).

**SWPPP:** `swppp_projects` (1), `swppp_inspections` (2), `swppp_bmps` (3), `swppp_bmp_findings` (6), `swppp_site_checks` (12), `swppp_site_check_findings` (23), `swppp_corrective_actions` (0), `swppp_inspection_sms` (0), `swppp_weather_readings` (155), `swppp_weather_events` (0), `swppp_reports` (1), `swppp_photos` (0).

**Documents / compliance:** `documents` (0), `coi_records` (0), `policies` (0), `property_taxes` (0), `utility_accounts` (0), `utility_bills` (0).

**Tasks / scheduler:** `tasks` (0), `target_tasks` (0), `maintenance_requests` (0), `staff_availability` (1), `staff_availability_exceptions` (0), `reminders` (0), `automations` (4).

**Auth / RBAC:** `organizations` (1), `app_users` (7), `dream_team` (6), `user_access_grants` (7), `user_capabilities` (0), `capabilities` (78).

**System:** `server_logs` (8), `config` (3).

**Views:** `project_financials`, `project_loan_status`, `comms_thread_inbox`, `guest_lifetime_stats`, `guest_stay_history`, `cleaning_concerns_dashboard`, `rent_reminders_due_today`, `tenant_payments_effective`, `tenant_visible_lease`, `tenant_visible_property`.

**Verified column names (don't guess these):** `properties.short_name`, `properties.full_address`, `units.unit_label`. `dream_team.display_name` UNIQUE.

---

## Orphans, gaps, drift

Captured during the May 4 audit:

**Tables with schema and zero UI/API:** `comms_*`, `marina_*`, `cam_*`, `property_expenses`, `permits` (no UI; permits do appear as a section in the construction project page but the section is a stub), `licenses`, `house_manuals`, `tenant_*` except where covered by `/long-term/leases`'s placeholder, `utility_*`, `tenant_screening`, `damage_reports`, `reminders`, `automations`.

**API routes referenced from UI but not built:** `/api/leases`, `/api/tenants` (called by `/long-term/leases`).

**Sidebar nav items that 404:** see "Frontend route map" — ~24 nav links lead nowhere today.

**Doc drift fixed in this rewrite:**
- Construction tables are not prefixed `construction_` — they are `projects` / `inspections` / `change_orders` / `project_draws`. Tasks live in unified `tasks`.
- `documents` table exists and is the canonical doc store — Phase 6 should not invent a parallel `files` table.
- `contacts` schema is "people at companies" with FK to `companies`, not a flat `name + tags` model. Vendor required-docs (W-9, COI, license) belong on `companies`.
- The platform has substantial LTR / Marina / CAM / Tenant Portal scaffolding the previous CONTEXT.md never described.
- Hostaway/Vercel cron + Railway `swppp-cron.js` overlap on hourly weather check + Monday weekly report. Verify which is canonical before changing either.

---

## Environment variables

### Railway (CasitasEnPueblo-Agent service)
`ANTHROPIC_API_KEY`, `HOSTAWAY_ACCOUNT_ID=81734`, `HOSTAWAY_API_KEY`, `QUO_API_KEY`, `QUO_WEBHOOK_SECRET`, `QUO_BUSINESS_PHONE_ID`, `SAM_PHONE_NUMBER`, `OWNER_PHONE_NUMBER`, `STRIPE_PAYMENT_LINK`, `OPS_APP_URL=https://guestos-ops.vercel.app`, `SCHEDULE_API_SECRET=guestos_schedule_2026`, `SUPABASE_URL=https://wlopfprejttqpdyqntrr.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY` (new `sb_secret_...`), `OPENWEATHER_API_KEY` (SWPPP), `RAILWAY_SHARED_SECRET` (must match Vercel), **`TEST_MODE=true`**.

### Vercel (guestos-ops)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (new `sb_publishable_...`), `SCHEDULE_API_SECRET=guestos_schedule_2026`, `ANTHROPIC_API_KEY` (for `/tasks/rewrite` proxy and any future Claude calls), `RAILWAY_SHARED_SECRET` (must match Railway), `CRON_SECRET` (Vercel cron auth — verify present).

**Important:** Legacy Supabase API keys are **disabled** (migrated April 26). Do NOT re-enable — the old `service_role` was exposed in chat.

---

## Decisions log

- **Apr 26** — Migrated Supabase to new key system. Old keys disabled. Anthropic key rotated.
- **Apr 26** — Approvals moved to DB (was in-memory Map). `replyFn` closures cached, reconstructed from `source + external_conv_id` after restart.
- **Apr 27** — 14 training rules baked into system prompt. Database state preserved before pause.
- **Apr 28** — Build construction as separate **module** in same platform (not a separate system, not crammed into STR tables). Reason: shared core (org, payments, contacts), but data model and UI genuinely different.
- **Apr 28** — Maintenance task photos → Supabase Storage `task-photos` bucket. AI rewrite shows side-by-side, user approves. Completion photo required.
- **Apr 28** — Dream team uses `display_name` UNIQUE constraint. Roster locked: Darcee, Jaime, JWV, Judson Jager, Sam, Wendy.
- **May 3** — Phase 5 design decisions: `org_id` singleton lookup deferred (refactor later when 2nd org), SwpppTab inline (not detail page), `open_inspections` added to header counts shape.
- **May 4** — CONTEXT.md rewritten from scratch after audit found ~6 weeks of drift (full LTR / Marina / CAM / Tenant Portal / Insurance / Property Tax / Maintenance / Scheduler infrastructure built without documenting). Construction table names confirmed as un-prefixed (`projects` not `construction_projects`). Phase 6 paused pending design call to use existing `documents` + `contacts`/`companies` tables vs invent parallel ones.

---

## In flight

Nothing actively building. Phase 6 (Files + Required-docs + Field log + Photo reports) is paused pending the design call below.

---

## Open questions / Next up

### Immediate
- **Phase 6 design call:** confirm Phase 6 builds on top of existing `documents` + `contacts`/`companies` tables (recommended — see "Documents / Contacts / Files" state above) rather than inventing parallel `files` + new flat `contacts`. Once decided, regreenlight Phase 6 with a corrected build prompt that uses real table names.
- Trim or build the ~24 dead sidebar nav links — currently they 404 silently.
- Decide canonical SWPPP cron home (Vercel `/api/cron/*` vs Railway `swppp-cron.js`) and remove the duplicate.
- `/api/leases` + `/api/tenants` — build the minimal endpoints so `/long-term/leases` shows real data.

### STR side
- Resume training session (5 of 184 AI drafts reviewed)
- Schedule UI "completed today" view
- Acero Hostaway integration + Zelle for Washington/Orman
- `listings` table backfill with Hostaway IDs
- Pull main guest line from OpenPhone + recover the 111 missing Quo calls

### LTR side
- First real lease + tenant data entry to validate schema
- Build `/long-term/properties[/[id]]` (sidebar links there today)
- Build rent-roll, aged-receivables views
- Wire up the tenant portal (`tenant_portal_users` already exists; portal route doesn't)
- Wire `comms_threads` UI for LTR-side messaging

### Construction
- Phase 6 (above) — files + required-docs + Rolodex pickers + field log + photo reports
- Bundle the deferred schema cleanups in `project_pending_schema_cleanups.md`
- Replace `tasks.org_id` singleton lookup before second tenant onboards
- Photos / Documents stub sections on `/construction/[id]` get filled in by Phase 6

### Eventually
- Flip `TEST_MODE` → false (after STR training session lands)
- Channel manager (direct sync Airbnb/VRBO/Booking.com)
- Marina / CAM UI build-out
- Mobile app for Sam and field staff
- Real Supabase Auth wired in, replace `HARDCODED_SUPER_ADMIN_EMAIL` in `lib/permissions.js`
- Enable RLS with the capability-based policy generator

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
