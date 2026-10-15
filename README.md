# Hybrid Combative Academy & Gym

Responsive Next.js App Router, TypeScript, Tailwind CSS and Supabase membership management for Hybrid DD and future branches.

## Run locally

Use Node.js 20.12 or newer:

```sh
npm install
npm run dev
```

Open http://localhost:3000. This is a live-only application: configure Supabase before use and sign in with an authorized staff account. If connection settings are missing, the app shows a setup-required screen. Member records are never saved to browser demo storage. Old demo data is neither loaded nor deleted; migrate any records you want to keep separately.

On Windows PowerShell where script execution is disabled, use `npm.cmd` instead of `npm` (for example, `npm.cmd run dev`).

## Supabase setup

1. Create a Supabase project. For a new empty database, run `supabase/START_HERE.sql` once in the SQL editor. It combines the schema, permissions and academy pricing. Alternatively, run `supabase/schema.sql` followed by `supabase/002_academy_pricing.sql`. Do not run both setup methods against the same database. Existing installations needing the pricing update should run only `002_academy_pricing.sql`.
2. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from your project's Connect dialog. The legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` is supported as a fallback. Only a public publishable/anon key belongs here. No service-role key is used. `.env.local` is excluded from Git and must be configured separately on each installation.
3. Create your first staff user in Supabase Authentication. Copy the user's UUID and run the bootstrap INSERT at the bottom of the schema with your own name and email. Keep public self-signup disabled for this staff application.
4. Restart Next.js. Sign in with that account. Live mode starts with the DD branch, advertised class plans and no fabricated member records. Review capacity and class end times, then register or import members. Prices: RM170/month for Boxing, Kickboxing, MMA, Muay Thai, Tae Kwon Do (ITF) and Brazilian Jiu-Jitsu; RM190/month for Jeet Kune Do & Kali. Body Building and Arm Wrestling are enquiries because no price was supplied. End times and unlisted coaches are left unconfirmed; class capacity starts at an editable default of 24.
5. To add staff, create their Auth account in Supabase, then use Staff → Grant access with their UUID. This avoids exposing privileged Auth administration credentials to the browser. Supabase handles password reset/account recovery through its configured Auth flows; the app currently provides password sign-in and sign-out.

Run `node scripts/check-supabase.mjs` to check the configured project's authentication endpoint and anonymous table responses without printing keys or member records. Empty results on an empty table alone do not prove RLS is correct; verify signed-in role permissions and save/reload a test member before operational use.

## Features

- Dashboard with membership statistics, growth, status distribution, expiry queue, recent registrations, renewals and outstanding payment records.
- Member registration, editing, profiles, class enrollment, attendance check-in, medical/general notes and searchable records.
- Configurable branch-specific plans and classes, capacity limits and class archiving.
- Renewal transactions append memberships, renewal links and payments without rewriting previous memberships. Freeze, unfreeze and cancellation preserve history.
- Expiry windows: today, 7, 14, 30 days and expired; search by name, ID, phone, email or IC, plus plan, class, coach, branch and expiry filters.
- Payment history with methods, references, status tracking and settlement actions. Pending/partial amounts are recorded amounts, not an automatically calculated debt balance; invoice/balance accounting is outside this implementation.
- CSV/XLSX first-sheet import, column mapping, full preview, date and duplicate validation. Validation failures block the entire import. Up to 5,000 rows / 10 MB per file. Dates use YYYY-MM-DD. Pick a branch and plan per import batch; split mixed-plan files into batches. Existing IDs are not overwritten. Browser-local and database constraints both protect duplicates.
- CSV/XLSX export of filtered member records, and reports by date/month, branch and plan.
- Staff role administration and Supabase RLS. All authorized staff can access academy-wide operational member records; branch selection is a working filter, not an isolation boundary.

Saved login sessions may be remembered by Supabase in the same browser. Use **Sign out** at the bottom of the sidebar on a shared device. Authentication is still required, and revoked/invalid sessions never fall back to sample records.

## Data and permissions

Separate tables hold branches, staff, profiles, members, plans, memberships, renewals, classes, member/class links, plan/class links, payments, attendance and notes. The UI's general and medical notes are member fields; the separate notes table is available for future authored note timelines. Class arrays are synchronized to normalized junction tables by triggers. Records use foreign keys and unique constraints. Dates are evaluated against Asia/Kuala_Lumpur. Active dashboard totals include memberships expiring soon.

`apply_changes` is a transaction using **SECURITY INVOKER**, so the caller's table RLS applies. Staff can read operational records, register/edit members, enroll classes, record attendance/payments and append renewals. Admins additionally manage plans/classes, view reports and change membership states. Super admins manage branch and staff configuration. Navigation is convenience; database policies enforce access independently. Database membership/payment triggers prevent changes to historical fields. Class removal archives the class, preserving past attendance.

Member numbers follow `HYB-{BRANCH CODE}-{NUMBER}`. Database primary keys guarantee uniqueness. A concurrent registration using a stale browser snapshot fails atomically; refresh and retry rather than silently overwriting another member. Refresh the page to fetch changes made by other staff; realtime synchronization is not included.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

Tests cover expiry boundaries, month-end/leap-year renewal calculation, member number generation and preservation of historical memberships. A local PostgreSQL engine also executes the schema and checks transactional registration, class capacity, duplicate IDs, role restrictions and access denial for non-staff users. A live Supabase project is still needed to verify hosted authentication and deployment end to end. Before operational use, verify each role in your project, configure backups and your Auth email provider, and test an import with a copy of your real spreadsheet.

## Vercel deployment

Import this repository into Vercel and select Next.js. This gym's public project URL and publishable key are included in `.env.production`, which Next.js loads during the production build. These two values are intended for browser applications; authorization is enforced through Supabase Authentication and RLS. Never add database passwords, service-role keys or secret keys to this file. `.env.local` remains ignored.

Hosting environment variables override the committed public defaults. If the host already has incorrect or blank values for these variables, correct or remove those overrides. Deploy with the default `npm run build`; changes to public environment variables require a new build. A new Git push triggers a deployment only if Git deployments are configured on the host. Set your Supabase Auth Site URL to your deployed origin and allow the relevant redirect URLs. No application service key or custom server is required. Database schema changes must be applied to Supabase separately before the web deployment.

## Structure

`app/` handles the app shell/styles; `components/` contains dashboard, forms, management pages and import/export; `types/` defines records; `lib/` supplies dates, status, test fixtures and the Supabase client; `hooks/` verifies staff sessions and clears workspace records on sign-out; `services/` handles database transactions; `supabase/` contains schema/policies; `tests/` contains domain tests.
