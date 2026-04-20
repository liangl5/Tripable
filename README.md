# Tripable MVP

Collaborative trip planning MVP for groups to collect ideas, vote, and generate a shared itinerary.

## Deployed Link
https://www.tripable.pro/

## Dev Links
- https://github.com/users/liangl5/projects/1 - backlog
- https://supabase.com/dashboard/project/xgunssqwbacuwysbwhkp - supabase
- https://vercel.com/liangl5s-projects/tripable-client - vercel
- https://resend.com - SMTP service
- https://porkbun.com/ - DNS service
- https://github.com/liangl5/Tripable - GitHub
- https://app.amplitude.com/analytics/tripable/home?sml2400=True&email=ll3945%40columbia.edu&sml1035=True&social=True - Amplitude Analytics
- https://analytics.google.com/analytics/web/#/a389618169p530925078/reports/intelligenthome?params=_u..nav%3Dmaui - Google Analytics
- https://tripable-testing.vercel.app/ - testing production

## Tech stack

- Frontend: React, Vite, TailwindCSS, React Router, Zustand
- Backend: Node.js, Express
- Database: Supabase

## Local setup and run
1. Ensure .env and ./client/.env.local files exist and include supabase

2. Install dependencies.

```bash
npm install
```

3. Start the app.

```bash
npm run dev
```

Client runs on `http://localhost:5173` and API on `http://localhost:3001`.

## Database schema updates

- Use COMPLETE_SCHEMA.sql only for a brand-new empty database.
- Do not run COMPLETE_SCHEMA.sql on a database that already has data. It contains DROP TABLE statements.
- For existing databases, run sql/reapply_schema_updates_safe.sql.
- The safe script is idempotent and non-destructive for normal updates.
- Note: it includes one intentional cleanup that removes old orphan ideas created by previous list FK behavior.


## API Endpoint

- `GET /api/user-count` returns JSON payload:

```json
{ "count": 123 }
```

## Core user flow

1. Create a trip
2. Share the invite link
3. Friends join the trip
4. Everyone adds ideas
5. Everyone votes
6. Generate the itinerary
