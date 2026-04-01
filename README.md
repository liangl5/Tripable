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
- 

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

## Invite Email Setup (Resend + Vercel)

Trip invite emails are sent through a Vercel serverless endpoint at `/api/send-trip-invites`.

Required Vercel environment variables:
- `RESEND_API_KEY`: API key from Resend dashboard.
- `RESEND_FROM_EMAIL`: Verified sender identity, for example `Tripable <noreply@yourdomain.com>`.

Notes:
- If `RESEND_FROM_EMAIL` is not set, the API falls back to `Tripable <onboarding@resend.dev>` for initial testing.
- In production, use a verified domain sender in Resend to improve delivery.

## Analytics Setup (Google Analytics + Amplitude)

Tripable supports dual telemetry in the browser and server invite conversion events.

Google Analytics and Amplitude are loaded manually via CDN scripts in `client/index.html`.

Client IDs currently hardcoded in `client/index.html`:
- GA4 measurement id: `G-LKL1HJW6K4`
- Amplitude API key: `9ac08e8010075e930bca4e802fa04ef3`

Optional server env variables (Vercel project settings):
- `GA4_MEASUREMENT_ID`: GA4 measurement id used by server events.
- `GA4_API_SECRET`: GA4 Measurement Protocol API secret.
- `AMPLITUDE_API_KEY`: Amplitude API key used by server events.
- `SUPABASE_URL`: Supabase project URL used by API endpoints.
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for server-side reads like user counts.

Notes:
- Client analytics automatically initialize on app bootstrap.
- User identifiers are anonymized before being sent to analytics vendors.
- Invite conversions are also emitted from server endpoints to reduce client retry double-counting.

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
