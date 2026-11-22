# Hybrid Combative Academy & Gym

Responsive Next.js App Router, TypeScript, Tailwind CSS and Supabase membership management for Hybrid DD and future branches.

## Run locally

Use Node.js 20.12 or newer:

```sh
npm install
npm run dev
```

Open http://localhost:3000. This is a live-only application: configure Supabase before use and sign in with an authorized staff account. If connection settings are missing, the app shows a setup-required screen. Member records are never saved to browser demo storage. Old demo data is neither loaded nor deleted; migrate any records you want to keep separately.

Each new tab, full page reload, or reopened browser requires a fresh staff login. Tokens stay in document memory, not browser storage. Navigation within the workspace keeps the current login. Existing tokens from older versions are ignored; Supabase still controls token validity and revocation on the backend.

### Membership expiry

One month adds the number of days in the membership's start month. January 21, 2027 plus 31 days expires February 21; January 31 plus 31 days expires March 3; March 31 plus 31 days expires May 1. February uses 28 days, or 29 in a leap year. Expiry is the first invalid day.

For multiple months, calculate each month from the previous expiry date. January 31, 2027 plus January's 31 days reaches March 3. The second month starts March 3 and adds March's 31 days, expiring April 3. A third month adds April's 30 days, expiring May 3.

Apply `supabase/migrations/20261120125503_month_length_membership_expiry.sql`, then `supabase/migrations/20261120133014_rolling_month_membership_expiry.sql` after the existing expiry migrations to keep registration approvals consistent with renewal previews. This changes newly calculated expiries; existing saved membership dates remain unchanged.

### Money precision and reports

Apply `supabase/migrations/20261104032953_money_precision.sql` after the existing registration and payment migrations. This validates monetary inputs before database conversion can round extra decimal places. Existing payment amounts and access policies are preserved.

All prices, payment amounts, and report totals display two decimal places. Collections are summed as integer sen. **Reports → Collected payments** includes `Paid` and `Partial` records and excludes `Pending` and `Overdue`. For a partial payment, enter only the amount actually received. Record later collections as new payments; changing a payment's status does not add another amount. The selected plan is matched through each payment's own membership, so two plans bought by one member remain separate. Payment dates determine the reporting period. Workspace reads paginate through all records and fail explicitly when a complete result cannot be verified.

### Member check-in

Apply `supabase/migrations/20261104025440_member_check_in.sql` once after the existing setup migrations. This update is also required for installations created with `START_HERE.sql`. It allows general gym attendance without a class and prevents duplicate gym visits per member per day. Existing class attendance, enrollment validation, and access policies remain in place.

On **Overview**, use **Member check-in** to search by member ID, name, or phone number. Select the member, choose **Gym visit** or **Class attendance**, then confirm. Classes must be enrolled at the member's branch. Membership warnings are shown for reception to review; they do not automatically reject attendance. Today's arrivals follow the branch filter and Malaysia's calendar date. Gym visits also appear in the member's attendance history.

Below the check-in panel, open **Check-in history → View history** to browse past attendance. Filter by date range, member, visit type, and the workspace branch selector. Leave dates empty for all-time history. Results load directly from Supabase in pages of 25, including records older than the dashboard's loaded data. Check-ins are stored in `public.attendance` and remain available after sign-out or reload. Access requires an authorized staff session. No separate history migration is needed.

### Payment security update

Apply `supabase/006_payment_security.sql` once in the project's Supabase SQL Editor after migration 005, including installations created with `START_HERE.sql`. Then apply `supabase/migrations/20261024091149_payment_section_scope.sql`. The final policies require an authorized payment unlock to read payment history or update settlement status, including direct API calls. Authorized staff can record new payments during normal front-desk work without unlocking the ledger. Ordinary member browsing remains available without that unlock. Applying this update immediately locks payments for all accounts, including super admins, until passwords are configured.

Sign in as a super admin, open **Staff**, expand **Payment permission** for each approved account, and set a separate payment password. Use at least 7 characters and at most 72 UTF-8 bytes. Prefer a longer password after temporary setup. Share the password securely with that staff member. Staff enter their own payment password on **Payments** or **Reports**. Both sections share the same 15-minute unlock. Payment records are also withheld from dashboards, reports, and member profiles until unlocked. QR sign-up review, approvals, member registration, renewals, and payment collection do not prompt for the payment password. Reports require the same payment password. The public registration form remains open.

