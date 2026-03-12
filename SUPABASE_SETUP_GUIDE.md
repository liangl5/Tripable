# Supabase Setup Guide (Option 2: Direct Frontend Integration)

## Overview
This guide walks you through setting up Supabase to work directly with your frontend (no Express backend needed).

---

## Step 1: Create Database Tables

Go to **Supabase Dashboard → SQL Editor** and run the following SQL:

```sql
CREATE TABLE "User" (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE "Trip" (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "startDate" TIMESTAMP,
  "endDate" TIMESTAMP,
  "createdById" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP DEFAULT NOW()
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
  date TIMESTAMP NOT NULL,
  UNIQUE("tripId", "date")
);
CREATE TABLE "UserAvailability" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  date TIMESTAMP NOT NULL,
  UNIQUE("tripId", "userId", "date")
);
CREATE TABLE "Idea" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  category VARCHAR(50),
  "createdById" TEXT NOT NULL REFERENCES "User"(id),
  "createdAt" TIMESTAMP DEFAULT NOW()
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
  date TIMESTAMP,
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
CREATE INDEX idx_vote_idea ON "Vote"("ideaId");
CREATE INDEX idx_vote_user ON "Vote"("userId");
CREATE INDEX idx_itinerary_day_trip ON "ItineraryDay"("tripId");
CREATE INDEX idx_itinerary_item_day ON "ItineraryItem"("itineraryDayId");
CREATE INDEX idx_survey_date_trip ON "SurveyDate"("tripId");
CREATE INDEX idx_availability_trip ON "UserAvailability"("tripId");
CREATE INDEX idx_availability_user ON "UserAvailability"("userId");
```

---

## Step 2: Enable Row-Level Security (RLS)

RLS policies ensure users can only access their own data. Run this in SQL Editor:

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
CREATE POLICY "Users can read their own profile" ON "User" FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON "User" FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Anyone can create user" ON "User" FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own trips" ON "Trip" FOR SELECT USING (true);
CREATE POLICY "Only creator can update trip" ON "Trip" FOR UPDATE USING (auth.uid()::text = "createdById");
CREATE POLICY "Only creator can insert trip" ON "Trip" FOR INSERT WITH CHECK (auth.uid()::text = "createdById");
CREATE POLICY "Only creator can delete trip" ON "Trip" FOR DELETE USING (auth.uid()::text = "createdById");
CREATE POLICY "Users can view all trip memberships" ON "TripMember" FOR SELECT USING (true);
CREATE POLICY "Users can join trips" ON "TripMember" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can view all ideas" ON "Idea" FOR SELECT USING (true);
CREATE POLICY "Users can create ideas" ON "Idea" FOR INSERT WITH CHECK (auth.uid()::text = "createdById");
CREATE POLICY "Users can view all votes" ON "Vote" FOR SELECT USING (true);
CREATE POLICY "Users can vote" ON "Vote" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update their votes" ON "Vote" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete their votes" ON "Vote" FOR DELETE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can view survey dates" ON "SurveyDate" FOR SELECT USING (true);
CREATE POLICY "Only creator can manage survey dates" ON "SurveyDate" FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view all availability" ON "UserAvailability" FOR SELECT USING (true);
CREATE POLICY "Users can set their availability" ON "UserAvailability" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Users can update their availability" ON "UserAvailability" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete their availability" ON "UserAvailability" FOR DELETE USING (auth.uid()::text = "userId");
CREATE POLICY "Trip members can view itinerary" ON "ItineraryDay" FOR SELECT USING (true);
CREATE POLICY "Trip members can view itinerary items" ON "ItineraryItem" FOR SELECT USING (true);
```

---