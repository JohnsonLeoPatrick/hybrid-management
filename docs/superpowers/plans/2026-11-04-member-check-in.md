# Member Check-in Implementation Plan

**Goal:** Let reception find members and record gym visits or enrolled class attendance from the dashboard.

**Architecture:** Reuse attendance and existing authenticated saves. A null class ID represents a gym visit; existing class IDs retain their meaning. Database uniqueness protects concurrent reception desks.

**Design:** A prominent, responsive panel above dashboard statistics contains member search, selection, visit type, and confirmation. A companion list shows today's attendance for the selected branch. Use existing olive and gold tokens, visible labels, keyboard controls, 44px targets, and status announcements. Display membership warnings without changing existing reception admission policy.

**Approaches:** Use one panel for both visit types, as requested. Separate screens add unnecessary navigation. Separate gym tables would duplicate persistence and reporting.

**Tech Stack:** Next.js, React, TypeScript, existing Supabase/Postgres, Lucide, CSS.

- [x] Add failing tests for search, gym/class attendance, duplicate visits, and SQL enrollment enforcement.
- [x] Add pure attendance helpers and nullable class IDs; migrate database with a gym-only unique index and enrollment trigger.
- [x] Add dashboard check-in component and responsive styles; label gym visits in member history.
- [x] Run focused tests, full suite, typecheck, production build, and database verification. Review diff, commit feature files only, and push main.

**Review focus:** Branch changes clear selection; failed saves retain form; duplicates across sessions fail in Postgres; class attendance requires enrollment; gym and class visits coexist on the same day. Existing local tooling files are excluded from the feature commit.

Validation: 38 tests passed. Focused attendance tests also passed through the authenticated apply_changes RPC. Typecheck and production build passed. Live schema verification confirmed nullable gym visits, database uniqueness, RLS, and enrollment enforcement. Browser inspection reached the staff login screen; authenticated visual testing requires a staff session. Review findings (post-save focus and migration documentation) were addressed.
