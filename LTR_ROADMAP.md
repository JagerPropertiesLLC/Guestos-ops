# LTR Audit & Roadmap (Pre-Phase 8 Planning)

**Author:** audit pass, May 4 2026
**Scope:** long-term tenants only. STR / construction / marina out of scope except where they share infrastructure.
**Purpose:** orient the next 6–10 phases of LTR work. **This doc is a roadmap, not a build.** No application code changed; no schema changed; database read only.

Read `CONTEXT.md` first for shipped-state narrative. This doc focuses on what's missing and what to build next.

---

## TL;DR

- **Schema is in.** All 14 LTR-domain tables plus `comms_thread_participants` exist, plus 5 RLS-ready views and 8 helper functions. Every LTR table is **empty** (0 rows). Tenant-portal RLS infra is staged but RLS is platform-disabled.
- **App is essentially not built.** Three frontend pages exist (`/long-term`, `/long-term/leases`, `/long-term/properties/[id]`); 9 of 10 sidebar items 404. **Zero LTR-specific API routes implemented.** `/api/leases` and `/api/tenants` are referenced from UI and missing.
- **Colorado law has shifted hard since 2021** and twice more in 2024–2026. Three live constraints reshape platform design before code is written:
  1. **PTSR acceptance (HB23-1099 + HB25-1236, eff. 2026-01-01)** — landlords must accept tenant-supplied portable screening reports <60 days old and **may not charge application/screening fees** when one is provided. $2,500 per violation. This is a workflow requirement, not a vendor pick.
  2. **For-cause eviction (HB24-1098, eff. 2024-04-19)** — most tenancies of 12+ months can only be ended for cause; no-fault non-renewal = **90-day written notice** plus a defined cause category. Property-type exemptions matter (small owner-occupied SFR, etc.).
  3. **Security-deposit overhaul (HB25-1249, eff. 2026-01-01)** — walk-through inspection rights, expanded "normal wear and tear," 14-day docs-on-request, treble damages remain.
- **Multi-owner foundation already exists** via the `entities` table (8 LLCs per CONTEXT). Phase 8 should wire `properties.entity_id` rollups into LTR reporting rather than build a parallel `ownership_entities` table.
- **Recommended phase sequence:** Phase 8 (LTR core records) → 9 (tenant portal MVP) → 10 (rent collection on Stripe ACH) → 11 (lease lifecycle + notices) → 12 (screening with PTSR) → 13 (eviction tracking) → 14 (accounting + QB export) → 15 (inbound comms routing). Optional Phase 16 (listing syndication) flagged in Open Questions.

---

# Section 1 — Current LTR State (factual)

## 1A. LTR-related Supabase tables

