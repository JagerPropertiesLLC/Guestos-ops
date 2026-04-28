# Duraco Platform — v2 Bundle (Sidebar Shell + Insurance + Schema Expansion)

Generated April 27, 2026.

## What's in this push

**Database (already applied to Supabase):**
- 12 new tables: `policies`, `coi_records`, `permits`, `licenses`, `property_taxes`, `utility_accounts`, `utility_bills`, `tenants`, `leases`, `lease_tenants`, `tenant_screening`, `security_deposits`, `reminders`, `automations`, `house_manuals`
- Drive folder linking added to `entities`, `properties`, `projects` (optional `drive_folder_id` and `drive_folder_url` columns)
- 4 automations pre-seeded: weekly_swppp_report, coi_renewal_request, expiration_scanner, rent_collection_check (all DISABLED until you enable them)
- New entity: Kalamath (your personal home, no LLC)
- New property: Kalamath at 901 N Kalamath St, Denver
- New project: Kalamath Renovation (active)
- Stakeholder: Judson 100% of Kalamath

**UI:**
- Brand new rail+panel sidebar (replaces top nav)
- Real Dashboard at `/dashboard` with live signals
- Insurance global view at `/insurance` (the first cross-cutting feature)
- 14 stub pages for Calendar, Inbox, Tasks, Maintenance, Property Tax, Reports, Settings, plus all sub-views inside Short Term, Long Term, and Construction modules
- All wired into the new shell

## ⚠️ Important — this REPLACES your `app/layout.js`

The new `app/layout.js` adds the sidebar shell to every page. If you had a custom layout, **back it up first**. Most likely you didn't — Next.js generates a default one — so this is a safe overwrite.

Your existing pages (`/schedule`, `/approvals`, `/construction`, `/contacts`) will all still work, just inside the new shell.

---

## Install

1. **Unzip** this bundle.
2. **Drop the contents into your `Guestos-ops` folder.** The folders mirror your project — files will merge in.
   - `app/layout.js` — **OVERWRITES** (back up if customized)
   - `app/page.js` — **OVERWRITES** (only redirects to /dashboard, very small file)
   - All other files are NEW (no overwrites)
3. **Commit and push**:
   ```
   git add app components
   git commit -m "v2: rail+panel sidebar, dashboard, insurance, expanded schema UI"
   git push
   ```
4. Vercel auto-deploys.

## After it goes live

Visit `https://guestos-ops.vercel.app/`

You should land on the new dashboard. Click around the rail (left edge) to navigate. Short Term, Long Term, Construction each open a panel with sub-nav.

**What works fully:**
- Dashboard with live data
- Insurance view (will show empty since no policies yet — try adding one in Supabase to see it populate)
- Construction → still works (warehouse + Kalamath both visible)
- Contacts → still works

**What's stubbed (visible but says "being built"):**
- Calendar, Inbox, Tasks, Maintenance, Property Tax, Reports, Settings
- All sub-pages inside Short Term and Long Term (except properties list)

## Files in this bundle

```
app/
  layout.js                       (NEW root layout w/ sidebar)
  page.js                         (redirect → /dashboard)
  dashboard/page.js               (real dashboard)
  insurance/page.js               (insurance global view)
  short-term/page.js              (STR landing)
  long-term/page.js               (LTR landing)
  calendar/page.js                (stub)
  inbox/page.js                   (stub)
  tasks/page.js                   (stub)
  maintenance/page.js             (stub)
  property-tax/page.js            (stub)
  reports/page.js                 (stub)
  settings/page.js                (stub)
  api/
    dashboard/route.js            (dashboard signals)
    insurance/route.js            (policies + COIs)
    sidebar-nav/route.js          (sidebar property/project list)

components/
  AppShell.js                     (rail + panel layout)
  StubPage.js                     (reusable stub)
```

## Known limitations

- **Auth still hard-coded.** Same as v1 — every request acts as Judson super_admin. Don't share the URL externally yet.
- **No styling library.** Uses inline styles + a couple of constants. Will move to Tailwind or a system later. Not pretty, but consistent.
- **The old top nav is gone.** Only the rail navigation now. If you had bookmarks to specific old paths, they should still work (we didn't change page paths, only the layout that wraps them).
- **Mobile responsiveness is not addressed yet.** Desktop-first; sidebar will look cramped on mobile. We'll add a mobile menu in a later push.

## Next session moves (in order)

1. **Backfill warehouse data** — add the GC, signed subs, scheduled inspections, SWPPP entries
2. **Build SWPPP report agent** — the high-leverage automation
3. **Wire up the COI renewal automation** — the second high-leverage automation, especially valuable as you onboard subs for the warehouse
4. **Auth + RLS** — gate this on real users actually needing to log in (Dad, Wendy, Sam)
5. **Calendar** — unified event view
6. **CRM** — unified rolodex (you already have most of this; just needs better UI)
7. **Vendor / sub portal** — biggest upcoming build

If anything breaks on first deploy, the most likely cause is again env vars or path aliases. We learned this last time — `jsconfig.json` should already be in place from the v1 push.