Passwords are stored as bcrypt hashes in a private schema. Unlocks are tied to the staff member's live Supabase Auth session and expire after 15 minutes. Five failed attempts lock the account's payment password for 15 minutes. **Lock payments** ends the current unlock; resetting or revoking a staff member's payment access cancels all their unlocks. The app checks revocation every 10 seconds and on window focus, while the database enforces expiry and revocation on every payment request. Information already viewed or downloaded cannot be recalled.

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
- A member can hold multiple class memberships with independent start and expiry dates. Renewal transactions append memberships, renewal links for the same plan and payments without rewriting previous memberships. Freeze, unfreeze and cancellation preserve history.
- Expiry windows: today, 7, 14, 30 days and expired; search by name, ID, phone, email or IC, plus plan, class, coach, branch and expiry filters.
- Payment history with methods, references, status tracking and settlement actions. Pending/partial amounts are recorded amounts, not an automatically calculated debt balance; invoice/balance accounting is outside this implementation.
- CSV/XLSX first-sheet import, column mapping, full preview, date and duplicate validation. Validation failures block the entire import. Up to 5,000 rows / 10 MB per file. Dates use YYYY-MM-DD. Pick a branch and plan per import batch; split mixed-plan files into batches. Existing IDs are not overwritten. Browser-local and database constraints both protect duplicates.
- CSV/XLSX export of filtered member records, and reports by date/month, branch and plan.
- Staff role administration and Supabase RLS. All authorized staff can access academy-wide operational member records; branch selection is a working filter, not an isolation boundary.

Staff login persists across reloads and tabs on the same site for 24 hours after the original sign-in. Token refresh does not extend this deadline. Returning to a tab keeps the workspace visible, and a restored back/forward page revalidates access in the background. The app signs out at the deadline, including when a sleeping tab becomes visible again. Use **Sign out** at the bottom of the sidebar on a shared device. Authentication is still required, and revoked/invalid sessions never fall back to sample records.

## Data and permissions

### QR self-registration and arrival capture

For an existing Supabase database, run `supabase/003_qr_registration.sql` once in SQL Editor if QR registration has not been set up, then run `supabase/004_personal_details_registration.sql`. If 003 is already installed, apply 004 if needed. Then apply `supabase/005_multiple_membership_registration.sql` to enable staff approval of multiple memberships together. New installations need 003, 004 and 005 after the base setup. Staff can then open **QR sign-up**, download a branch-specific QR and review submissions. The DD form is `https://register.hybridcombativegym.com/`; the QR screen uses the registration subdomain and can generate codes for another deployment origin or branch. Previously printed codes using `https://hybrid-management.vercel.app/join/dd` remain compatible when that deployment is publicly accessible. Download a fresh QR from the workspace for the custom domain.

New members enter personal details and consent without a staff account. The public QR form has no class selection, membership plan, start date, price or payment fields. Submission records an arrival timestamp and a **pending** registration. It does not activate a paid membership, collect online payment, verify physical presence or mark class attendance. Staff review the request, select one or more membership checkboxes, and press **Create member**. Each selected membership has its own start date, duration, expiry preview and amount collected; the form shows the combined total. Staff signup, adding memberships and renewing also support multiple selections. Approval atomically creates the member, all selected memberships, enrollments and payments, and links the original arrival. Staff can open the created member profile and use **Add class membership** to register another class with its own start date, duration, payment and expiry. Renew, freeze and cancel apply to the selected plan only. Member and renewal lists, the dashboard expiry queue and exports show each plan separately. Staff can decline or inspect duplicate requests. Existing members continue to check in with reception.

Public RPCs return only branch information, and accept tightly validated registrations. Request details are protected by RLS; anonymous users cannot read them, approve requests or access member/payment records. Pending submissions are deduplicated by phone and branch. Consent and arrival timestamps are retained, along with reviewer identity. Submission limits are 3 requests per phone/branch per 24 hours and 100 per branch/hour. The staff queue refreshes every 30 seconds and shows the latest 250 submissions. These controls reduce repeated submissions; they do not verify phone ownership or replace a CAPTCHA for a high-traffic public rollout.

Old installations can continue normal staff work before this migration, but the public form and QR queue will remain unavailable until it is applied. Do not re-run the initial schema on an existing database.

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

Staff sign-in accepts a username and password. The `admin` username resolves on the server to the existing Supabase account configured by `ADMIN_LOGIN_EMAIL`; the account email and role remain unchanged. Existing staff can also enter their account email in the username field. Supabase still verifies the password and issues the session, and existing database RLS and section unlocks still apply. Configure `ADMIN_LOGIN_EMAIL` in Vercel without the `NEXT_PUBLIC_` prefix. Login passwords are not stored in the repository. Username login does not change the separate Payments/Reports or Staff passwords.

