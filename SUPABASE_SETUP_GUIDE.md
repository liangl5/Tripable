# Supabase Setup Guide (Option 2: Direct Frontend Integration)

## Overview
This guide walks you through setting up Supabase to work directly with your frontend (no Express backend needed).

---

## Step 0: Get Your Supabase Credentials

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Once the project is ready, go to **Settings → API**
3. Copy your `Project URL` and `anon public` key
4. Create a `.env.local` file in the `client/` directory with:
   ```
   VITE_SUPABASE_URL=your_project_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

**Note:** Auth is automatically enabled in Supabase. Just ensure Email/Password authentication is enabled in **Authentication → Providers**.

---

## Step 1: Create Database Tables

Go to **Supabase Dashboard → SQL Editor** and run the following SQL:

```sql
CREATE TABLE "User" (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE "Trip" (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  destination JSONB,
  "startDate" TIMESTAMPTZ,
  "endDate" TIMESTAMPTZ,
  "createdById" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE "TripMember" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  UNIQUE("tripId", "userId")
);
CREATE TABLE "SurveyDate" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  UNIQUE("tripId", "date")
);
CREATE TABLE "UserAvailability" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  UNIQUE("tripId", "userId", "date")
);
CREATE TABLE "Idea" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  category VARCHAR(50),
  "entryType" VARCHAR(20) CHECK ("entryType" IN ('place', 'activity')),
  "parentIdeaId" TEXT REFERENCES "Idea"(id) ON DELETE CASCADE,
  "createdById" TEXT NOT NULL REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE "Vote" (
  id TEXT PRIMARY KEY,
  "ideaId" TEXT NOT NULL REFERENCES "Idea"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  value INTEGER CHECK (value IN (-1, 0, 1)),
  UNIQUE("ideaId", "userId")
);
CREATE TABLE "ItineraryDay" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "dayNumber" INTEGER NOT NULL,
  date TIMESTAMPTZ,
  UNIQUE("tripId", "dayNumber")
);
CREATE TABLE "ItineraryItem" (
  id TEXT PRIMARY KEY,
  "itineraryDayId" TEXT NOT NULL REFERENCES "ItineraryDay"(id) ON DELETE CASCADE,
  "ideaId" TEXT REFERENCES "Idea"(id),
  "order" INTEGER NOT NULL,
  title VARCHAR(255),
  location VARCHAR(255)
);
CREATE INDEX idx_trip_created_by ON "Trip"("createdById");
CREATE INDEX idx_trip_member_user ON "TripMember"("userId");
CREATE INDEX idx_trip_member_trip ON "TripMember"("tripId");
CREATE INDEX idx_idea_trip ON "Idea"("tripId");
CREATE INDEX idx_idea_created_by ON "Idea"("createdById");
CREATE INDEX idx_idea_entry_type ON "Idea"("entryType");
CREATE INDEX idx_idea_parent ON "Idea"("parentIdeaId");
CREATE INDEX idx_vote_idea ON "Vote"("ideaId");
CREATE INDEX idx_vote_user ON "Vote"("userId");
CREATE INDEX idx_itinerary_day_trip ON "ItineraryDay"("tripId");
CREATE INDEX idx_itinerary_item_day ON "ItineraryItem"("itineraryDayId");
CREATE INDEX idx_survey_date_trip ON "SurveyDate"("tripId");
CREATE INDEX idx_availability_trip ON "UserAvailability"("tripId");
CREATE INDEX idx_availability_user ON "UserAvailability"("userId");
```

**How multiple destinations work now**
- `Trip.destination` stays optional and represents the confirmed/main destination for the trip.
- Destination options like `France`, `Tokyo`, or `Florida` are stored as top-level rows in `Idea` using `category = 'Destinations'` and `entryType = 'place'`.
- Activities or food ideas grouped under those destinations use `parentIdeaId` to point back to the destination idea.

---

## Step 1.5: (OPTIONAL) If Tables Already Exist - Update Timestamps, Optional Trip Destination, And Idea Hierarchy

**⚠️ Only run this if you have an existing Supabase project with tables created before March 2026.** 

If you've already created the tables with `TIMESTAMP` instead of `TIMESTAMPTZ`, your `Trip` table does not yet have a `destination` column, or your `Idea` table does not yet support nested destination groupings, run this SQL:

```sql
-- Update existing tables to use TIMESTAMPTZ for proper timezone handling
ALTER TABLE "User" ALTER COLUMN "created_at" TYPE TIMESTAMPTZ;
ALTER TABLE "User" ALTER COLUMN "created_at" SET DEFAULT NOW();

ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS destination JSONB;
ALTER TABLE "Trip" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ;
ALTER TABLE "Trip" ALTER COLUMN "createdAt" SET DEFAULT NOW();
ALTER TABLE "Trip" ALTER COLUMN "startDate" TYPE TIMESTAMPTZ;
ALTER TABLE "Trip" ALTER COLUMN "endDate" TYPE TIMESTAMPTZ;

ALTER TABLE "Idea" ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ;
ALTER TABLE "Idea" ALTER COLUMN "createdAt" SET DEFAULT NOW();
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "entryType" VARCHAR(20);
ALTER TABLE "Idea" ADD COLUMN IF NOT EXISTS "parentIdeaId" TEXT REFERENCES "Idea"(id) ON DELETE CASCADE;

ALTER TABLE "Idea" DROP CONSTRAINT IF EXISTS "Idea_entryType_check";
ALTER TABLE "Idea"
  ADD CONSTRAINT "Idea_entryType_check"
  CHECK ("entryType" IS NULL OR "entryType" IN ('place', 'activity'));