Confirmed via Supabase MCP `list_tables` + `execute_sql` against `wlopfprejttqpdyqntrr.supabase.co` (JagerPropertiesLLC's Project, us-east-2).

| Table | Rows | Description | Status | Key FKs |
|---|---|---|---|---|
| `tenants` | 0 | Tenant identity (name, email, phone, DOB, ssn_last4, emergency contact). | empty | (referenced by) `leases.primary_tenant_id`, `lease_tenants.tenant_id`, `tenant_documents.tenant_id`, `tenant_favors.tenant_id`, `tenant_portal_users.tenant_id`, `comms_threads.tenant_id`, `maintenance_requests.submitted_by_tenant_id`, `marina_launch_passes.tenant_id` |
| `leases` | 0 | Core lease record: rent, dates, late-fee config, utilities, insurance dates, CAM estimate, links to property/unit/marina_unit/document. | empty | `property_id` → `properties.id`, `unit_id` → `units.id`, `marina_unit_id` → `marina_units.id`, `primary_tenant_id` → `tenants.id`, `document_id` → `documents.id` |
| `lease_tenants` | 0 | M:N join — multi-tenant on a lease (`is_primary`, `responsible_for_rent`). | empty | `lease_id` → `leases.id`, `tenant_id` → `tenants.id` |
| `lease_rent_changes` | 0 | Audit trail of rent changes (old/new, %, notice doc, reason). | empty | `lease_id` → `leases.id`, `notice_document_id` → `documents.id`, `changed_by` → `app_users.id` |
| `security_deposits` | 0 | Deposit lifecycle (collected, held_in, return amount, deductions, status). | empty | `lease_id` → `leases.id` |
| `tenant_invoices` | 0 | Invoice records (number, type, due/issue, amount, jsonb line_items, status, links to payment + document). | empty | `lease_id` → `leases.id`, `payment_id` → `tenant_payments.id`, `document_id` → `documents.id` |
| `tenant_payments` | 0 | Payment ledger (due/paid dates, amount, amount_paid, method, status; Stripe intent/charge IDs). Status auto-derived via trigger. | empty | `lease_id` → `leases.id` (`org_id` column present, no FK) |
| `tenant_documents` | 0 | Tenant/lease document join (doc_type, expiration, verified flag) — points at `documents`. | empty | `tenant_id` → `tenants.id`, `lease_id` → `leases.id`, `document_id` → `documents.id`, `verified_by` → `app_users.id` |
| `tenant_screening` | 0 | Application screening (credit score, income, evictions, decision); links to property and optional resulting lease. | empty | `property_id` → `properties.id`, `lease_id` → `leases.id`, `document_id` → `documents.id` |
| `tenant_portal_users` | 0 | Portal login mapping `auth.users` → `tenants` with active flag. | empty | `tenant_id` → `tenants.id`, `auth_user_id` → `auth.users.id` |
| `tenant_favors` | 0 | Concessions/favors log (type, cost, paid_by, granted_by). | empty | `tenant_id` → `tenants.id`, `lease_id` → `leases.id`, `granted_by` → `app_users.id` |
| `rent_reminder_log` | 0 | Outbound reminder ledger tied to a `tenant_payment` and the comms thread/message it produced. | empty | `tenant_payment_id` → `tenant_payments.id`, `comms_thread_id` → `comms_threads.id`, `comms_message_id` → `comms_messages.id` |
| `comms_threads` | 0 | Polymorphic thread header (tenant/lease/property/project/phase/sub/maintenance scopes), email-channel ready. | empty | `property_id`, `tenant_id`, `lease_id`, `project_id`, `phase_id`, `subcontract_id`, `maintenance_request_id`, `created_by` → `app_users.id` |
| `comms_messages` | 0 | Message body + attachments + email-delivery metadata; `AFTER INSERT` bumps thread `last_message_at`. | empty | `thread_id` → `comms_threads.id` |
| `comms_thread_participants` | 0 | Per-participant read-state and notification toggle on a thread. | empty | `thread_id` → `comms_threads.id` (participant polymorphic — no FK enforced) |

**Net:** every LTR table is empty. The schema is comprehensive (multi-tenant join, deposit lifecycle, invoice/payment split, polymorphic comms) but no rows live anywhere — there's no risk of schema/data drift from migration work.

### LTR-adjacent infrastructure (non-tables)

**Views (5):**
- `comms_thread_inbox` — flattened thread list with last-message preview/unread state. Unclear without reading source; recommend inspecting before Phase 9.
- `rent_reminders_due_today` — derived list of `tenant_payments` that should trigger a reminder today (consumed by reminder job, not yet running).
- `tenant_payments_effective` — payment view incorporating the `status_from_amount` derivation; canonical "current state" surface.
- `tenant_visible_lease` — RLS filter view exposing rows the current portal user is allowed to see (uses `current_tenant_id()`).
- `tenant_visible_property` — same pattern at property scope for portal.

**Functions (8):**
- `bump_comms_thread_on_message()` — trigger fn updating `comms_threads.last_message_at`.
- `current_app_user_id()`, `current_tenant_id()`, `current_tenant_portal_user_id()` — JWT-claim resolvers, intended for RLS (RLS is currently disabled platform-wide per CONTEXT).
- `mark_comms_thread_read()` — stamps a participant's `last_read_at`.
- `tenant_can_see_property()` / `tenant_has_lease()` — boolean predicates backing the `tenant_visible_*` views.
- `tenant_payments_status_from_amount()` — trigger fn deriving `status` from `amount` vs `amount_paid`.

**Triggers (2 distinct):**
- `trg_comms_messages_bump_thread` (AFTER INSERT on `comms_messages`).
- `trg_tenant_payments_status_from_amount` (BEFORE INSERT/UPDATE on `tenant_payments`).

## 1B. LTR routes and APIs

### Frontend pages

| Path | Status | Description |
|---|---|---|
| `/long-term` | shipped + working | Lists LTR properties (filters `/api/sidebar-nav` for `module === 'ltr'`); cards link to property detail. Today shows just Kalamath via entity-slug heuristic. |
| `/long-term/leases` | shipped but stub | "Tenants & Leases" tabs (Active / Expiring / All Tenants). Calls `/api/leases` and `/api/tenants` — both 404 — so always renders empty state. Even when tenants returned, the rows render `—` for property/rent/lease-end (table not wired to lease join). |
| `/long-term/properties/[id]` | shipped + working | Thin wrapper around shared `components/property/PropertyDetail` with `module="long-term"` (Required Docs / All Files / Site Visits / Inspections tabs from Phase 6/7a). |

No other `/long-term/*`, `/ltr/*`, `/tenant/*`, `/tenants/*`, or `/tenant-portal/*` pages exist. (There is a `pathname.startsWith('/tenant-portal')` guard in `AppShell` but no page files.)

### API endpoints

**Zero LTR-specific API route files exist** anywhere under `app/api/`. The `app/api/sidebar-nav/route.js` and `app/api/properties/[id]/route.js` are cross-module and incidentally serve LTR.

| Path + Method | Status | Description | Frontend caller |
|---|---|---|---|
| `GET /api/leases` | referenced-but-missing | Expected: list active leases for "Tenants & Leases" page. | `app/long-term/leases/page.js` |
| `GET /api/tenants` | referenced-but-missing | Expected: list tenants for the All Tenants tab. | `app/long-term/leases/page.js` |

No other LTR API references exist in the UI (verified via grep on `app/` and `components/` for `/api/leases`, `/api/tenants`, `/api/rent*`, `/api/comms*`, `/api/long-term/*`, `/api/tenant*`).

### Sidebar nav (LTR section)

Hardcoded inline in `components/AppShell.js`'s `LongTermPanel`:

| Label | href | Status |
|---|---|---|
| Properties (collapsible) | `/long-term/properties` | 404 (index route) — sub-items `/long-term/properties/[id]` work |
| Tenants & Leases | `/long-term/leases` | shipped but stub |
| Rent Roll | `/long-term/rent-roll` | 404 |
| Aged Receivables | `/long-term/aged-receivables` | 404 |
| Maintenance | `/long-term/maintenance` | 404 |
| Vendors | `/long-term/vendors` | 404 |
| Property Tax | `/long-term/property-tax` | 404 (page exists at `/property-tax` cross-module) |
| Insurance | `/long-term/insurance` | 404 (page exists at `/insurance` cross-module) |
| Utilities | `/long-term/utilities` | 404 |
| Financial Reporting | `/long-term/financials` | 404 |

Note: there is no `lib/sidebar.js`. Nav items are hardcoded in `AppShell.js`. `app/api/sidebar-nav/route.js` only emits property/project lists for the collapsible sub-items.

### Orphans

**API endpoints referenced from UI but not implemented:**
- `GET /api/leases` (called from `/long-term/leases`)
- `GET /api/tenants` (called from `/long-term/leases`)

**LTR tables with no UI surface** (no read or write callers anywhere in the frontend repo):
- All 15 LTR tables. Some are written by no app code at all (`rent_reminder_log` is presumably reserved for the future Railway reminder job).
- All 5 LTR views are unread by frontend.

**Routes that 404 silently** (linked from nav, no `page.js`):
- `/long-term/properties` (index)
- `/long-term/rent-roll`
- `/long-term/aged-receivables`
- `/long-term/maintenance`
- `/long-term/vendors`
- `/long-term/property-tax` (page exists at `/property-tax` instead)
- `/long-term/insurance` (page exists at `/insurance` instead)
- `/long-term/utilities`
- `/long-term/financials`

---

# Section 2 — Compliance Reference (Colorado, May 2026)

> This section is design constraints, not legal advice. All citations primary-source-verified via WebFetch on `leg.colorado.gov`, `colorado.public.law`, `coloradojudicial.gov`, `ccrd.colorado.gov`. Cross-checked against Colorado Bar Association summaries where statute mirrors had access issues.

## 2.1 Security Deposits

Cap exists, return one month default (lease can extend to 60 days), willful retention triggers treble damages. **Big rewrite of mechanics took effect 2026-01-01** — bake into Phase 8 / Phase 11.

- **Maximum:** 2 months' rent. [C.R.S. § 38-12-102.5](https://colorado.public.law/statutes/crs_38-12-102.5) (HB23-1095, eff. 2023-08-07).
- **Return timeline:** 1 month default by statute; lease may extend up to 60 days. [C.R.S. § 38-12-103](https://colorado.public.law/statutes/crs_38-12-103).
- **Itemization:** Written statement listing exact reasons for any retention, with payment of the difference, delivered within the deadline.
- **Permitted deductions:** Unpaid rent + damages beyond normal wear and tear + amounts allowed by lease (bounded by statute).
- **Non-compliance penalty:** Treble damages on the wrongfully withheld portion + reasonable attorney fees + court costs for **willful** retention. Tenant must give 7 days' written notice of intent to sue before filing. Burden on landlord.
- **HB25-1249 amendments (eff. 2026-01-01) — DESIGN-RELEVANT:**
  - Expanded "normal wear and tear" definition.
  - Move-in / move-out documentation required.
  - Walk-through inspection right at move-out (tenant-elected).
  - 14 days to provide written documentation of charges on tenant's written request.
  - Bad-faith retention standard (lower than "willful").
  - **60-day deposit-transfer rule on property sale.**
  - 1-year hold for returned refund checks.
  - [HB25-1249 bill page](https://leg.colorado.gov/bills/HB25-1249).
- **Escrow / interest:** No general statutory requirement to hold in CO, in interest-bearing accounts, or to pay interest on residential deposits.

## 2.2 Late Fees + Grace Period

7-day mandatory grace, hard cap at greater-of-$50-or-5%, late fees can never trigger eviction, must be in the lease.

- **Statute:** [C.R.S. § 38-12-105](https://colorado.public.law/statutes/crs_38-12-105) (HB21-173, eff. 2021-10-01).
- **Mandatory grace:** No late fee until rent is **at least 7 calendar days late**.
- **Cap:** Greater of **$50** or **5% of past-due rent**.
- **Disclosure prerequisite:** Late fee must be in the rental agreement; landlord must give written notice of the fee within **180 days** of the rent due date or it is forfeited.
- **No-eviction-for-late-fees:** Cannot terminate, evict, or initiate FED based on unpaid late fees. Cannot charge interest on late fees. Max one late fee per late payment.
- **Subsidy-rent rule:** No late fee on the portion a rent-subsidy provider (voucher, etc.) is responsible for paying.
- **Penalty for landlord violation:** $50 initially per violation; if not cured within 7 days of written notice, $150–$1,000 per violation + actual damages + attorney fees. Also a deceptive trade practice.
- **Demand-for-rent caveat:** The 10-day pay-or-quit demand may state **only rent owed**, not late fees / utilities / other charges, or the demand is invalid (HB21-173).

## 2.3 Notice Requirements

Notice-to-quit days vary by tenancy length (HB24-1098 raised long-tenancy notice to 91 days). No statutory cap on rent increases, but for-cause-eviction tenants get notice protection.

- **Notice to terminate tenancy** ([C.R.S. § 13-40-107](https://colorado.public.law/statutes/crs_13-40-107), amended by HB24-1098, eff. 2024-04-19):
  - 1 year or longer: **91 days**
  - 6 months to <1 year: **28 days**
  - 1 month to <6 months: **21 days**
  - 1 week to <1 month / tenancy at will: **3 days**
  - <1 week: **1 day**
  - Exemption: no notice needed when lease has a date-certain end (`§ 13-40-107(4)`), but for-cause rules in § 38-12-1300 series may still require 90-day non-renewal notice — see Section 2.4.
- **Entry notice:** No statewide statutory minimum. Standard practice and most leases require 24-hour reasonable notice; this is contractual, not statutory.
- **Lease violation (cure or quit):** **10 days** Demand for Compliance for non-rent breaches (`§ 13-40-104(1)(e)`); **3 days** for "substantial violations" (`§ 13-40-107.5`); 5 days for certain exempt residential agreements; 3 days nonresidential / employer-housing.
- **Non-payment of rent (pay or quit):** **10 days** ([C.R.S. § 13-40-104(1)(d)](https://colorado.public.law/statutes/crs_13-40-104)). Landlord must accept timely cure.
- **Non-renewal of for-cause-protected tenancies:** **90 days** written notice (HB24-1098).
- **Rent increases:** No state law mandates written notice or minimum days *during* a tenancy beyond lease terms. Periodic-tenancy increases effectively require terminate-and-re-offer using `§ 13-40-107` notice periods. HB23-1095 forbids labeling non-rent charges as "rent."

## 2.4 Eviction (FED) Procedure

10-day pay-or-quit, file complaint+summons, hearing 7–14 days out, writ + 48-hour set-out. For-cause requirement applies to most tenancies of 12+ months.

Citations: [C.R.S. § 13-40 series](https://colorado.public.law/statutes/crs_13-40-104) + [Colorado Judicial Branch Self-Help](https://www.coloradojudicial.gov/self-help/residential-evictions).

**Step-by-step:**

1. **Pre-suit notice (one of):**
   - **Demand for Compliance / Pay-or-Quit** — JDF 99 A, **10 days** for residential rent or non-rent breach (`§ 13-40-104`). Demand-for-rent must list **only rent owed**.
   - **Notice to Terminate Tenancy** — JDF 99 B, 1–91 days per `§ 13-40-107`.
   - **Notice of No-Fault / For-Cause Eviction** — JDF 99 C, **at least 90 days** under HB24-1098 ([C.R.S. § 38-12-1300 series](https://leg.colorado.gov/bills/hb24-1098)).
2. **File Complaint (JDF 101) + Eviction Summons (JDF 102)** after notice expires.
3. **Service:** Personal or posting + mailing, **at least 7 days before hearing**.
4. **Court appearance / answer due:** Summons sets appearance **not less than 7 nor more than 14 days** from issuance ([C.R.S. § 13-40-111](https://codes.findlaw.com/co/title-13-courts-and-court-procedure/co-rev-st-sect-13-40-111/)). Tenant Answer (JDF 103) due at or before that appearance.
5. **Trial:** If tenant answers, court sets trial **7 to 10 days** after answer.
6. **Judgment + Writ of Restitution (JDF 109):** Issued on judgment for landlord.
7. **Set-out:** Sheriff posts writ; tenant has **48 hours** to vacate before sheriff conducts physical removal.

**HB24-1098 "for-cause" overlay** (eff. 2024-04-19, [C.R.S. §§ 38-12-1301 to 38-12-1307](https://leg.colorado.gov/bills/hb24-1098)):

- Applies to all residential tenancies **12 months or longer** unless exempt.
- **Exemptions:** short-term rentals; owner-occupied or owner-adjacent SFR / duplex / triplex; mobile-home lots (separate regime); employer-provided housing; tenancies under 12 months; unauthorized unknown occupants.
- **Cause categories** = unlawful detention (`§ 13-40-104`), nuisance / property damage, or one of six **no-fault** grounds: demolition/conversion, substantial repairs/renovations, owner or family-member move-in, withdrawal-from-market for sale, tenant refusal of reasonable new lease, history of nonpayment.
- **No-fault eviction notice = 90 days** in writing.

**Design implication:** every property needs a `for_cause_exempt` boolean and a reason — and the rent-roll / lease-end UI needs to surface the 91-day clock differently for protected tenancies.

## 2.5 Fair Housing

Colorado adds material protected classes on top of the federal FHA — most notably **source of income** since 2021.

- **Federal FHA classes:** race, color, national origin, religion, sex (incl. SO/GI per HUD), familial status, disability.
- **Colorado Anti-Discrimination Act (CADA), [C.R.S. § 24-34-502](https://ccrd.colorado.gov/housing-discrimination)** — adds: ancestry, creed, marital status, sexual orientation (express), gender identity, gender expression, **source of income**, disability (broader CO definition).
- **Source of income** ([HB20-1332](https://leg.colorado.gov/bills/hb20-1332), eff. 2021-01-01): "any lawful, verifiable source of money paid directly, indirectly, or on behalf of a person" — wages, government assistance, **Section 8 vouchers**, SSI, SSDI, child support, grants.
  - **Small-landlord exemption:** ≤3 rental units total. (Judson exceeds this.)
  - **Voucher-specific exemption:** ≤5 SFRs (≤5 total units) need not accept HCV.
  - **Tenant-screening implication:** uniform credit and income-multiplier checks remain permitted **only if applied uniformly**, and the multiplier must count the voucher's tenant-paid share, not gross rent. Categorical "no Section 8" is unlawful for non-exempt landlords.
- **Enforcement:** Colorado Civil Rights Division (CCRD) under DORA.

**Design implication:** screening flow must encode consistent, written criteria; every adverse action needs an audit log; income-multiplier math must support voucher splits.

## 2.6 Lease Disclosures

Federal lead, Colorado radon (mandatory), no statewide mold/bedbug rule, meth via separate sale-disclosure statute, plus the new SB24-094 habitability statement.

- **Federal lead-based paint** (pre-1978 housing): EPA/HUD pamphlet + disclosure form. 24 CFR 35 / 40 CFR 745.
- **Radon disclosure (mandatory):** [SB23-206](https://leg.colorado.gov/bills/sb23-206), codified at [C.R.S. § 38-12-803](https://colorado.public.law/statutes/crs_38-12-803), eff. 2023-08-07. Must provide **before lease execution**: written radon warning, prior test results / records / mitigation history, CDPHE's most recent radon brochure. Tenant may **void the lease** if disclosure fails or landlord doesn't mitigate within 180 days of notice of elevated levels (4 pCi/L+). Effective 2026-01-01, void-right does not apply to leases of one year or less.
- **Methamphetamine remediation:** [C.R.S. § 38-35.7-103](https://law.justia.com/codes/colorado/2016/title-38/real-property/article-35.7/section-38-35.7-103) (sale context) + remediation standards [C.R.S. § 25-18.5](https://law.justia.com/codes/colorado/title-38/tenants-and-landlords/article-12/part-5/section-38-12-505/). Disclose known unremediated meth-lab use; properly remediated + certified properties don't require disclosure.
- **Mold:** No statewide mandatory mold-disclosure. Mold-related habitability is governed by warranty of habitability (§ 38-12-505).
- **Bedbugs:** No state-level disclosure statute.
- **Habitability statement (SB24-094):** For leases formed **on or after 2025-01-01**, residential leases must include a statement, in **English and Spanish**, telling the tenant where to deliver written notice of unsafe / uninhabitable conditions.
- **HB23-1095 prohibitions** (eff. 2023-08-07): bans waivers of jury trial / class actions / implied covenants of good faith and quiet enjoyment; bans labeling pass-through fees as "rent"; one-sided fee-shifting prohibited; eviction-notice penalty clauses prohibited; **third-party utility markup capped at the lesser of $10/month or 2% of the bill.**

**Design implication:** the lease template generator must inject the bilingual habitability statement, the radon disclosure (with optional historical results attachment), and the lead-paint pamphlet trigger on pre-1978 properties. A property-level field for `built_year`, `radon_results`, `meth_remediation_certified` is needed.

## 2.7 Service Animals vs. ESAs

Service animals (ADA) and assistance animals / ESAs (FHA) are reasonable accommodations regardless of any "no pets" / pet-deposit / pet-rent policy. Verification rules differ.

- **Service animals (ADA):** Dogs (and miniature horses) individually trained to perform tasks for a person with a disability. Landlord may ask only (a) is this required because of a disability, and (b) what task is the animal trained to perform. **No documentation, certification, or registration may be required.** No fees, deposits, or pet rent.
- **Assistance / ESA (FHA):** Any species prescribed as a reasonable accommodation under the federal FHA (42 U.S.C. § 3604). Landlord may request **reliable documentation from a licensed health-care professional** if the disability-related need isn't obvious. **No "registration" website ever satisfies this.** No pet fees, pet rent, or pet deposit. Tenant remains liable for actual damages.
- **Colorado specifics — [HB16-1426](https://leg.colorado.gov/bills/hb16-1426) (codified at [C.R.S. § 24-34-803](https://ccrd.colorado.gov/housing-discrimination)):** ESA-letter provider must have an established therapeutic / professional relationship with the patient and be CO-licensed (or otherwise qualified). Misrepresenting an animal as a service / assistance animal is a civil infraction.
- **Permissible declines:** direct threat, fundamental alteration, undue financial / administrative burden — narrowly construed.

**Design implication:** per-property pet policy (allowed types, count, weight) must coexist with a **reasonable-accommodation override** that's a separate flag on a tenant record. No pet fee / deposit on RA animals.

## 2.8 Warranty of Habitability

Affirmative landlord duty since HB19-1170, substantially overhauled by SB24-094 (2024-05-03). Tight timelines and tenant remedies including repair-and-deduct, withholding, and termination.

- **Statute:** [C.R.S. §§ 38-12-501 to 38-12-512](https://law.justia.com/codes/colorado/title-38/tenants-and-landlords/article-12/part-5/section-38-12-505/), as amended by [SB24-094](https://leg.colorado.gov/bills/sb24-094).
- **Triggering conditions** (non-exhaustive): no running water, no hot water, no heat (Oct-Apr), gas leaks, hazardous electrical/plumbing, mold associated with dampness, vermin/pest infestation, broken/inoperable elevator (where required for tenant access), inadequate sealing of doors/windows, broken locks or smoke alarms, sewage backup, environmental hazards.
- **Notice + landlord response timelines (post-SB24-094):**
  - Tenant gives notice (written, electronic, or designated channel per the lease's required statement).
  - **Materially affecting life, health, safety:** landlord must commence remediation within **24 hours**. Rebuttable presumption of breach if not resolved within **7 days**. If unit is uninhabitable, landlord must offer comparable dwelling or hotel for up to 60 days.
  - **All other habitability conditions:** commence within **72 hours**. Rebuttable presumption of breach if not resolved within **14 days**.
- **Tenant remedies:** repair-and-deduct (capped, with notice); rent withholding into escrow; lease termination for material breach; affirmative defense in eviction for nonpayment; damages incl. actual + statutory + attorney fees; punitive in some cases. SB24-094 eliminated the prior bond requirement for tenants raising habitability defenses.
- **Anti-retaliation:** retaliatory eviction or rent increase prohibited (`§ 38-12-509`).

**Design implication:** maintenance request flow (already shipped under `/maintenance`) needs LTR-aware SLA tracking — auto-flag when a habitability-category request crosses the 24h / 72h / 7d / 14d thresholds. Already partially modeled via `maintenance_requests.module='ltr'`.

## 2.9 Recent Legislative Changes (2023–2026)

Scannable timeline of platform-relevant Colorado bills:

- **HB23-1095** (eff. 2023-08-07) — Prohibited lease provisions; jury-trial / class-action / implied-covenant waivers banned; "rent" labeling restriction; utility-markup cap; one-sided fee-shifting banned. [Bill](https://leg.colorado.gov/bills/hb23-1095).
- **HB23-1099** — **Portable tenant screening reports.** Landlord must accept a qualifying portable screening report; may not charge an application fee if one is provided. [C.R.S. § 38-12-902 et seq.](https://law.justia.com/codes/colorado/title-38/tenants-and-landlords/article-12/part-9/section-38-12-904/).
- **HB23-1254** — Documentation of habitability (lead-up to SB24-094).
- **SB23-184** — Income-based limits on tenant screening (2:1 income-to-rent caps, restricted use of credit history).
- **SB23-206** (eff. 2023-08-07) — Mandatory radon disclosure in residential leases.
- **HB24-1098** (eff. 2024-04-19) — **For-cause eviction**; 91-day non-renewal notice for tenancies of 1+ year. [Bill](https://leg.colorado.gov/bills/hb24-1098).
- **SB24-094** (eff. 2024-05-03; lease-language requirement eff. 2025-01-01) — Warranty of habitability rewrite; 24/72-hour response; 7/14-day repair presumptions; alternative-housing duty; bilingual habitability statement.
- **HB25-1249** (eff. 2026-01-01) — Security deposit overhaul: expanded normal wear and tear, walk-through inspection right, 14-day documentation-on-request, 60-day transfer rule on sale. [Bill](https://leg.colorado.gov/bills/HB25-1249).
- **HB25-1236** (eff. 2026-01-01) — PTSR enforcement: $2,500 per-violation penalty for refusing a qualifying portable screening report or charging an application fee when one is provided.

## 2.10 Pueblo / Denver Local Overlays

Denver is the major overlay (mandatory rental license + minimum standards). Pueblo has no equivalent rental-license program; falls back to state law plus standard property-maintenance code.

### Denver (La Maison Moderne — 917 N Kalamath, and any future Denver units)

- **Residential Rental License Program** (Denver Rev. Mun. Code Ch. 38, enacted 2021-05-03; phased through 2024-01-01). [Denver Excise & Licenses](https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Business-Licensing/Business-licenses/Residential-rental-property).
  - Required for **every residential rental** (SFR, condo, ADU, duplex, multifamily) rented for 30+ days.
  - Requires passing a certified inspection against Denver's residential rental checklist; periodic re-inspection; license valid up to 4 years.
  - Fines for unlicensed rentals raised to up to **$5,000 per violation** in late 2025.
- For-cause + state warranty apply on top.
- Source-of-income / voucher acceptance mirrors state CADA (no Denver carve-out).

### Pueblo (Casitas en Pueblo and most LTR portfolio)

- **No municipal rental-license program** as of May 2026. Pueblo Municipal Code Title XV (property maintenance) and the IPMC adopted by reference apply.
- No Pueblo just-cause / non-renewal ordinance beyond state HB24-1098.
- Rental health-and-safety enforced via Pueblo Department of Planning & Community Development and Pueblo DPHE.

**Design implication:** model jurisdiction as a first-class field on each Property and gate UI/workflows (license expiration, inspection cadence, fine schedules, license-number capture for ads) by jurisdiction. State rules are common; Denver adds licensing/inspection workflows and elevated fine exposure.

## 2.11 Sources fetched

Primary statutes and bills:
- https://leg.colorado.gov/bills/hb24-1098
- https://leg.colorado.gov/bills/HB25-1249
- https://leg.colorado.gov/bills/sb24-094
- https://leg.colorado.gov/bills/hb23-1095
- https://leg.colorado.gov/bills/sb23-206
- https://leg.colorado.gov/bills/hb20-1332
- https://leg.colorado.gov/bills/hb16-1426
- https://colorado.public.law/statutes/crs_38-12-105
- https://colorado.public.law/statutes/crs_38-12-103
- https://colorado.public.law/statutes/crs_38-12-102.5
- https://colorado.public.law/statutes/crs_13-40-107
- https://colorado.public.law/statutes/crs_13-40-104
- https://colorado.public.law/statutes/crs_38-12-803

Court / regulatory:
- https://www.coloradojudicial.gov/self-help/residential-evictions
- https://ccrd.colorado.gov/housing-discrimination
- https://www.denvergov.org/Government/Agencies-Departments-Offices/Agencies-Departments-Offices-Directory/Business-Licensing/Business-licenses/Residential-rental-property

Cross-checks (secondary):
- https://cl.cobar.org/features/significant-changes-to-landlord-tenant-law-in-2024/ (Colorado Bar Association)
- https://coloradonewsline.com/2025/05/12/housing-policies-passed-colorado-legislature/

Some `lawhelp.colorado.gov` and JDF form PDFs returned 402/403 during research; eviction-procedure timing was cross-confirmed across primary statutes, the Judicial Branch self-help index, the CO Bar Association article, and statute mirrors.

---

# Section 3 — Scale & Design Considerations

Judson's portfolio: **200+ rentable spaces across 10+ properties, multi-LLC ownership, mixed pet policies, mixed jurisdictions**. The platform must hold its quality at this scale, not just at the 5-property STR scale we've been operating at.

## 3.1 Bulk operations

- Mass invoice generation on the 1st of every month. ~200 invoices in one job. Must be idempotent; partial failures must not leave half-charged tenants. Build the rent-charge job to cap-and-resume: stamp `tenant_invoices` rows with `generation_run_id` and a status that filters out already-handled rows on retry.
- Mass communications: rent reminders (1st, 5th, 10th), building-wide notices, lease-renewal blasts. Send through a throttled queue (no Twilio / SendGrid surge above their per-second limits).
- Mass PDF generation on rent-receipt day. Reuse the photo-report PDF approach from Phase 6 (`lib/photoReportPdf.js` pattern) — generate to `platform-files`, stamp a `documents` row.

## 3.2 Search / filter / sort across large lists

- 200+ units demands real pagination. Frontend tables (`/long-term/leases`, future rent-roll) need server-side pagination with cursor or offset; never load-all.
- Common queries to index:
  - `tenant_payments` by `(due_date, status)` — for "what's due / overdue today"
  - `leases` by `(end_date, status)` — for renewal queue
  - `leases` by `(property_id, status)` — for rent roll grouped by property
  - `tenants` by `(last_name, first_name)` — for tenant search
  - `comms_threads` by `(participant, last_message_at desc)` — for inbox
- Build the indexes as part of Phase 8 even though row count is currently 0; cheap to add now, painful to add when 200 rows are in flight.

## 3.3 Permissions

The Auth/RBAC scaffolding (`capabilities`, `user_access_grants`, `user_capabilities` + `lib/permissions.js`) already exists. **Do not build a parallel LTR permissions system.** The personas:

- **Judson (super_admin)** — sees all, does all. Currently hardcoded resolver in `lib/permissions.js`.
- **Sam** — needs LTR maintenance + per-tenant comms read-only on units she covers. Existing capability catalog should already cover; verify in Phase 9.
- **Accountant (Judson's dad)** — needs the full ledger, owner reports, QB-export, but no tenant-comms or maintenance write. New capability cluster needed in Phase 14 (`finance.read.all`, `finance.export.qb`, etc.).
- **Property owner (third-party LLCs, future)** — read-only owner statements scoped to their `entity_id`. New capability + new RLS policy. Future, but Phase 8 should ensure `properties.entity_id` and `entity_stakeholders` are wired to ownership.
- **Tenant (portal user)** — must only see their own lease(s), payment history, maintenance requests. The `tenant_visible_lease` / `tenant_visible_property` views and `current_tenant_id()` resolver already exist; RLS policies need to be turned on in Phase 9.

## 3.4 Multi-owner data model

- The `entities` table (8 LLCs per CONTEXT) is the existing rollup point. Verify `properties.entity_id` (or whatever the FK is named) in Phase 8 — every owner report depends on it.
- `entity_stakeholders` exists; today it's the auth scaffold (8 stake records). Reuse for "who gets the year-end report" rather than building a new ownership-share table.
- Designing for third-party owners now means: any UI that shows an aggregate dollar figure (rent-roll totals, NOI, cap rate) must be filterable / scoped by `entity_id`, and the RBAC scope must include `entity` (it does — `user_access_grants` already has an `entity` slot per CONTEXT).

## 3.5 Per-property pet policy enforcement

- New columns on `properties`:
  - `pets_allowed boolean` (default false)
  - `max_pets smallint` (null = unlimited if allowed)
  - `pet_species_allowed text[]` (e.g. `['dog', 'cat']`; null = any)
  - `pet_weight_max_lbs numeric` (null = no limit)
  - `pet_deposit_cents integer` (default 0)
  - `pet_rent_cents integer` (default 0; per pet per month)
  - `pet_rules_text text` (free-form addendum text)
- Tenant side: add `tenant_pets jsonb` or a `tenant_pets` table holding species/breed/weight/name per pet, plus a `is_reasonable_accommodation boolean` flag (waives all pet-related fees per FHA).
- UI must enforce the property-level limits **except** when the RA flag is set.

## 3.6 Multi-channel communication preferences per tenant

- New columns on `tenants`:
  - `pref_text boolean` (default true)
  - `pref_email boolean` (default true)
  - `pref_portal boolean` (default true)
  - `pref_push boolean` (default false; future mobile)
  - `pref_default channel_pref` (text/email/portal — for "we don't know which way to reach this tenant" fallback)
- Outbound dispatcher pattern: every system message has a `category` (rent_due, maintenance_update, lease_renewal, building_notice, etc.); routing rules combine `tenant.pref_*` + category override + tenant explicit opt-out. Stamp `comms_messages.channel` for audit.
- Inbound: comms_threads is polymorphic and already supports tenant scope. Phase 15 wires Quo SMS / SendGrid Inbound Parse to the right thread.

## 3.7 Performance — critical indexes for Phase 8

```sql
-- tenant_payments hot path
CREATE INDEX ON tenant_payments (due_date, status) WHERE status IN ('due','overdue');
CREATE INDEX ON tenant_payments (lease_id, due_date);

-- leases hot path
CREATE INDEX ON leases (end_date) WHERE status IN ('active','renewing');
CREATE INDEX ON leases (property_id, status);
CREATE INDEX ON leases (primary_tenant_id);

-- tenants search
CREATE INDEX ON tenants (lower(last_name), lower(first_name));
CREATE INDEX ON tenants (lower(email));

-- comms inbox
CREATE INDEX ON comms_threads (tenant_id, last_message_at DESC);
CREATE INDEX ON comms_threads (lease_id, last_message_at DESC);
```

These are migration sketches — finalize column names in Phase 8 against actual schema.

---

# Section 4 — Surface Area Coverage Check

For each item: **Built / Partial / Missing**, with a one-line gap note.

## Core records & lifecycle

| Item | State | Gap |
|---|---|---|
| Lease records (terms, dates, rent, deposit, signed PDF) | **Partial** | Schema in (`leases`); no API, no UI, 0 rows. |
| Tenant records (linked to lease, contacts, comms prefs) | **Partial** | Schema in (`tenants`, `lease_tenants`, polymorphic `comms_*`); comms-pref columns missing on `tenants`; no API, no UI, 0 rows. |
| Lease lifecycle states (draft → active → renewing → ended) | **Missing** | `leases.status` exists; state-machine transitions, validators, and renewal workflow not built. |
| Move-in inspection | **Partial** | Reuse Phase 7a `unit_inspections` pattern; needs LTR-flavored finding categories (e.g. baseline condition, not damage). |
| Move-out inspection | **Partial** | Same Phase 7a pattern; HB25-1249 walk-through-inspection right makes this a Phase 11 must-have. |
| Security deposit tracking + return calc | **Partial** | Schema in (`security_deposits`); calc engine + walk-through-inspection link + 1-month return clock missing. |
| Rent roll report | **Missing** | No `/long-term/rent-roll` page; no API. Major Phase 14 deliverable; data model is sufficient once leases are populated. |
| Tenant ledger (running balance) | **Missing** | `tenant_invoices` and `tenant_payments` schemas exist; the "ledger view" (charges + payments + late fees + concessions in chronological balance) doesn't. View-level work for Phase 10. |

## Money in

| Item | State | Gap |
|---|---|---|
| Rent collection (Stripe ACH preferred) | **Missing** | `tenant_payments` has Stripe intent/charge ID columns and a status trigger; no Stripe integration code, no PaymentIntent or Subscription wiring. |
| Autopay setup | **Missing** | No Stripe Customer / Subscription model wired. Build under Phase 10. |
| Late fee automation | **Missing** | `leases` has late-fee config columns (rate, grace, max — verify); no scheduled job to assess late fees. CO law constrains: must be ≥ 7 days late, capped at greater of $50 or 5%, no eviction allowed for late-fee-only delinquency. |
| Partial payment handling | **Partial** | `tenant_payments.amount` and `amount_paid` split exists with status trigger; no UI to log partials. |
| Rent receipts / payment history | **Missing** | No tenant-portal UI; no PDF receipt generator (model on the Phase 6 photo-report PDF approach). |
| Pro-rated first/last month | **Missing** | Calculator + storage on `tenant_invoices.line_items` jsonb. Logic only — Phase 8/10. |

## Tenant portal

| Item | State | Gap |
|---|---|---|
| Login | **Partial** | `tenant_portal_users` table + `current_tenant_portal_user_id()` resolver exist. Frontend route doesn't exist; Supabase Auth not yet wired anywhere. |
| Pay rent / autopay | **Missing** | Phase 10 work. |
| Submit maintenance | **Missing** | `maintenance_requests.submitted_by_tenant_id` column exists; UI on tenant side doesn't. Reuse existing kanban backend. |
| View lease + rent history | **Missing** | Views exist (`tenant_visible_lease`); no UI. |
| Renter's insurance upload + expiration | **Missing** | `tenant_documents` schema fits this. Need a doc-type for `renters_insurance` + expiration tracking + nag automation. |
| Document downloads | **Missing** | Phase 6 `documents` machinery works once tenant-scope joins are added (`tenant_visible_*` views are the target). |
| Comms-preference self-management | **Missing** | Tenants page in portal needs to write to the new `tenants.pref_*` columns. |

## Tenant screening

| Item | State | Gap |
|---|---|---|
| Application form (public link) | **Missing** | `tenant_screening` schema exists; no submission endpoint. **PTSR acceptance flow is the architectural pivot, not the application form** — see § 5 Phase 12. |
| Credit / background / eviction check | **Missing** | Vendor pick: **TransUnion SmartMove (recommended)** as backstop, with PTSR acceptance as primary path. |
| Decision workflow | **Missing** | `tenant_screening.decision` column exists (assumed enum). No workflow UI. |
| Fair-housing compliance audit log | **Missing** | Required by Section 2.5. Decision criteria stored as templates, every decision stamped with the criteria evaluated; adverse-action notice must be generated. |

## Lease lifecycle automation

| Item | State | Gap |
|---|---|---|
| Renewal notices (60/90 day) | **Missing** | HB24-1098 dictates 91-day for 1+ year tenancies. Build cron + comms emit. |
| Lease amendment (rent increase) | **Partial** | `lease_rent_changes` schema exists; no UI; CO requires the amendment in writing tied to a notice document. |
| Lease end / move-out | **Missing** | Phase 11. Walk-through inspection (HB25-1249) + deposit return clock + final-statement PDF. |

## Eviction tracking

| Item | State | Gap |
|---|---|---|
| Step tracking (notice → file → judgment → writ → set-out) | **Missing** | New table `evictions` + state-machine. CO timing built into reminders. Record-keeping only, not automation. Phase 13. |

## Accounting

| Item | State | Gap |
|---|---|---|
| Income recognition per lease per month | **Missing** | Implementation path: nightly job builds expected `tenant_invoices` for the upcoming period; on payment, an entry posts to a `accounting_entries` table that's the QB-export source of truth. |
| QuickBooks export | **Missing** | **Gated on Judson's dad's QB version.** See § 5 Phase 14 for the decision tree. |
| Owner reports (multi-owner) | **Missing** | Filter / group by `entity_id`. Verify FK in Phase 8. |
| Tax-time exports (1099-MISC for owners, Schedule E support) | **Missing** | Phase 14. |

## Communication

| Item | State | Gap |
|---|---|---|
| Inbound routing to right tenant record | **Missing** | Reuse existing GuestOS pattern (`processGuestMessage` on the agent; Quo + Hostaway webhooks). LTR bridge needs `findTenant` analog of `findProperty` and a router that scopes `comms_threads.tenant_id`. Phase 15. |
| Outbound mass emails / texts | **Missing** | Throttled queue; honor channel prefs; record in `comms_messages`. Phase 9 (single-tenant) → Phase 15 (mass). |
| Per-tenant channel preferences | **Missing** | Add to `tenants` per § 3.6. |

## Marketing / vacancy

| Item | State | Gap |
|---|---|---|
| Listing syndication (Zillow, Apartments.com, etc.) | **Missing** | Out of scope for the immediate roadmap; flagged as Open Question. At 200+ units this matters; Zillow Rental Manager has a free direct posting flow, paid syndication aggregators (Tenant Turner, Showdigs, RentSpree) handle the multi-portal push. |

## Multi-owner data model

| Item | State | Gap |
|---|---|---|
| `ownership_entities` or equivalent | **Built (likely)** | `entities` table exists per CONTEXT (8 LLCs); verify `properties.entity_id` FK in Phase 8 prep. No need for parallel structure unless we introduce ownership shares (not in scope). |

---

# Section 5 — Phase Sequencing Proposal

## 5.0 Default sequence

| # | Phase | One-line | Build complexity |
|---|---|---|---|
| 8 | LTR core records | Schema polish (pet policy, comms prefs, indexes) + finish `/api/leases` and `/api/tenants` + multi-owner FK verify + move-in/out inspections | **Large** |
| 9 | Tenant portal MVP | Login, lease view, rent due, payment history (read-only first), maintenance submit, comms-pref self-management | **Large** |
| 10 | Rent collection | Stripe ACH, autopay, late-fee automation (CO-compliant), receipts, tenant ledger | **Large** |
| 11 | Lease lifecycle | Renewals, amendments, end-of-lease, walk-through, deposit return, CO notice timing | **Medium** |
| 12 | Tenant screening | PTSR acceptance flow + SmartMove backstop, application form, decision workflow, fair-housing audit log | **Medium** |
| 13 | Eviction tracking | CO-aware step tracking, notice document generation, court-date reminders | **Small** |
| 14 | Accounting | Income recognition, QB export (decision-tree-gated), multi-owner reports, rent roll, Schedule E | **Large** |
| 15 | Inbound comms routing | Calls / texts / emails routed to tenant comms_threads (reuse GuestOS pattern) | **Medium** |
| 16 (optional) | Listing syndication | Zillow + Apartments.com posting, vacancy management | **Medium** |

## 5.1 Phase 8 — LTR core records

**Goal:** unblock every downstream phase. Foundation only; no tenant-facing UI yet beyond the existing detail pages.

**Ships:**
- **Schema additions (additive migration):**
  - `tenants.pref_text/email/portal/push boolean`, `tenants.pref_default text` (channel)
  - `properties.pets_allowed/max_pets/pet_species_allowed[]/pet_weight_max_lbs/pet_deposit_cents/pet_rent_cents/pet_rules_text`
  - `properties.jurisdiction text` (e.g. `pueblo_county`, `denver_county`) — gate Denver license workflows
  - `properties.for_cause_exempt boolean` + `for_cause_exempt_reason text` — HB24-1098 routing
  - `properties.built_year integer`, `properties.radon_results jsonb`, `properties.meth_remediation_certified boolean` — disclosure feeds
  - `tenant_pets` table (or `tenants.pets jsonb`) with `is_reasonable_accommodation`
  - Hot-path indexes (§ 3.7).
- **API endpoints:**
  - `GET/POST /api/leases`, `GET/PATCH/DELETE /api/leases/[id]`
  - `GET/POST /api/tenants`, `GET/PATCH/DELETE /api/tenants/[id]`
  - `GET /api/long-term/rent-roll` (data shape only — UI is Phase 14 but the endpoint can ship now)
  - `GET /api/properties/[id]/leases` (sub-route for property page)
- **UI:**
  - Wire `/long-term/leases` to the new endpoints (kill the empty stub).
  - LeaseDetail page `/long-term/leases/[id]` — basic facts, primary tenant, status, doc link.
  - TenantDetail page `/long-term/tenants/[id]` — basic facts, leases, comms prefs, pets.
  - "New lease" wizard creating tenant + lease + lease_tenants + security_deposits in one transaction.
  - Move-in inspection (port Phase 7a `unit_inspections` flow with `inspection_subtype='ltr_move_in'`).
  - Property page extension: "LTR Tenants" tab listing current and historical leases.
  - Sidebar cleanup: convert dead 404 entries to either StubPage or remove.
- **Multi-owner verification:**
  - Confirm `properties.entity_id` FK exists; if missing, add as additive migration.
  - Sanity-check that `entity_stakeholders` covers third-party owner case.

**Depends on:** nothing; foundation phase.

**Risks:**
- Migrating existing properties to new pet/jurisdiction defaults is data work — make defaults sensible (`pets_allowed=false`, `jurisdiction=pueblo_county`) and let Sam/Judson update via UI.
- The schema is currently empty so additive migrations are free; validate `org_id` is set on all new rows.

## 5.2 Phase 9 — Tenant portal MVP

**Goal:** tenants can log in, see their lease + balance, submit maintenance, manage comms prefs.

**Ships:**
- **Auth wiring:** Supabase Auth on the frontend; new sign-up flow gated to invited tenants (`tenant_portal_users.is_active`); password + magic-link.
- **RLS turn-on:** enable RLS on `leases`, `tenant_payments`, `tenant_invoices`, `tenant_documents`, `comms_threads`, `comms_messages`, `tenant_visible_*` views' source tables, scoped via `current_tenant_portal_user_id()`. **This is the first time RLS goes live on any platform table** — coordinate with the rest of CONTEXT.md's Auth/RBAC section.
- **UI:** `/tenant-portal/login`, `/tenant-portal/dashboard` (lease summary + balance + next due date + last payment), `/tenant-portal/lease`, `/tenant-portal/payments` (history, no pay-now button yet — Phase 10), `/tenant-portal/maintenance` (list + new request reusing existing `maintenance_requests` table), `/tenant-portal/documents` (download lease, receipts), `/tenant-portal/preferences` (comms prefs).
- **API:** `/api/tenant-portal/me`, `/api/tenant-portal/lease`, `/api/tenant-portal/payments`, `/api/tenant-portal/maintenance` (POST), `/api/tenant-portal/preferences` (PATCH).

**Depends on:** Phase 8 schema + lease/tenant data exists.

**Risks:**
- RLS enablement is platform-wide cautious work — start with LTR tables only, leave STR / construction / SWPPP RLS off for now.
- Magic-link delivery via SendGrid (already configured? — verify; if not, add as a sub-task).
- Tenant onboarding emails: invite token flow (similar to existing field-log routing tokens).

## 5.3 Phase 10 — Rent collection

**Goal:** ACH payments live, autopay opt-in, automated late fees within CO caps, full ledger.

**Ships:**
- **Stripe wiring:**
  - Stripe Connected Accounts per LLC (KYB collection workflow). **See Open Question on Stripe topology.**
  - Stripe Customer per tenant (linked to `tenants.stripe_customer_id` — new column).
  - PaymentIntents for one-time rent charges; Subscriptions for autopay (one Subscription per `lease`).
  - Plaid Financial Connections for bank-account link (instant, lower R10 risk than microdeposits).
  - Webhook handler for `payment_intent.succeeded` / `.payment_failed` / `customer.subscription.updated` updating `tenant_payments`.
  - `tenant_payments.method=stripe_ach`, `stripe_payment_intent_id`, `stripe_charge_id` already in schema.
- **Late-fee scheduler:**
  - Daily cron (Vercel `/api/cron/assess-late-fees`) iterating `tenant_payments` where `due_date <= now() - interval '7 days'` AND `status='due'` AND no late fee yet logged.
  - Compute fee = max($50, 0.05 × past_due_amount), capped per `leases.late_fee_cap` if set, never charging on subsidy portion.
  - Insert `tenant_invoices` row with `type='late_fee'` and a back-reference; comm out via tenant prefs.
- **Tenant ledger view:** chronological merge of charges + payments + concessions + late fees with running balance; basis for tenant-portal `/payments` page and admin rent-roll details.
- **Pay-now button:** `/tenant-portal/payments/[id]/pay` initiates a Stripe PaymentIntent; success redirects with confirmation.
- **Rent receipt PDF:** generated on payment success (model on Phase 6 photo-report PDF approach), uploaded to `platform-files`, `documents` row created with `subsection='rent_receipt'`.

**Depends on:** Phase 8 (lease/tenant exist), Phase 9 (portal exists for pay-now).

**Risks:**
- ACH dispute window is **60 calendar days**; build R10/R07 reversal handling early. Stripe webhook handles status flip; UI should show reversed payments distinctly.
- Stripe Connected Account KYB per LLC takes 1–2 weeks of back-and-forth — start before code work.
- Reconciliation between Stripe statements and `accounting_entries` (Phase 14) needs to be designed now even if not built.

### 5.3.x Vendor research — Stripe ACH baseline + alternatives

> Volume context: ~200 units × $1,500 avg = $300K/month, ~$3.6M/year, ~2,400 ACH pulls/year.

**Option 1 — Stripe ACH (RECOMMENDED).** 0.8% capped at $5.00 per transaction (confirmed current as of 2026). On a $1,500 rent payment: **$5.00**. At $300K/mo = **~$1,000/mo, $12,000/yr** in fees. Best-in-class API + SDKs + Plaid Financial Connections; T+4 standard, T+2 Faster Payouts (no extra cost when eligible). Disputes: 60-day window for personal accounts, $15 dispute fee. Source: https://stripe.com/pricing , https://docs.stripe.com/ach .

**Option 2 — GoCardless US.** 0.5% + $0.05 capped at $5.00 (Standard tier). On $1,500: **$5.00 (cap binds — same as Stripe)**. Same per-transaction cost at this volume; smaller US ecosystem; mandate-centric model fits recurring rent well. Standalone reason to switch: negotiated fixed-fee paths at higher volume. Source: https://www.gocardless.com/en-us/pricing/ .

**Option 3 — Modern Treasury.** Contact-sales pricing; meaningful only at 1,000+ units or $5M+/mo. Skip for now.

**Skipped:** Dwolla (contact-sales, weak docs); Forte/CSG (sales-gated); Plaid Auth + Dwolla (strictly worse than Stripe at this scale); direct NACHA (no ODFI access at our volume).

**Recommendation:** stay on Stripe ACH. ~$12K/year on $3.6M of rent flow (33 bps blended) is good. Revisit only if volume scales to where Modern Treasury or GoCardless can drop to flat $0.50–$1.50/payment via negotiation.

## 5.4 Phase 11 — Lease lifecycle

**Goal:** renewals, amendments, end-of-lease workflows, all CO-notice-compliant.

**Ships:**
- **Renewal queue:** `/long-term/renewals` page listing leases by `end_date` window. Auto-suggest 91-day, 60-day, 30-day reminders for HB24-1098-protected tenancies; non-protected tenancies use lease-defined notice. Generate JDF 99 B / 99 C draft documents with the right notice period filled in.
- **Rent-increase amendment flow:** modal on lease detail; writes a `lease_rent_changes` row + a generated notice document; updates `leases.monthly_rent_cents` effective the next billing cycle. Track the `notice_document_id` for evidentiary purposes.
- **End-of-lease:** terminate workflow — generates final statement (last month rent + utilities + late fees - deposit applied), schedules walk-through inspection (HB25-1249 right), kicks deposit-return clock (1 month statutory; up to 60 days if lease specifies).
- **Bilingual habitability statement injector:** every new lease document generated must include the SB24-094 English+Spanish habitability-notice block.
- **Disclosure injector:** lead-paint + radon attached automatically based on `properties.built_year` and `properties.radon_results`.

**Depends on:** Phase 8 schema (notice fields, exemption flag).

**Risks:**
- Document generation engine — likely an HTML-to-PDF approach reusing Phase 6's pattern. Template versioning matters (CO statutory text changes; track which template version was used for each lease).
- Walk-through inspection vs Phase 7a `unit_inspections` semantics: extend, don't fork.

## 5.5 Phase 12 — Tenant screening (PTSR-first)

**Goal:** legally compliant screening flow, primarily PTSR-accepting, with TransUnion SmartMove as backstop for applicants without a portable report.

**Ships:**
- **Public application form:** `/apply/[propertyId]`, mobile-first, captures applicant info + selects "I have a PTSR to upload" vs "Run a screening for me."
- **PTSR upload + verification path:** uploaded PDF goes to `documents`, parsed with manual spot-check; landlord may not charge any application fee on this path. Status flows: `submitted → reviewed → approved | conditional | denied`.
- **SmartMove fallback path:** applicant pays directly via SmartMove web flow ($25–$48 depending on tier), result returned as PDF to `documents`, our `tenant_screening` row stamped with the SmartMove report ID.
- **Decision workflow UI:** review screen showing report + landlord-defined criteria (income multiplier, credit floor, eviction lookback, criminal lookback) with checkbox-per-criterion. Decision generates an audit row stamped with criteria evaluated.
- **Adverse-action notice generator:** mandatory for any "denied" or "conditional" decision; emits a templated PDF with the screener's CRA contact info; sent via the tenant's chosen channel.
- **Source-of-income compliance:** income-multiplier math counts only the tenant-paid portion of voucher rent.

**Depends on:** Phase 8 (schema), Phase 10 (Stripe Customer creation if applicant becomes tenant), Phase 11 (decision-to-lease conversion).

**Risks:**
- **PTSR is a legal requirement, not an option** — opting out requires accepting only one application at a time per unit and refunding within 20 days, which is operationally clunky. Default to opting in. **See Open Question.**
- FCRA compliance: SmartMove's applicant-pays model keeps you out of CRA-reseller territory. Don't switch to a Checkr-style API stack without legal review.

### 5.5.x Vendor research — Tenant screening shortlist

> CO context: HB23-1099 + HB25-1236 (eff. 2026-01-01) require landlords to accept PTSRs <60 days old and forbid charging application/screening fees when one is provided. Penalty $2,500 per violation.

**Option 1 — TransUnion SmartMove (RECOMMENDED for backstop).** Applicant-pays. SmartCheck Basic $25, Plus $40, Premium $48 (incl. Income Insights). No public API — hosted web flow, deep-link the applicant out and ingest the result PDF. US-wide incl. CO. Trade-off: no programmatic embed; landlord handles adverse-action notice. Source: https://www.mysmartmove.com/pricing .

**Option 2 — CoreLogic / Cotality MyRental.** Basic ~$25, Premium ~$38 per applicant. Same web-flow architecture as SmartMove, no public API for our scale. Slightly cheaper; lower brand recognition with renters. Source: https://www.myrental.com/ , https://www.myrental.com/pricing .

**Option 3 — Checkr + Plaid Income (composed).** ~$63 all-in per applicant (Checkr Essential $54.99 + credit add-on $8 + Plaid Income $1.50–$3 + eviction vendor $5–$15). Real APIs, structured JSON in our DB. Trade-offs: most expensive; CRA-reseller credentialing required for Checkr's credit add-on; **no clean Checkr-only eviction data — gap requires a third vendor (LexisNexis ResidentVerify, CIC, RealPage)**. Source: https://checkr.com/pricing , https://docs.checkr.com/ , https://plaid.com/products/income/ .

**Recommendation:** start with SmartMove as backstop + PTSR-first acceptance. At ~30–50 applicants/year the engineering and compliance lift of Checkr+Plaid+eviction-vendor isn't worth it. Re-evaluate at 500+ units.

## 5.6 Phase 13 — Eviction tracking

**Goal:** record-keeping for the FED process, with CO-aware reminders. **No automation of the legal process itself.**

**Ships:**
- New `evictions` table: `lease_id`, `notice_type` (pay_or_quit | substantial_violation | for_cause_no_fault | other), `notice_served_at`, `cure_deadline`, `complaint_filed_at`, `summons_hearing_date`, `judgment_at`, `writ_issued_at`, `set_out_at`, `status` (notice_served | filed | judgment_entered | writ_issued | resolved | dismissed), `resolution` (paid_in_full | tenant_vacated | judgment_entered | dismissed | settled), `notes`, `org_id`.
- `eviction_documents` join (links to `documents` for JDF 99/101/102/103/109 PDFs).
- UI: `/long-term/evictions` queue, `/long-term/evictions/[id]` detail with state-machine transitions.
- Timing reminders: notice expiration → file complaint; judgment entered → writ available; writ → 48-hour set-out clock.
- **No court e-filing integration** (Colorado state e-filing for FED is complicated and not worth the build).

**Depends on:** Phase 11 (notice document generation reused).

**Risks:**
- Statutory timing miscounted = wrongful eviction exposure. Use date-math libraries (no manual day counting) and unit-test against the HB24-1098 examples.
- Pueblo County and Denver County may have different scheduling rhythms; surface as a property-level setting, not platform-wide.

## 5.7 Phase 14 — Accounting

**Goal:** clean monthly export to QuickBooks, multi-owner rent roll, owner statements, Schedule E support.

**Ships:**
- **Income recognition engine:**
  - Nightly job materializes expected `tenant_invoices` for the upcoming period per active lease.
  - On payment success (Phase 10 webhook), insert into `accounting_entries` (new table): account, debit/credit, amount, date, lease_id, entity_id, source (rent_payment | late_fee | concession | deposit_collected | deposit_returned).
  - GL accounts mapped to the LLC's QB chart of accounts via `entity_qb_account_map`.
- **Rent roll:** `/long-term/rent-roll` filters by entity / property / status; columns = property, unit, tenant, rent, lease end, last payment, balance due, status. CSV export.
- **Owner reports:** `/long-term/owners/[entityId]/statement?period=YYYY-MM` — month / quarter / year aggregations of rent received, expenses applied (from `project_expenses` LTR-tagged), distributions, year-over-year. PDF + CSV.
- **QB export:** decision-tree-gated:
  - **If QBO:** OAuth grant per LLC → REST API push of Invoice / Payment / JournalEntry on a "post" button or nightly cron.
  - **If QBD 2024+:** generate per-LLC monthly CSV → dad runs SaasAnt Transactions Desktop (~$30/mo).
  - **If QBD <2024 with full IIF:** generate IIF files; pre-import validation report listing every account/customer name; dad imports and manually applies payments.
- **Schedule E support:** annual report per entity with categories matching IRS Schedule E lines (rents received, advertising, auto, cleaning/maintenance, commissions, insurance, legal, management fees, mortgage interest, repairs, supplies, taxes, utilities, depreciation note).
- **1099-NEC / 1099-MISC:** generation for owner distributions to third-party owners (when applicable). Year-end batch.

**Depends on:** Phase 8 (multi-owner FK), Phase 10 (payment events feed entries), Judson's dad confirms QB version.

**Risks:**
- Chart-of-accounts mismatch between platform and QB is the #1 export-failure mode. Pin a `qb_account_id` per entry source rather than relying on name matching.
- QB export design is the **most important phase to lock the data shape on** — once dad starts using monthly exports, retrofitting is painful.

### 5.7.x Vendor research — QuickBooks export

> Gating question: Which QB version does Judson's dad use? Decision tree below.

**Option 1 — QuickBooks Online REST API (BEST CASE).** Free with any QBO sub. OAuth 2.0 + refresh tokens (100-day TTL). Rate limits: 500 req/min, 10 concurrent, 40/min batch (new 120/min effective 2025-10-31). Map: tenant → Customer, rent charge → Invoice, ACH receipt → Payment (linked to Invoice), late fee → Invoice line item, owner distribution → Bill or JournalEntry. Source: https://developer.intuit.com/app/developer/qbo/docs/get-started , https://help.developer.intuit.com/s/article/API-call-limits-and-throttling , https://blogs.intuit.com/2025/08/13/upcoming-changes-to-the-accounting-api/ .

**Option 2 — IIF Import (QBD only, post-2018 with restrictions).** Free. Tab-delimited flat-file format. Current 2026 status: still works for invoices, payments, bills, checks, deposits, credit-card charges, journal entries. **Cannot import directly into AR accounts** — must flow through Invoice/Payment objects. Vendor/account names must match exactly or QBD silently dups. Auto-link of invoice → payment doesn't happen on import — manual application required. Sources: https://quickbooks.intuit.com/learn-support/en-us/help-article/import-export-data-files/export-import-edit-iif-files/L56LT9Z0Q_US_en_US , https://quickbooks.intuit.com/learn-support/en-us/help-article/list-management/iif-overview-import-kit-sample-files-headers/L5CZIpJne_US_en_US .

**Option 3 — SaasAnt Transactions (paid bridge for QBD or QBO).** $15–$100/mo QBO, $25–$125 QBD; mid-tier ~$30–50/mo at our volume. Imports CSV/Excel/IIF; better dedup, AR-account handling, and auto-link than raw IIF. Manual monthly step but smoother. Source: https://www.saasant.com/app-saasant-transactions-quickbooks-automation , https://www.saasant.com/app-saasant-transactions-quickbooks-desktop .

**Skipped:** QBXML / Web Connector (Windows-host requirement, heavy); Transaction Pro Importer / BRC (functionally equivalent to SaasAnt).

**Recommendation:** drive dad to QBO if at all possible — only end-state that's genuinely automated. Otherwise: QBD 2024+ → CSV + SaasAnt; QBD <2024 → IIF + pre-import validation report. Get the version answer before writing any code in this lane.

## 5.8 Phase 15 — Inbound communication routing

**Goal:** texts, calls, and emails from tenants land in the right `comms_threads.tenant_id`.

**Ships:**
- Reuse the existing GuestOS `processGuestMessage` pattern (CasitasEnPueblo-Agent server).
- New `findTenant(phone, email)` mirror of `findProperty`, scoped to LTR.
- Quo SMS / Twilio inbound routes call the agent's webhook; agent identifies `tenant_id` and posts to `comms_messages`.
- SendGrid Inbound Parse for tenant emails to a property mailbox (e.g. `tenants@guestos-ops.vercel.app` or per-property aliases).
- Tenant-portal inbox `/tenant-portal/inbox` (read + reply); admin inbox at `/long-term/inbox`.

**Depends on:** Phase 9 (portal exists), Phase 10 (tenants can identify themselves via login link).

**Risks:**
- Phone-number disambiguation: a tenant's phone might match multiple records if they've been a guest before (STR overlap). Build the matcher to prefer LTR-scoped matches.

## 5.9 Phase 16 (optional) — Listing syndication

**Goal:** outbound marketing for vacancies. Out of scope for the immediate roadmap unless turnover demands it.

**Ships (sketch):**
- Listing record per vacant unit (photos, description, rent, available date, screening criteria).
- Zillow Rental Manager direct posting (free).
- Aggregator integration (Tenant Turner, Showdigs, RentSpree) for paid push to Apartments.com, Trulia, etc.

**Open Question:** is this in scope for the LTR initiative or out?

---

# Section 6 — Open Questions for Judson

These are the questions the audit can't answer without input. Resolve before kicking off the relevant phase.

## Phase-gating (resolve before Phase 8 starts)

1. **What's the multi-owner story?** `entities` (8 LLCs) is set up for *your* family of LLCs. Will third-party owners ever onboard, or is this only Judson Properties and DuraCo / Casitas / Bear River / etc.? If third-party, Phase 8 should plan reporting / portal access scoping; if not, the entity table stays as-is.
2. **What QuickBooks version does your dad use?** QBO / QBD 2024+ / QBD older. Gates Phase 14 design entirely. *5-minute call before writing code.*
3. **PTSR opt-in or opt-out?** CO law lets you opt out of accepting portable reports if you accept only one application at a time per unit and refund within 20 days. Opting in is operationally simpler and cheaper for applicants; opting out gives you control over screening data quality. Decide before Phase 12.

## Policy decisions (resolve when relevant phase opens)

4. **Existing leases — are there any in Excel today with non-standard terms (different late-fee structures, different grace periods, custom pet rules) that need to be encoded as exceptions in Phase 8?** Or are they all reasonably standard?
5. **Renter's insurance — required of all tenants, or property-specific?** Affects the doc-required mechanism (Phase 6 templates) and the portal-side upload UI (Phase 9).
6. **Default tenant communication preference** — if a new tenant doesn't set one, is the default "all three" (text + email + portal) or "email only"?
7. **Court jurisdiction(s) for evictions** — Pueblo County is primary; will Denver County (La Maison Moderne) ever host an LTR eviction (the property is currently your personal home reno per CONTEXT, but will it become a rental)? Affects Phase 13 reminder timing.
8. **Stripe Connect topology** — separate Connected Account per LLC (clean, but each needs full KYB) vs. single account with metadata-tagged routing (faster, but commingles funds and 1099-K issuance gets messy). Recommend separate-per-LLC; need your call before Phase 10.
9. **Who pays for screening?** Applicant-pay (SmartMove default, easy) vs landlord-pay (~$48 × ~40/year ≈ $1,900/yr). Both work; preference?
10. **Is income verification mandatory or only when the SmartMove report flags?** Affects Phase 12 cost (Premium $48 vs adding Plaid Income on top).

## Out-of-scope confirmation

11. **Listing syndication (Zillow, Apartments.com)** — in scope as Phase 16, or out of scope entirely for the initial LTR initiative? At 200+ units this will eventually matter; just confirming we're not building it now.
12. **Excel-to-platform data migration** — explicitly out of scope per your prompt; Phase 8 ships a greenfield system. Confirming there's no plan to bulk-import the current Excel-tracked LTR portfolio into the platform until later (and that "later" might be never — manual entry per tenant onboarding).
13. **Adverse-action notice delivery channel** — neither SmartMove nor MyRental auto-deliver these. Build as a templated email in the platform with the screener's CRA contact info populated? Or do you want printable + mailable PDF too (legally required when a paper application is the source)?

---

## Appendix A — Out of this audit but flagged for visibility

- **Sidebar dead links:** the `/long-term/property-tax`, `/long-term/insurance`, `/long-term/utilities`, `/long-term/financials`, `/long-term/maintenance`, `/long-term/vendors` items all 404 today. Cross-module pages exist for property-tax and insurance — sidebar should redirect or rewrite, not 404. Could be a small cleanup PR independent of this LTR roadmap.
- **`comms_thread_inbox` view source:** unknown without reading the SQL; recommend inspecting before Phase 9 to confirm it's the right read source for the inbox UI.
- **Existing `tenant_payments_effective` view:** likely the canonical source for "current state" reads; should be the basis for the tenant ledger in Phase 10 rather than re-deriving.
- **RLS turn-on in Phase 9** is the platform's first RLS enablement; coordinate with the broader `lib/permissions.js` migration noted in CONTEXT.md ("Once Supabase Auth is wired into the frontend, swap with the real session lookup").
