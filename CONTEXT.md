# Casitas En Pueblo — Property & Construction Management Platform

**Owner:** Judson Jager (judson@duracoproperties.com)
**Last updated:** May 3, 2026

---

## How to use this file

This is the single source of truth for every Claude session working on this platform. **Read it before doing anything.** Both this Claude project and any Claude Code session should orient from this file first.

**Update rhythm:**
- The chat that ships work also updates the relevant section ("State" or "In flight") and commits the change as part of the same commit.
- Strategic decisions go in "Decisions log" so we don't re-litigate them in future sessions.
- "Open questions / Next up" is the queue for whatever's coming.

**Role separation across sessions:**
- **Strategic chat (Claude project, this file's home)** — planning, screenshot review, direction, updating this doc. Doesn't write production code.
- **Claude Code sessions** — execution. Builds what's in "In flight." Updates "State" when shipping.
- **One-off side chats** — try not to. If used, they don't touch this doc.

---

## What we're building

A property and construction management platform with three sides:
- **STR (Short-term rentals)** — 5 properties / 16 units in Pueblo, CO. Live, in TEST_MODE.
- **LTR (Long-term tenants)** — to be added later. Stub tables exist.
- **Construction project management** — actively building. Two projects in the system:
  - **West Center Tech** — new warehouse development at 201 N Laredo St, Aurora, CO 80011
  - **La Maison Moderne** — personal home renovation at 917 N Kalamath St, Denver, CO (Judson's personal home)

Eventually replaces Hostaway as its own channel manager (direct sync to Airbnb / VRBO / Booking.com).

Web AND app. Multiple modules sharing one Supabase backend.

---

## Repo & deployment map

| Layer | Repo | Hosted | URL |
|---|---|---|---|
| **Server / agent brain** | `JagerPropertiesLLC/CasitasEnPueblo-Agent` | Railway (project: `aware-embrace`, service: `CasitasEnPueblo-Agent`) | `casitasenpueblo-agent-production.up.railway.app` |
| **Ops frontend (STR + Construction UI)** | `JagerPropertiesLLC/Guestos-ops` | Vercel | `guestos-ops.vercel.app` |
| **Database** | n/a (Supabase project: JagerPropertiesLLC's Project) | Supabase (East US, Ohio) | `wlopfprejttqpdyqntrr.supabase.co` |

Local paths (Windows machine):
- `C:\Users\jjager\Desktop\CasitasEnPueblo-Agent` — server
- `C:\Users\jjager\Desktop\Guestos-ops` — frontend

Auto-deploys: Railway and Vercel both auto-deploy from `main` on push. Vercel env var changes require manual redeploy from Deployments tab.

**Important:** ignore the Railway project `faithful-strength`. The live one is `aware-embrace`.

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
- **Schedule UI** at `guestos-ops.vercel.app/schedule` with timezone bug fixed
- **524 guests / 2,170 messages backfilled** from Hostaway + Quo (Apr 27)
- **Maintenance task system** shipped (see below)
- **Dream team** roster: Darcee, Jaime, JWV, Judson Jager, Sam, Wendy

### Still TODO on STR side

- **Flip TEST_MODE to false** to go live (currently `true` on Railway)
- **Training session** — 184 AI drafts pending review (5 of 184 done); rest of test messages need ✅/⚠️/❌ refinement
- **Schedule UI bug** — only shows latest push; need "13 total today, 12 done, 1 remaining" view
- **Acero Ave Hostaway integration** — not yet listed
- **Zelle setup** for Washington and Orman properties
- **Listings table backfill** with Hostaway IDs (LISTING_ID_MAP from server.js)
- **Quo calls partial** — 69 of ~180 captured, 111 recoverable from business-number cleanup
- **Main guest line** not yet pulled from OpenPhone

---

## Maintenance task system — State (shipped)

Lives at `guestos-ops.vercel.app/tasks` and `/team`. Built April 28-ish.

- **Create tasks** with title, description, photo, property/unit, assignee (dream team), priority
- **AI rewrite** — Railway `/tasks/rewrite` endpoint cleans up sloppy text ("flix gutter pipe" → polished version), shown side-by-side, you approve
- **Photos** stored in Supabase Storage `task-photos` bucket
- **Sam's view** — assigned tasks flow into her existing schedule page
- **Completion gate** — completion photo required to mark done
- **Routes:** `/tasks`, `/tasks/new`, `/tasks/[id]`, `/team`, `/team/[id]`

---

## Construction module — State (Phase 5 just shipped)

Lives at `guestos-ops.vercel.app/construction` and `/construction/[id]`.

**Projects in production:**
- **West Center Tech** — warehouse development, 201 N Laredo St, Aurora, CO 80011. **This is the project that started the construction module.** Needing a way to handle SWPPP reports for the warehouse is what kicked off this entire build (SWPPP → inspections → subcontracts → draws → lien waivers → tasks → change orders, all the rest grew out from there).
- **Kalamath / La Maison Moderne** — Judson's personal home reno, 917 N Kalamath St, Denver, CO — project ID `a3137184-7589-4f42-bdb8-159da24319e6`. Uses the same module.

### Phases shipped

| Phase | What shipped |
|---|---|
| **1** | Projects, lookups (entities/markets), project header with `counts` shape |
| **2** | Budget categories, phases, expenses |
| **3** | Subcontracts, loans, draws |
| **4** | SWPPP module — projects, inspections, BMPs, signature image, PDF export |
| **5** *(May 3)* | Tasks, change orders, construction inspections, SwpppTab re-integrated as inline section, DELETE retrofit extended (sub with deps → 409 with combined `draws + change_orders` count), `open_inspections` added to counts shape |

### Project page sections (9 total)

Overview · Subcontractors · Inspections · Permits · SWPPP · Change Orders · Draws & Lien Waivers · Documents · Photos

### `counts` shape on project header

`open_tasks`, `pending_change_orders`, `subcontracts`, `open_inspections`

### Key files added in Phase 5

**New (10):**
- `app/api/construction/projects/[id]/tasks/route.js` + `[taskId]/route.js`
- `app/api/construction/projects/[id]/change-orders/route.js` + `[coId]/route.js`
- `app/api/construction/projects/[id]/inspections/route.js` + `[inspId]/route.js`
- `components/construction/TasksSection.js` + `TaskModal.js`
- `components/construction/ChangeOrdersSection.js` + `ChangeOrderModal.js`
- `components/construction/InspectionsSection.js` + `InspectionModal.js`

**Modified (5):** project header, lookups (added `app_users`), project page (3 stub replacements), subcontract DELETE retrofit, ProjectHeader chip.

Last commit: `02ed4c4` — "Add Construction MVP phase 5: tasks + change orders + construction inspections, SwpppTab re-integrated, phase 3 DELETE retrofit extended to change_orders, open_inspections added to counts shape" (19 files, +1813/-37).

### Verified in prod after Phase 5

- New endpoints all 200 (tasks, change-orders, inspections)
- Phase 1–4 regressions all 200
- Cross-project guard holds (404 on wrong-project access)
- SQL cleanup confirmed 0 leftover test rows across 6 tables
- SWPPP `/api/swppp/projects/{id}` 404 is expected (handled by SwpppTab "not configured" fallback)

### Phase 6 (queued)

**Files & contacts.** Two pieces:
- **Files** — document management (plans, permits, contracts, photos) attached to projects, subs, COs.
- **Contacts** — vendor/inspector/engineer/architect database. **This is the cross-project memory** — when warehouse #2 starts, the Rolodex is already there. Feeds into subs, inspections, change orders.

Could ship together or split. Contacts has more long-term value; Files is more immediate utility.

### Deferred items (in `project_pending_schema_cleanups.md` in repo)

- `org_id` singleton lookup → refactor to direct `org_id` on construction projects when 2nd org onboards
- `updated_at` on change_orders
- Multi-tenancy hardening (RLS still off platform-wide)
- Tasks/CO/inspection cross-project CHECK constraints

---

## Database

Supabase Postgres. RLS **disabled** platform-wide (must be enabled with proper policies before non-admin users get access).

### STR + LTR core tables
`organizations`, `properties`, `units`, `tasks`, `payments`, `listings`, `guests`, `reservations`, `conversations`, `messages`, `approvals`, `tenants`, `leases`, `cleaning_schedules`, `schedule_units`, `guest_feedback`, `dream_team`, `vendors`, `maintenance_tasks` (extended `tasks`), `training_rules`, plus blacklist/strikes/alerts schema deployed.

### Construction tables
`construction_projects`, `entities`, `markets`, `budget_categories`, `project_phases`, `expenses`, `subcontracts`, `loans`, `draws`, `swppp_projects`, `swppp_inspections`, `bmps`, `change_orders`, `construction_tasks`, `construction_inspections`, `app_users` lookup.

### Verified column names (don't guess these)
`properties.short_name`, `properties.full_address`, `units.unit_label`

---

## Environment variables

### Railway (CasitasEnPueblo-Agent service)
`ANTHROPIC_API_KEY`, `HOSTAWAY_ACCOUNT_ID=81734`, `HOSTAWAY_API_KEY`, `QUO_API_KEY`, `QUO_WEBHOOK_SECRET`, `QUO_BUSINESS_PHONE_ID`, `SAM_PHONE_NUMBER`, `OWNER_PHONE_NUMBER`, `STRIPE_PAYMENT_LINK`, `OPS_APP_URL=https://guestos-ops.vercel.app`, `SCHEDULE_API_SECRET=guestos_schedule_2026`, `SUPABASE_URL=https://wlopfprejttqpdyqntrr.supabase.co`, `SUPABASE_SERVICE_ROLE_KEY` (new `sb_secret_...`), **`TEST_MODE=true`**.

### Vercel (guestos-ops)
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (new `sb_publishable_...`), `SCHEDULE_API_SECRET=guestos_schedule_2026`, `ANTHROPIC_API_KEY` (for `/tasks/rewrite` proxy and any future Claude calls).

### Important
Legacy Supabase API keys are **disabled** (migrated April 26). Do NOT re-enable — the old `service_role` was exposed in chat.

---

## Endpoints

### Server (Railway)
`GET /debug` · `GET /env-check` · `GET /test-schedule` · `GET /test-morning` · `GET /schedule-status` · `GET /approvals` · `POST /approvals/:id/approve` · `POST /approvals/:id/dismiss` · `POST /webhook/hostaway` · `POST /webhook/quo` · `POST /tasks/rewrite`

### Frontend (Vercel)
`/schedule` · `/tasks` · `/tasks/new` · `/tasks/[id]` · `/team` · `/team/[id]` · `/construction` · `/construction/[id]`
API routes under `/api/construction/...` and `/api/swppp/...`

---

## Decisions log

- **Apr 26** — Migrated Supabase to new key system. Old keys disabled. Anthropic key rotated.
- **Apr 26** — Approvals moved to DB (was in-memory Map). `replyFn` closures cached, reconstructed from `source + external_conv_id` after restart.
- **Apr 27** — 14 training rules baked into system prompt. Database state preserved before pause.
- **Apr 28** — Decision: build construction as separate **module** in same platform (not separate system, not crammed into STR tables). Reason: shared core (org, payments, contacts), but data model and UI genuinely different.
- **Apr 28** — Maintenance task photos → Supabase Storage `task-photos` bucket. AI rewrite shows side-by-side, user approves. Completion photo required.
- **Apr 28** — Dream team uses `display_name` UNIQUE constraint. Roster locked: Darcee, Jaime, JWV, Judson Jager, Sam, Wendy.
- **May 3** — Phase 5 design decisions: org_id singleton lookup deferred (refactor later when 2nd org), SwpppTab inline (not detail page), `open_inspections` added to header counts shape.

---

## In flight

Nothing actively building right now. Phase 5 just shipped clean and was verified in prod. Phase 6 (Files + Contacts) queued.

---

## Open questions / Next up

### Immediate
- Manually click through Phase 5 in the UI on both projects (West Center Tech and Kalamath) before kicking off Phase 6 — test the modals, make sure nothing's wonky
- Decide Phase 6 scope: Files + Contacts together, or split

### STR side (medium priority)
- Resume training session (5 of 184 AI drafts reviewed)
- Schedule UI "completed today" view
- Acero Hostaway integration + Zelle setup for Washington/Orman
- Listings table backfill

### Eventually
- Flip TEST_MODE → false (after training session lands)
- Build channel manager (direct sync Airbnb/VRBO/Booking.com)
- LTR module fleshed out (tenants/leases stubs already exist)
- Maintenance ticket system on construction side
- Owner reporting / financial dashboards
- Mobile app for Sam and field staff

---

## Working style (Judson)

- Full file rewrites > inline edits
- One step at a time (multi-step instructions are overwhelming)
- Hands-off execution — Claude does the work, Judson copy/pastes/runs
- Plain unformatted text in chat (formatted code blocks are hard to copy on his setup)
- Terminal + git for deployments
- Verify existing schema before writing SQL that depends on it (don't guess column names)

### Guest communication tone
- Casual & warm: "Hey [name]", "No sweat!", "My pleasure!"
- Emojis sparingly (😊 🙏)
- Sign off: "Judson" or "Your Pueblo Hosting Team"
- Spanish with Spanish-speaking guests
- **Never says:** "Sound good?", "I apologize for any inconvenience", "per our policy"
- Free 3 PM check-in only as pushback negotiation
- Sam contacted only when her input is needed