UPDATE "Idea"
SET "entryType" = CASE
  WHEN LOWER(COALESCE(category, '')) = 'activities' THEN 'activity'
  WHEN LOWER(COALESCE(category, '')) = 'destinations' THEN 'place'
  WHEN LOWER(COALESCE(category, '')) LIKE '%activity%' THEN 'activity'
  ELSE 'place'
END
WHERE "entryType" IS NULL;

ALTER TABLE "SurveyDate" ALTER COLUMN "date" TYPE TIMESTAMPTZ;
ALTER TABLE "UserAvailability" ALTER COLUMN "date" TYPE TIMESTAMPTZ;
ALTER TABLE "ItineraryDay" ALTER COLUMN "date" TYPE TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_idea_entry_type ON "Idea"("entryType");
CREATE INDEX IF NOT EXISTS idx_idea_parent ON "Idea"("parentIdeaId");
```

**Why?** Using `TIMESTAMPTZ` (timestamp with timezone) ensures Supabase returns proper ISO 8601 strings that JavaScript's `Date` parser can correctly handle, making relative time calculations accurate.

---

## Step 2: Enable Row Level Security (RLS)

```sql
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SurveyDate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAvailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Idea" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItineraryDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItineraryItem" ENABLE ROW LEVEL SECURITY;

-- Drop existing Trip policies to recreate with correct permissions
DROP POLICY IF EXISTS "Users can view own trips" ON "Trip";
DROP POLICY IF EXISTS "Only creator can update trip" ON "Trip";
DROP POLICY IF EXISTS "Only creator can insert trip" ON "Trip";
DROP POLICY IF EXISTS "Only creator can delete trip" ON "Trip";
DROP POLICY IF EXISTS "Anyone authenticated can view trips" ON "Trip";

-- Create User policies
CREATE POLICY "Users can read their own profile" ON "User" FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON "User" FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Anyone can create user" ON "User" FOR INSERT WITH CHECK (true);

-- Create Trip policies (allows any authenticated user to view, but only creator can modify)
CREATE POLICY "Anyone authenticated can view trips" ON "Trip" FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Only creator can update trip" ON "Trip" FOR UPDATE USING (auth.uid()::text = "createdById");
CREATE POLICY "Only creator can insert trip" ON "Trip" FOR INSERT WITH CHECK (auth.uid()::text = "createdById");
CREATE POLICY "Only creator can delete trip" ON "Trip" FOR DELETE USING (auth.uid()::text = "createdById");

-- Create remaining policies
CREATE POLICY IF NOT EXISTS "Users can view all trip memberships" ON "TripMember" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users can join trips" ON "TripMember" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can leave trips" ON "TripMember" FOR DELETE USING (auth.uid()::text = "userId");
CREATE POLICY IF NOT EXISTS "Users can view all ideas" ON "Idea" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users can create ideas" ON "Idea" FOR INSERT WITH CHECK (auth.uid()::text = "createdById");
CREATE POLICY IF NOT EXISTS "Idea creator or trip owner can delete" ON "Idea" FOR DELETE USING (
  auth.uid()::text = "createdById" OR
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "Idea"."tripId")
);
CREATE POLICY IF NOT EXISTS "Users can view all votes" ON "Vote" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users can vote" ON "Vote" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY IF NOT EXISTS "Users can update their votes" ON "Vote" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY IF NOT EXISTS "Users can delete their votes" ON "Vote" FOR DELETE USING (auth.uid()::text = "userId");
CREATE POLICY IF NOT EXISTS "Users can view survey dates" ON "SurveyDate" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Only creator can manage survey dates" ON "SurveyDate" FOR INSERT WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "Users can view all availability" ON "UserAvailability" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Users can set their availability" ON "UserAvailability" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY IF NOT EXISTS "Users can update their availability" ON "UserAvailability" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY IF NOT EXISTS "Users can delete their availability" ON "UserAvailability" FOR DELETE USING (auth.uid()::text = "userId");
CREATE POLICY IF NOT EXISTS "Trip members can view itinerary" ON "ItineraryDay" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Trip owner can delete itinerary days" ON "ItineraryDay" FOR DELETE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "ItineraryDay"."tripId")
);
CREATE POLICY IF NOT EXISTS "Trip members can view itinerary items" ON "ItineraryItem" FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Trip owner or creator can delete itinerary items" ON "ItineraryItem" FOR DELETE USING (
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip" 
    WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
  )
);
```

---

## Step 3: Verify Your Setup

Once you've completed Steps 0-2, verify that:
- ✅ All 9 tables exist in your Supabase database (User, Trip, TripMember, SurveyDate, UserAvailability, Idea, Vote, ItineraryDay, ItineraryItem)
- ✅ All tables have RLS enabled
- ✅ All policies are created (you should see ~25 policies in total)
- ✅ Email/Password authentication is enabled in **Authentication → Providers**
- ✅ You have `.env.local` in `client/` with your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

You're ready to run the app!

---

## Troubleshooting

**"Permission denied" errors when creating/deleting data?**
- Check that RLS policies are enabled on the table
- Verify the policy conditions match your user's ID

**Invite links return 404 NOT_FOUND when opened in another account?**
- Ensure the Trip table SELECT policy is `USING (auth.uid() IS NOT NULL)` not `USING (true)`
- This allows any authenticated user to view trip details needed for the invite flow
- The policy still protects updates/deletes to trip creators only

**Timestamps showing as "just now" everywhere?**
- Ensure all timestamp columns are `TIMESTAMPTZ` not `TIMESTAMP`
- If upgrading existing tables, run Step 1.5

**Can't sign up?**
- Check that email is unique in the User table
- Verify auth is enabled in Supabase
