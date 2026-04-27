# Construction Module — Drop-in Bundle for Guestos-ops

Generated April 27, 2026.

## What this is

This bundle adds the **construction project management module** to your existing `Guestos-ops` Next.js app. It includes:

- 2 new pages: `/construction` and `/contacts`
- 8 new API route files
- 3 new files in `lib/` (Supabase clients + permission helper)

The database is already deployed (markets, owners, entities, capabilities, projects, subcontracts, inspections, swppp_logs, etc.). This bundle is the UI + API on top of it.

---

## Install — one time

1. Unzip this folder.
2. Drop the contents into the **root** of your `C:\Users\jjager\Desktop\Guestos-ops` folder. The folder structure mirrors what already exists — files will land in `lib/`, `app/api/`, `app/construction/`, `app/contacts/`. Nothing existing should get overwritten (no shared filenames).
3. From a Command Prompt in `Guestos-ops`:
   ```
   cd C:\Users\jjager\Desktop\Guestos-ops
   npm install @supabase/supabase-js
   ```
   (Skip if already installed.)
4. Verify your `.env.local` (and Vercel env vars) include:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the new `sb_publishable_...` key)
   - `SUPABASE_SERVICE_ROLE_KEY` (the new `sb_secret_...` key)
5. Push to GitHub:
   ```
   git add lib app/api app/construction app/contacts
   git commit -m "Add construction module + contacts page"
   git push
   ```
6. Vercel auto-deploys.

---

## What you can do once it's live

- Visit **`/construction`** → see the Aurora Warehouse project (already in DB), click into it.
- Visit **`/contacts`** → empty rolodex. Add subs, inspectors, and engineers as you onboard them. Each contact tagged Pueblo or Aurora (or both).
- Inside the project page:
  - **Subcontracts** tab — add the subs you've signed
  - **Inspections** tab — schedule and mark complete
  - **SWPPP** tab — log routine inspections, rain events, BMP work
  - **Contacts** tab — see the rolodex filtered to the project's market

## What's intentionally not in this bundle

- **Auth.** Until Supabase Auth is wired up, the API routes treat every request as coming from you (Judson, super_admin). This is fine because you're the only user. **Do not put this URL on a public link or share it externally.**
- **Settings UI.** The capabilities database is set up (62 toggles seeded), but the UI to flip them per user comes in a later push. Only matters when other users log in.
- **Documents upload.** Schema exists; upload UI doesn't yet. Use the existing Supabase storage you've got going for now.
- **Gantt views, charts, dashboards.** Lists first, polish later.
- **Weekly SWPPP report agent.** Comes after you've used the data layer for a few days.

## Known issues / decisions

- Styling is intentionally minimal (system fonts, no Tailwind even though you have it). Prioritized shipping over polish. Easy to restyle later.
- The `currentUserId()` function is hard-coded to your email. **One line to change** when auth lands (`lib/permissions.js`).
- Modals are basic; no toast notifications. Errors come through `alert()`. Will be upgraded.

## Files in this bundle

```
lib/
  supabaseServer.js          (server-side client, uses sb_secret_)
  supabaseClient.js          (browser client, uses sb_publishable_)
  permissions.js             (canUserDo helper, currentUserId, visibleEntityIds)

app/api/projects/
  route.js                   (GET list, POST create)
  meta/route.js              (entity + market dropdowns)
  [id]/route.js              (GET detail, PATCH update)

app/api/subcontracts/
  route.js                   (GET list, POST create)
  [id]/route.js              (GET, PATCH, DELETE)

app/api/inspections/
  route.js                   (GET list, POST create)
  [id]/route.js              (PATCH, DELETE)

app/api/swppp/
  route.js                   (GET list, POST create)
  [id]/route.js              (PATCH, DELETE)

app/api/contacts/
  route.js                   (GET list, POST create)
  [id]/route.js              (PATCH, DELETE)

app/api/companies/
  route.js                   (GET list, POST create)
  [id]/route.js              (PATCH, DELETE)

app/construction/
  page.js                    (project list + new-project modal)
  [id]/page.js               (single-project detail with 5 tabs)

app/contacts/
  page.js                    (contacts + companies tabs)
```

## After deploy: try this

1. Open `https://guestos-ops.vercel.app/construction` — should show the Aurora Warehouse.
2. Click into it.
3. Add a subcontract (any sub you've signed for the warehouse).
4. Schedule an inspection (e.g., "foundation" with City of Aurora).
5. Add a SWPPP entry for last week.
6. Open `/contacts` and add the GC and a few subs.

If anything breaks, check Vercel function logs first, then send me the error.

---

**Next push (when you say go):**
- Settings UI for managing capabilities per user
- Documents upload
- Weekly SWPPP report agent (the Claude-powered one)
- Auth wiring + RLS
