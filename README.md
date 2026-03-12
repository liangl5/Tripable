# Tripable MVP

Collaborative trip planning MVP for groups to collect ideas, vote, and generate a shared itinerary.

## Deployed Link
https://www.tripable.pro/


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

## Core user flow

1. Create a trip
2. Share the invite link
3. Friends join the trip
4. Everyone adds ideas
5. Everyone votes
6. Generate the itinerary


## Possible technical
1. Cloudflare / Captcha for new users
2. Personal profile page (hold statistics, allows users to edit profiles, add names->refer to name in trips)

## Smaller to do
1. Set date range doesn't update the calendar