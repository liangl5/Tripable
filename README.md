# Tripute MVP

Collaborative trip planning MVP for groups to collect ideas, vote, and generate a shared itinerary.

## Tech stack

- Frontend: React, Vite, TailwindCSS, React Router, Zustand
- Backend: Node.js, Express
- Database: PostgreSQL, Prisma ORM
- Maps: Placeholder coordinates + simple distance calculation (MVP)

## Project structure

- `client` React app
- `server` Express API
- `prisma` Prisma schema

## Local setup and run

1. Create a PostgreSQL database and set `DATABASE_URL`.

```bash
export DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/tripute"
```

If you are unsure what `YOUR_DB_USER` is, try:

```bash
whoami
psql -d postgres -c "select current_user;"
psql -d postgres -c "\\du"
```

If your local Postgres user has no password, omit it:

```bash
export DATABASE_URL="postgresql://YOUR_DB_USER@localhost:5432/tripute"
```

You can also place the variable in `/Users/rebeccaz/Developer/Columbia/Startup4995/Tripute/.env`:

```bash
DATABASE_URL="postgresql://YOUR_DB_USER:YOUR_DB_PASSWORD@localhost:5432/tripute"
```

Create the database if it doesn't exist:

```bash
createdb tripute
```

2. Install dependencies.

```bash
npm install
```

3. Run Prisma migrations and generate the client.

```bash
npx prisma migrate dev --name init
npx prisma generate
```

4. Start the app.

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
