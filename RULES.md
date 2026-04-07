1. Project uses SUPABASE for backend and auth, Resend for SMTP, Vercel for deployment, some analytics with Google Analytics and Amplitude.
2. Read ./COMPLETE_SCHEMA.sql and ./sql/*. These are commands that have been run manually in SUPABASE. Any necessary changes to database should be written in COMPLETE_SCHEMA.sql and you should inform the user to run some migration scripts. (You must generate a migration script for any database changes and tell the user to run the migration script).
3. Never use local storage, always update through database calls.
4. User roles are specified in a table format as follows:

-- PERMISSION SUMMARY:
-- ┌──────────────┬───────────┬────────────┬──────────┐
-- │ Resource     │ Owner     │ Editor     │ Suggestor│
-- ├──────────────┼───────────┼────────────┼──────────┤
-- │ Trip Core    │ CRUD      │ R/U        │ R        │
-- │ Ideas        │ CRUD      │ CRUD       │ CRUD own │
-- │ Vote         │ CRUD own  │ CRUD own   │ CRUD own │
-- │ Itinerary    │ CRUD      │ CRUD       │ R        │
-- │ Expenses     │ CRUD      │ CRUD       │ CRUD own │
-- │ Tabs/Config  │ CRUD      │ CRUD       │ R        │
-- │ Roles        │ CRUD      │ R          │ R        │
-- │ Invites      │ CRUD      │ CRUD       │ -        │
-- │ Lists        │ CRUD      │ CRUD       │ R        │
-- │ Availability │ CRUD own  │ CRUD own   │ CRUD own │
-- │ TabComment   │ CRUD      │ CRUD own   │ CRUD own │
-- └──────────────┴───────────┴────────────┴──────────┘