After applying `supabase/migrations/20261122021643_branch_password_access.sql`, staff must choose a branch and enter its separate branch password. Configure each branch's bcrypt hash in `private.branch_credentials` through trusted database administration; never commit plaintext passwords. One branch can be open per Auth session. Switching branches locks the previous branch and prompts for the destination password. The database limits operational reads and writes to the unlocked branch, including searches and direct API requests. Branch names remain available for selection and administration. Branch access lasts up to 24 hours, ends when the Auth session is revoked, and is invalidated by changing the branch password. Five failed attempts across branches cause a 15-minute lockout. Workspace login, Payments/Reports, Staff passwords, and public registration/check-in forms retain their existing authentication flows.

The same Vercel project serves `management.hybridcombativegym.com` (staff sign-in), `register.hybridcombativegym.com` (DD registration), and `checkin.hybridcombativegym.com` (DD gym check-in). Root requests on the public subdomains rewrite to the existing public forms; branch-specific `/join/{code}` and `/check-in/{token}` links remain available. Set the server-only `GYM_CHECK_IN_TOKEN` environment variable to the DD branch's existing QR token in Vercel. A missing or malformed token returns an unavailable message with HTTP 503. New QR downloads use their corresponding public subdomains. The updated `public/hybrid-dd-signup-qr.png` is also available for printing. The roots default to the current DD branch; each additional branch retains its own QR URL. See the [Porkbun setup guide with screenshots](docs/porkbun-setup.md) for DNS records and optional connector setup.

Import this repository into Vercel and select Next.js. This gym's public project URL and publishable key are included in `.env.production`, which Next.js loads during the production build. These two values are intended for browser applications; authorization is enforced through Supabase Authentication and RLS. Never add database passwords, service-role keys or secret keys to this file. `.env.local` remains ignored.

Hosting environment variables override the committed public defaults. If the host already has incorrect or blank values for these variables, correct or remove those overrides. Deploy with the default `npm run build`; changes to public environment variables require a new build. A new Git push triggers a deployment only if Git deployments are configured on the host. Set your Supabase Auth Site URL to your deployed origin and allow the relevant redirect URLs. No application service key or custom server is required. Database schema changes must be applied to Supabase separately before the web deployment.

## Structure

`app/` handles the app shell/styles; `components/` contains dashboard, forms, management pages and import/export; `types/` defines records; `lib/` supplies dates, status, test fixtures and the Supabase client; `hooks/` verifies staff sessions and clears workspace records on sign-out; `services/` handles database transactions; `supabase/` contains schema/policies; `tests/` contains domain tests.

### Download payment records

Unlock **Payments**, choose a branch if needed, then select **Download Excel** or **Download PDF**. These replace the previous payment import option. Downloads contain the ledger records shown for the selected branch, sorted newest first, plus the recorded total and generation date. The Excel workbook keeps amounts numeric with two decimal places and includes payment and membership IDs. The PDF uses a landscape layout with repeated headers and continuation rows for long notes. Both exports include member, membership, amount, date, method, reference, status, and notes. Export checks the backend payment unlock before creating a file and never changes payment records.

### Staff administration security

Apply `supabase/migrations/20261024094934_staff_security.sql` after the other security migrations. Also apply `supabase/migrations/20261024103544_separate_staff_password.sql`. Opening **Staff** requires a super admin to enter their separately configured Staff password, stored as a bcrypt hash in the private staff credentials table. The workspace login password is not used for this check. This unlock is separate from Payments and Reports, expires after 15 minutes, and is tied to the current live Auth session. Five incorrect confirmations cause a separate 15-minute lockout. Changing either the account login password or the Staff credential invalidates existing Staff unlocks. Staff credentials must be configured explicitly through trusted database administration; granting a user the SUPER ADMIN role alone does not configure a Staff password.

Database policies protect staff inserts, updates, and deletes, including direct API calls. Locked users can read only their own staff record, so normal workspace login still works. Changing payment passwords or granting payment permission also requires an active Staff unlock. Staff cannot change their own role or remove their own access, even while unlocked. **Lock Staff** ends the Staff unlock without locking Payments or Reports. Existing login and payment passwords are unchanged by this migration.

### Mobile layouts

Phone and tablet widths use drawer navigation, wrapping controls, and labeled member/payment cards. Registration review and workspace forms render in viewport-level dialogs with a fixed heading, an independently scrollable body, and reachable actions. Review details retain complete addresses, emails, notes, and emergency contacts. Mobile dialogs open at the heading without automatically summoning the keyboard; viewport sizing updates when the keyboard or browser chrome changes. Safe-area spacing supports notched screens, and browser zoom remains enabled. Invoice previews and public registration forms also adapt to narrow screens.
