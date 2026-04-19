-- ============================================
-- TRIPABLE: COMPLETE DATABASE SCHEMA
-- Supabase SQL - Copy & Paste into SQL Editor
-- ============================================
-- This script:
-- 1. Drops all existing tables (safe for fresh setup)
-- 2. Creates 16 normalized tables
-- 3. Creates 25+ performance indexes
-- 4. Enables RLS and creates 60+ security policies
-- ============================================

-- Disable RLS on all tables first (prevents constraint issues during drop)
ALTER TABLE IF EXISTS "User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Trip" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "TripMember" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "SurveyDate" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "UserAvailability" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Idea" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Vote" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ItineraryDay" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ItineraryItem" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "TripTabConfiguration" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "UserTripRole" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "PendingTripInvite" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AvailabilityTabData" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "AvailabilityTabComment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "TransactionComment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "IdeaComment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ItineraryDayComment" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "List" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "Transaction" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "TransactionSplit" DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS "ItineraryTabConfiguration" DISABLE ROW LEVEL SECURITY;

-- Drop all tables (CASCADE handles dependencies)
DROP TABLE IF EXISTS "TransactionSplit" CASCADE;
DROP TABLE IF EXISTS "Transaction" CASCADE;
DROP TABLE IF EXISTS "ItineraryTabConfiguration" CASCADE;
DROP TABLE IF EXISTS "ItineraryItem" CASCADE;
DROP TABLE IF EXISTS "ItineraryDay" CASCADE;
DROP TABLE IF EXISTS "Vote" CASCADE;
DROP TABLE IF EXISTS "Idea" CASCADE;
DROP TABLE IF EXISTS "AvailabilityTabData" CASCADE;
DROP TABLE IF EXISTS "AvailabilityTabComment" CASCADE;
DROP TABLE IF EXISTS "TransactionComment" CASCADE;
DROP TABLE IF EXISTS "IdeaComment" CASCADE;
DROP TABLE IF EXISTS "ItineraryDayComment" CASCADE;
DROP TABLE IF EXISTS "PendingTripInvite" CASCADE;
DROP TABLE IF EXISTS "List" CASCADE;
DROP TABLE IF EXISTS "UserTripRole" CASCADE;
DROP TABLE IF EXISTS "TripTabConfiguration" CASCADE;
DROP TABLE IF EXISTS "UserAvailability" CASCADE;
DROP TABLE IF EXISTS "SurveyDate" CASCADE;
DROP TABLE IF EXISTS "TripMember" CASCADE;
DROP TABLE IF EXISTS "Trip" CASCADE;

-- ============================================
-- CREATE ALL TABLES WITH CORRECT SCHEMA
-- ============================================

-- 1. User (authentication & profiles)
CREATE TABLE IF NOT EXISTS "User" (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  "avatarColor" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trip (core trip data)
CREATE TABLE "Trip" (
  id TEXT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "createdById" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TripMember (trip membership tracking)
CREATE TABLE "TripMember" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  UNIQUE("tripId", "userId")
);

-- 4. SurveyDate (legacy - for backwards compatibility)
CREATE TABLE "SurveyDate" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  UNIQUE("tripId", "date")
);

-- 5. UserAvailability (legacy - for backwards compatibility)
CREATE TABLE "UserAvailability" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  UNIQUE("tripId", "userId", "date")
);

-- 5b. TripTabConfiguration must exist before Idea (Idea.tabId FK depends on it)
CREATE TABLE IF NOT EXISTS "TripTabConfiguration" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  "tabType" VARCHAR(50) NOT NULL CHECK ("tabType" IN ('availability', 'list', 'itinerary', 'expenses', 'custom')),
  "position" INTEGER NOT NULL,
  "isCollapsible" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 10b. TripTabPreference (per-user active tab)
CREATE TABLE IF NOT EXISTS "TripTabPreference" (
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "activeTabId" TEXT REFERENCES "TripTabConfiguration"(id) ON DELETE SET NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("tripId", "userId")
);

-- 6. Idea (activities, places, recommendations)
CREATE TABLE "Idea" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  category VARCHAR(50),
  "entryType" VARCHAR(20) CHECK ("entryType" IN ('place', 'activity')),
  "parentIdeaId" TEXT REFERENCES "Idea"(id) ON DELETE CASCADE,
  "listId" TEXT,
  "tabId" TEXT NOT NULL REFERENCES "TripTabConfiguration"(id) ON DELETE CASCADE,
  "costEstimate" NUMERIC(12,2),
  "mapQuery" TEXT,
  coordinates JSONB,
  "photoUrl" TEXT,
  "photoAttributions" JSONB,
  "recommendationSource" TEXT,
  "createdById" TEXT NOT NULL REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Vote (upvote/downvote on ideas)
CREATE TABLE "Vote" (
  id TEXT PRIMARY KEY,
  "ideaId" TEXT NOT NULL REFERENCES "Idea"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  value INTEGER CHECK (value IN (-1, 0, 1)),
  UNIQUE("ideaId", "userId")
);

-- 8. ItineraryDay (days in trip itinerary)
CREATE TABLE "ItineraryDay" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "tabId" TEXT,
  "dayNumber" INTEGER NOT NULL,
  date TIMESTAMPTZ,
  "isDraft" BOOLEAN DEFAULT false,
  UNIQUE("tripId", "dayNumber")
);

-- 9. ItineraryItem (activities scheduled on specific days)
CREATE TABLE "ItineraryItem" (
  id TEXT PRIMARY KEY,
  "itineraryDayId" TEXT NOT NULL REFERENCES "ItineraryDay"(id) ON DELETE CASCADE,
  "ideaId" TEXT REFERENCES "Idea"(id),
  "order" INTEGER NOT NULL,
  title VARCHAR(255),
  location VARCHAR(255)
);

-- 10. TripTabConfiguration (custom tabs per trip)
CREATE TABLE IF NOT EXISTS "TripTabConfiguration" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  "tabType" VARCHAR(50) NOT NULL CHECK ("tabType" IN ('availability', 'list', 'itinerary', 'expenses', 'custom')),
  "position" INTEGER NOT NULL,
  "isCollapsible" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Scope itinerary days to a specific itinerary tab
ALTER TABLE "ItineraryDay"
  ADD CONSTRAINT fk_itinerary_day_tab
  FOREIGN KEY ("tabId") REFERENCES "TripTabConfiguration"(id) ON DELETE CASCADE;
ALTER TABLE "ItineraryDay" ALTER COLUMN "tabId" SET NOT NULL;
ALTER TABLE "ItineraryDay" DROP CONSTRAINT "ItineraryDay_tripId_dayNumber_key";
ALTER TABLE "ItineraryDay"
  ADD CONSTRAINT "ItineraryDay_tabId_dayNumber_key" UNIQUE ("tabId", "dayNumber");

-- 11. UserTripRole (per-trip roles: owner/editor/suggestor)
CREATE TABLE "UserTripRole" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'suggestor')),
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("tripId", "userId")
);

-- 11b. PendingTripInvite (persistent invite queue with role assignment)
CREATE TABLE "PendingTripInvite" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('editor', 'suggestor')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'canceled')),
  "createdById" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "acceptedByUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "acceptedAt" TIMESTAMPTZ,
  "canceledAt" TIMESTAMPTZ
);

-- 12. AvailabilityTabData (per-tab availability data)
CREATE TABLE "AvailabilityTabData" (
  id TEXT PRIMARY KEY,
  "tabId" TEXT NOT NULL REFERENCES "TripTabConfiguration"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  "isSelected" BOOLEAN DEFAULT false,
  "submittedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("tabId", "userId", "date")
);

-- 12b. AvailabilityTabComment (threaded notes under group availability)
CREATE TABLE "AvailabilityTabComment" (
  id TEXT PRIMARY KEY,
  "tabId" TEXT NOT NULL REFERENCES "TripTabConfiguration"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "parentCommentId" TEXT REFERENCES "AvailabilityTabComment"(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 12c. IdeaComment (threaded notes under activities)
CREATE TABLE "IdeaComment" (
  id TEXT PRIMARY KEY,
  "ideaId" TEXT NOT NULL REFERENCES "Idea"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "parentCommentId" TEXT REFERENCES "IdeaComment"(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 12d. ItineraryDayComment (threaded notes under itinerary days)
CREATE TABLE "ItineraryDayComment" (
  id TEXT PRIMARY KEY,
  "itineraryDayId" TEXT NOT NULL REFERENCES "ItineraryDay"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "parentCommentId" TEXT REFERENCES "ItineraryDayComment"(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 13. List (organizes ideas into categories)
CREATE TABLE "List" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "tabId" TEXT NOT NULL REFERENCES "TripTabConfiguration"(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  "order" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("tripId", "tabId", "name")
);

-- Add FK constraint to Idea.listId
ALTER TABLE "Idea" 
  ADD CONSTRAINT fk_idea_list 
  FOREIGN KEY ("listId") REFERENCES "List"(id) ON DELETE SET NULL;

-- 14. Transaction (expense tracking)
CREATE TABLE "Transaction" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "tabId" TEXT REFERENCES "TripTabConfiguration"(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  "totalAmount" NUMERIC(12,2) NOT NULL,
  "paidByUserId" TEXT REFERENCES "User"(id),
  "createdById" TEXT NOT NULL REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 15. TransactionSplit (cost breakdown per user)
CREATE TABLE "TransactionSplit" (
  id TEXT PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "Transaction"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("transactionId", "userId")
);

-- 15b. TransactionComment (threaded notes under expense transactions)
CREATE TABLE "TransactionComment" (
  id TEXT PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "Transaction"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "parentCommentId" TEXT REFERENCES "TransactionComment"(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 16. ItineraryTabConfiguration (which lists appear in itinerary)
CREATE TABLE "ItineraryTabConfiguration" (
  id TEXT PRIMARY KEY,
  "tabId" TEXT NOT NULL REFERENCES "TripTabConfiguration"(id) ON DELETE CASCADE,
  "allowedListIds" JSONB,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("tabId")
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

-- Core trip indexes (fast access by creator and date)
CREATE INDEX idx_trip_created_by ON "Trip"("createdById");
CREATE INDEX idx_trip_created_at ON "Trip"("createdAt" DESC);

-- Membership & role indexes (fast lookup of user trips and roles)
CREATE INDEX idx_trip_member_user ON "TripMember"("userId");
CREATE INDEX idx_trip_member_trip ON "TripMember"("tripId");
CREATE INDEX idx_user_trip_role_trip ON "UserTripRole"("tripId");
CREATE INDEX idx_user_trip_role_user ON "UserTripRole"("userId");
CREATE INDEX idx_user_trip_role_composite ON "UserTripRole"("tripId", "userId") WHERE role = 'suggestor';
CREATE INDEX idx_pending_invite_trip ON "PendingTripInvite"("tripId");
CREATE INDEX idx_pending_invite_email ON "PendingTripInvite"(LOWER(email));
CREATE UNIQUE INDEX idx_pending_invite_trip_email_pending
  ON "PendingTripInvite"("tripId", LOWER(email))
  WHERE status = 'pending';

-- Idea indexes (fast access to trip ideas, voting, and category)
CREATE INDEX idx_idea_trip ON "Idea"("tripId");
CREATE INDEX idx_idea_created_by ON "Idea"("createdById");
CREATE INDEX idx_idea_entry_type ON "Idea"("entryType");
CREATE INDEX idx_idea_parent ON "Idea"("parentIdeaId");
CREATE INDEX idx_idea_list ON "Idea"("listId");
CREATE INDEX idx_idea_tab ON "Idea"("tabId");
CREATE INDEX idx_idea_trip_entry ON "Idea"("tripId", "entryType");
CREATE INDEX idx_idea_trip_created ON "Idea"("tripId", "createdAt" DESC);

-- Vote indexes (fast voting lookup)
CREATE INDEX idx_vote_idea ON "Vote"("ideaId");
CREATE INDEX idx_vote_user ON "Vote"("userId");
CREATE INDEX idx_vote_composite ON "Vote"("ideaId", "userId");

-- Itinerary indexes (fast day/item access)
CREATE INDEX idx_itinerary_day_trip ON "ItineraryDay"("tripId");
CREATE INDEX idx_itinerary_day_tab ON "ItineraryDay"("tabId");
CREATE INDEX idx_itinerary_day_number ON "ItineraryDay"("tabId", "dayNumber");
CREATE INDEX idx_itinerary_item_day ON "ItineraryItem"("itineraryDayId");
CREATE INDEX idx_itinerary_item_idea ON "ItineraryItem"("ideaId");

-- Tab/configuration indexes
CREATE INDEX idx_trip_tab_trip ON "TripTabConfiguration"("tripId");
CREATE INDEX idx_trip_tab_preference_trip ON "TripTabPreference"("tripId");
CREATE INDEX idx_trip_tab_preference_user ON "TripTabPreference"("userId");
CREATE INDEX idx_availability_tab_data_tab ON "AvailabilityTabData"("tabId");
CREATE INDEX idx_availability_tab_data_user ON "AvailabilityTabData"("userId");
CREATE INDEX idx_availability_tab_composite ON "AvailabilityTabData"("tabId", "userId");
CREATE INDEX idx_availability_tab_comment_tab ON "AvailabilityTabComment"("tabId");
CREATE INDEX idx_availability_tab_comment_created ON "AvailabilityTabComment"("createdAt" DESC);
CREATE INDEX idx_availability_tab_comment_parent ON "AvailabilityTabComment"("parentCommentId");
CREATE INDEX idx_transaction_comment_transaction ON "TransactionComment"("transactionId");
CREATE INDEX idx_transaction_comment_created ON "TransactionComment"("createdAt" DESC);
CREATE INDEX idx_transaction_comment_parent ON "TransactionComment"("parentCommentId");
CREATE INDEX idx_idea_comment_idea ON "IdeaComment"("ideaId");
CREATE INDEX idx_idea_comment_created ON "IdeaComment"("createdAt" DESC);
CREATE INDEX idx_idea_comment_parent ON "IdeaComment"("parentCommentId");
CREATE INDEX idx_itinerary_day_comment_day ON "ItineraryDayComment"("itineraryDayId");
CREATE INDEX idx_itinerary_day_comment_created ON "ItineraryDayComment"("createdAt" DESC);
CREATE INDEX idx_itinerary_day_comment_parent ON "ItineraryDayComment"("parentCommentId");
CREATE INDEX idx_itinerary_tab_config_tab ON "ItineraryTabConfiguration"("tabId");

-- Expense indexes (fast transaction and split lookups)
CREATE INDEX idx_transaction_trip ON "Transaction"("tripId");
CREATE INDEX idx_transaction_tab ON "Transaction"("tabId");
CREATE INDEX idx_transaction_created_by ON "Transaction"("createdById");
CREATE INDEX idx_transaction_created_at ON "Transaction"("createdAt" DESC);
CREATE INDEX idx_transaction_split_transaction ON "TransactionSplit"("transactionId");
CREATE INDEX idx_transaction_split_user ON "TransactionSplit"("userId");
CREATE INDEX idx_transaction_split_composite ON "TransactionSplit"("transactionId", "userId");

-- List indexes
CREATE INDEX idx_list_trip ON "List"("tripId");
CREATE INDEX idx_list_tab ON "List"("tabId");
CREATE INDEX idx_list_trip_name ON "List"("tripId", "tabId", "name");

-- Availability indexes (fast date lookups)
CREATE INDEX idx_survey_date_trip ON "SurveyDate"("tripId");
CREATE INDEX idx_availability_trip ON "UserAvailability"("tripId");
CREATE INDEX idx_availability_user ON "UserAvailability"("userId");
CREATE INDEX idx_availability_composite ON "UserAvailability"("tripId", "userId", "date");

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SurveyDate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserAvailability" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Idea" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Vote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItineraryDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItineraryItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripTabConfiguration" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripTabPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserTripRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PendingTripInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvailabilityTabData" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AvailabilityTabComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IdeaComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItineraryDayComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "List" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransactionSplit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItineraryTabConfiguration" ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CREATE RLS POLICIES WITH OWNER/SUGGESTOR ROLES
-- ============================================
-- Permissions Matrix:
-- OWNER: Create, Read, Update, Delete (all trip data)
-- SUGGESTOR: Read (all), Create (ideas/votes/transactions), Edit own (ideas/transactions)
-- GUEST (TripMember only): Read (all), no write access
-- ============================================

-- User policies
DROP POLICY IF EXISTS "Users can read any profile" ON "User";
DROP POLICY IF EXISTS "Users can update their own profile" ON "User";
DROP POLICY IF EXISTS "Anyone can create user account" ON "User";
CREATE POLICY "Users can read any profile" ON "User" FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON "User" FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "Anyone can create user account" ON "User" FOR INSERT WITH CHECK (true);

-- Trip policies: any authenticated user can read trip metadata (needed for invite previews)
CREATE POLICY "Authenticated users can view trips" ON "Trip" FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Only trip owner can create" ON "Trip" FOR INSERT WITH CHECK (auth.uid()::text = "createdById");
CREATE POLICY "Owner or editor can update trip" ON "Trip" FOR UPDATE USING (
  auth.uid()::text = "createdById"
  OR auth.uid()::text IN (
    SELECT "userId"
    FROM "UserTripRole"
    WHERE "tripId" = "Trip".id
      AND role = 'editor'
  )
) WITH CHECK (
  (
    auth.uid()::text = "createdById"
    OR auth.uid()::text IN (
      SELECT "userId"
      FROM "UserTripRole"
      WHERE "tripId" = "Trip".id
        AND role = 'editor'
    )
  )
  AND "createdById" = (
    SELECT current_trip."createdById"
    FROM "Trip" AS current_trip
    WHERE current_trip.id = "Trip".id
  )
);
CREATE POLICY "Only trip owner can delete" ON "Trip" FOR DELETE USING (auth.uid()::text = "createdById");

-- TripMember policies
CREATE POLICY "Trip members can view all trip members" ON "TripMember" FOR SELECT USING (
  auth.uid() IS NOT NULL
);
CREATE POLICY "Users can join trips" ON "TripMember" FOR INSERT WITH CHECK (auth.uid()::text = "userId");
CREATE POLICY "Trip owner can add members" ON "TripMember" FOR INSERT WITH CHECK (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = "TripMember"."tripId"
  )
);
CREATE POLICY "Users can leave trips" ON "TripMember" FOR DELETE USING (auth.uid()::text = "userId");
CREATE POLICY "Trip owner can revoke members" ON "TripMember" FOR DELETE USING (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = "TripMember"."tripId"
  )
  AND "TripMember"."userId" <> auth.uid()::text
);

-- SurveyDate policies
CREATE POLICY "Trip members can view survey dates" ON "SurveyDate" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "SurveyDate"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "SurveyDate"."tripId"
  )
);
CREATE POLICY "Only trip owner can manage survey dates" ON "SurveyDate" FOR INSERT WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "SurveyDate"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "SurveyDate"."tripId" AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can update survey dates" ON "SurveyDate" FOR UPDATE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "SurveyDate"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "SurveyDate"."tripId" AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can delete survey dates" ON "SurveyDate" FOR DELETE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "SurveyDate"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "SurveyDate"."tripId" AND role = 'editor'
  )
);

-- UserAvailability policies
CREATE POLICY "Trip members can view all availability" ON "UserAvailability" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "UserAvailability"."tripId"
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = "UserAvailability"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "UserAvailability"."tripId"
  )
);
CREATE POLICY "Users can set their own availability" ON "UserAvailability" FOR INSERT WITH CHECK (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "UserAvailability"."tripId"
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = "UserAvailability"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "UserAvailability"."tripId"
  )
);
CREATE POLICY "Users can update their own availability" ON "UserAvailability" FOR UPDATE USING (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "UserAvailability"."tripId"
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = "UserAvailability"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "UserAvailability"."tripId"
  )
) WITH CHECK (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "UserAvailability"."tripId"
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = "UserAvailability"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "UserAvailability"."tripId"
  )
);
CREATE POLICY "Users can delete their own availability" ON "UserAvailability" FOR DELETE USING (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "UserAvailability"."tripId"
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = "UserAvailability"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "UserAvailability"."tripId"
  )
);

-- Idea policies: Suggestors can create/view, edit own
CREATE POLICY "Trip members can view ideas" ON "Idea" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "Idea"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "Idea"."tripId"
  )
);
CREATE POLICY "Suggestors can create ideas" ON "Idea" FOR INSERT WITH CHECK (
  auth.uid()::text = "createdById" AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "Idea"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "Idea"."tripId"
  )
);
CREATE POLICY "Idea creator or owner can update" ON "Idea" FOR UPDATE USING (
  auth.uid()::text = "createdById" OR
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "Idea"."tripId") OR
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "Idea"."tripId" AND role = 'editor'
  )
) WITH CHECK (
  auth.uid()::text = "createdById" OR
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "Idea"."tripId") OR
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "Idea"."tripId" AND role = 'editor'
  )
);
CREATE POLICY "Idea creator or owner can delete" ON "Idea" FOR DELETE USING (
  auth.uid()::text = "createdById" OR
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "Idea"."tripId") OR
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "Idea"."tripId" AND role = 'editor'
  )
);

-- Vote policies: Anyone in trip can vote
CREATE POLICY "Trip members can view votes" ON "Vote" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "Idea" WHERE id = "Vote"."ideaId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "Idea" WHERE id = "Vote"."ideaId")
  )
);
CREATE POLICY "Trip members can vote" ON "Vote" FOR INSERT WITH CHECK (
  auth.uid()::text = "userId" AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "Idea" WHERE id = "Vote"."ideaId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "Idea" WHERE id = "Vote"."ideaId")
  )
);
CREATE POLICY "Users can update their own votes" ON "Vote" FOR UPDATE USING (auth.uid()::text = "userId");
CREATE POLICY "Users can delete their own votes" ON "Vote" FOR DELETE USING (auth.uid()::text = "userId");

-- ItineraryDay policies: Owner manages, suggestors view
CREATE POLICY "Trip members can view itinerary days" ON "ItineraryDay" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "ItineraryDay"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "ItineraryDay"."tripId"
  )
);
CREATE POLICY "Only trip owner can create itinerary days" ON "ItineraryDay" FOR INSERT WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "ItineraryDay"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "ItineraryDay"."tripId" AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can update itinerary days" ON "ItineraryDay" FOR UPDATE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "ItineraryDay"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "ItineraryDay"."tripId" AND role = 'editor'
  )
) WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "ItineraryDay"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "ItineraryDay"."tripId" AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can delete itinerary days" ON "ItineraryDay" FOR DELETE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "ItineraryDay"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "ItineraryDay"."tripId" AND role = 'editor'
  )
);

-- ItineraryItem policies: Owner manages
CREATE POLICY "Trip members can view itinerary items" ON "ItineraryItem" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
  )
);
CREATE POLICY "Only trip owner can create itinerary items" ON "ItineraryItem" FOR INSERT WITH CHECK (
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
  )
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
      AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can update itinerary items" ON "ItineraryItem" FOR UPDATE USING (
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
  )
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
      AND role = 'editor'
  )
) WITH CHECK (
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
  )
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
      AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can delete itinerary items" ON "ItineraryItem" FOR DELETE USING (
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
  )
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryItem"."itineraryDayId")
      AND role = 'editor'
  )
);

-- TripTabConfiguration policies: Owner only
CREATE POLICY "Trip members can view tabs" ON "TripTabConfiguration" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripTabConfiguration"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "TripTabConfiguration"."tripId"
  )
);
CREATE POLICY "Only trip owner can create tabs" ON "TripTabConfiguration" FOR INSERT WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "TripTabConfiguration"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "TripTabConfiguration"."tripId" AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can update tabs" ON "TripTabConfiguration" FOR UPDATE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "TripTabConfiguration"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "TripTabConfiguration"."tripId" AND role = 'editor'
  )
) WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "TripTabConfiguration"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "TripTabConfiguration"."tripId" AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can delete tabs" ON "TripTabConfiguration" FOR DELETE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "TripTabConfiguration"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "TripTabConfiguration"."tripId" AND role = 'editor'
  )
);

-- TripTabPreference policies: Users manage their own preference
CREATE POLICY "Users can view their tab preferences" ON "TripTabPreference" FOR SELECT USING (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripTabPreference"."tripId"
    UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripTabPreference"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "TripTabPreference"."tripId"
  )
);
CREATE POLICY "Users can upsert their tab preferences" ON "TripTabPreference" FOR INSERT WITH CHECK (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripTabPreference"."tripId"
    UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripTabPreference"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "TripTabPreference"."tripId"
  )
);
CREATE POLICY "Users can update their tab preferences" ON "TripTabPreference" FOR UPDATE USING (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripTabPreference"."tripId"
    UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripTabPreference"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "TripTabPreference"."tripId"
  )
);
CREATE POLICY "Users can delete their tab preferences" ON "TripTabPreference" FOR DELETE USING (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripTabPreference"."tripId"
    UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripTabPreference"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "TripTabPreference"."tripId"
  )
);

-- UserTripRole policies: Owner only
CREATE POLICY "UserTripRole select own row" ON "UserTripRole" FOR SELECT USING (
  auth.uid()::text = "userId"
  OR auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = "UserTripRole"."tripId"
  )
  OR EXISTS (
    SELECT 1
    FROM "TripMember" tm
    WHERE tm."tripId" = "UserTripRole"."tripId"
      AND tm."userId" = auth.uid()::text
  )
);
CREATE POLICY "Only trip owner can assign roles" ON "UserTripRole" FOR INSERT WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "UserTripRole"."tripId")
  AND (
    role IN ('editor', 'suggestor')
    OR (
      role = 'owner'
      AND "userId" IN (SELECT "createdById" FROM "Trip" WHERE id = "UserTripRole"."tripId")
    )
  )
);
CREATE POLICY "Members or invitees can self-assign suggestor or editor role" ON "UserTripRole" FOR INSERT WITH CHECK (
  auth.uid()::text = "userId"
  AND role IN ('suggestor', 'editor')
  AND EXISTS (
    SELECT 1
    FROM "TripMember" tm
    WHERE tm."tripId" = "UserTripRole"."tripId"
      AND tm."userId" = auth.uid()::text
  )
);
CREATE POLICY "Only trip owner can update roles" ON "UserTripRole" FOR UPDATE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "UserTripRole"."tripId")
) WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "UserTripRole"."tripId")
  AND (
    role IN ('editor', 'suggestor')
    OR (
      role = 'owner'
      AND "userId" IN (SELECT "createdById" FROM "Trip" WHERE id = "UserTripRole"."tripId")
    )
  )
);
CREATE POLICY "Only trip owner can remove roles" ON "UserTripRole" FOR DELETE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "UserTripRole"."tripId")
  AND "UserTripRole"."userId" <> auth.uid()::text
);
CREATE POLICY "Users can remove their own non-owner role" ON "UserTripRole" FOR DELETE USING (
  auth.uid()::text = "userId"
  AND role IN ('suggestor', 'editor')
);

-- PendingTripInvite policies
CREATE POLICY "Owners can view pending invites" ON "PendingTripInvite" FOR SELECT USING (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = "PendingTripInvite"."tripId"
  )
);
CREATE POLICY "Invitees can view their pending invites" ON "PendingTripInvite" FOR SELECT USING (
  LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
);
CREATE POLICY "Owners can create pending invites" ON "PendingTripInvite" FOR INSERT WITH CHECK (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = "PendingTripInvite"."tripId"
  )
  AND role IN ('editor', 'suggestor')
);
CREATE POLICY "Owners can update pending invites" ON "PendingTripInvite" FOR UPDATE USING (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = "PendingTripInvite"."tripId"
  )
) WITH CHECK (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = "PendingTripInvite"."tripId"
  )
  AND role IN ('editor', 'suggestor')
);
CREATE POLICY "Invitees can accept pending invites" ON "PendingTripInvite" FOR UPDATE USING (
  status = 'pending'
  AND LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
) WITH CHECK (
  status = 'accepted'
  AND "acceptedByUserId" = auth.uid()::text
  AND "acceptedAt" IS NOT NULL
  AND LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
);
CREATE POLICY "Invitees can decline pending invites" ON "PendingTripInvite" FOR UPDATE USING (
  status = 'pending'
  AND LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
) WITH CHECK (
  status = 'canceled'
  AND "canceledAt" IS NOT NULL
  AND LOWER(email) = LOWER(COALESCE(auth.jwt() ->> 'email', ''))
);

-- AvailabilityTabData policies: Users manage their own
CREATE POLICY "Trip members can view availability data" ON "AvailabilityTabData" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
  )
);
CREATE POLICY "Users can create their own availability" ON "AvailabilityTabData" FOR INSERT WITH CHECK (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
  )
);
CREATE POLICY "Users can update their own availability" ON "AvailabilityTabData" FOR UPDATE USING (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
  )
) WITH CHECK (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
  )
);
CREATE POLICY "Users can delete their own availability" ON "AvailabilityTabData" FOR DELETE USING (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabData"."tabId")
  )
);

-- AvailabilityTabComment policies
CREATE POLICY "Trip members can view availability comments" ON "AvailabilityTabComment" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabComment"."tabId")
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabComment"."tabId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabComment"."tabId")
  )
);
CREATE POLICY "Trip members can post availability comments" ON "AvailabilityTabComment" FOR INSERT WITH CHECK (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabComment"."tabId")
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabComment"."tabId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabComment"."tabId")
  )
);
CREATE POLICY "Users can delete their own availability comments" ON "AvailabilityTabComment" FOR DELETE USING (
  auth.uid()::text = "userId"
);
CREATE POLICY "Users can edit their own availability comments" ON "AvailabilityTabComment" FOR UPDATE USING (
  auth.uid()::text = "userId"
) WITH CHECK (
  auth.uid()::text = "userId"
);

-- IdeaComment policies
CREATE POLICY "Trip members can view idea comments" ON "IdeaComment" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
  )
);
CREATE POLICY "Trip members can post idea comments" ON "IdeaComment" FOR INSERT WITH CHECK (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
  )
);
CREATE POLICY "Users can delete their own idea comments" ON "IdeaComment" FOR DELETE USING (
  auth.uid()::text = "userId"
);
CREATE POLICY "Users can edit their own idea comments" ON "IdeaComment" FOR UPDATE USING (
  auth.uid()::text = "userId"
) WITH CHECK (
  auth.uid()::text = "userId"
);

-- TransactionComment policies
CREATE POLICY "Trip members can view transaction comments" ON "TransactionComment" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
    UNION SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
    UNION SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
  )
);
CREATE POLICY "Trip members can post transaction comments" ON "TransactionComment" FOR INSERT WITH CHECK (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
    UNION SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
    UNION SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
  )
);
CREATE POLICY "Users can delete their own transaction comments" ON "TransactionComment" FOR DELETE USING (
  auth.uid()::text = "userId"
);
CREATE POLICY "Users can edit their own transaction comments" ON "TransactionComment" FOR UPDATE USING (
  auth.uid()::text = "userId"
) WITH CHECK (
  auth.uid()::text = "userId"
);

-- ItineraryDayComment policies
CREATE POLICY "Trip members can view itinerary day comments" ON "ItineraryDayComment" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
    UNION SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
    UNION SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
  )
);
CREATE POLICY "Trip members can post itinerary day comments" ON "ItineraryDayComment" FOR INSERT WITH CHECK (
  auth.uid()::text = "userId"
  AND auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
    UNION SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
    UNION SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
  )
);
CREATE POLICY "Users can delete their own itinerary day comments" ON "ItineraryDayComment" FOR DELETE USING (
  auth.uid()::text = "userId"
);
CREATE POLICY "Users can edit their own itinerary day comments" ON "ItineraryDayComment" FOR UPDATE USING (
  auth.uid()::text = "userId"
) WITH CHECK (
  auth.uid()::text = "userId"
);

-- List policies: Owner and editor can create lists
CREATE POLICY "Trip members can view lists" ON "List" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "List"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "List"."tripId"
  )
);
CREATE POLICY "Only owner and editor can create lists" ON "List" FOR INSERT WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "List"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "List"."tripId" AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can update lists" ON "List" FOR UPDATE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "List"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "List"."tripId" AND role = 'editor'
  )
) WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "List"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "List"."tripId" AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can delete lists" ON "List" FOR DELETE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "List"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "List"."tripId" AND role = 'editor'
  )
);

-- Transaction policies: Suggestors can create/view/edit own, owner can delete
CREATE POLICY "Trip members can view transactions" ON "Transaction" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "Transaction"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "Transaction"."tripId"
  )
);
CREATE POLICY "Suggestors can create transactions" ON "Transaction" FOR INSERT WITH CHECK (
  auth.uid()::text = "createdById" AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "Transaction"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "Transaction"."tripId"
  )
);
CREATE POLICY "Creator or owner can update transaction" ON "Transaction" FOR UPDATE USING (
  auth.uid()::text = "createdById" OR
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "Transaction"."tripId") OR
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "Transaction"."tripId" AND role = 'editor'
  )
) WITH CHECK (
  auth.uid()::text = "createdById" OR
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "Transaction"."tripId") OR
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "Transaction"."tripId" AND role = 'editor'
  )
);
CREATE POLICY "Creator or owner can delete transaction" ON "Transaction" FOR DELETE USING (
  auth.uid()::text = "createdById" OR
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "Transaction"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "Transaction"."tripId" AND role = 'editor'
  )
);

-- TransactionSplit policies: Creator/owner can manage
CREATE POLICY "Trip members can view splits" ON "TransactionSplit" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
  )
);
CREATE POLICY "Creator or owner can create splits" ON "TransactionSplit" FOR INSERT WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId") OR
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
  ) OR
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
      AND role = 'editor'
  )
);
CREATE POLICY "Creator or owner can update splits" ON "TransactionSplit" FOR UPDATE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId") OR
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
  ) OR
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
      AND role = 'editor'
  )
) WITH CHECK (
  auth.uid()::text IN (SELECT "createdById" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId") OR
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
  ) OR
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
      AND role = 'editor'
  )
);
CREATE POLICY "Creator or owner can delete splits" ON "TransactionSplit" FOR DELETE USING (
  auth.uid()::text IN (SELECT "createdById" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId") OR
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
  )
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
      AND role = 'editor'
  )
);

-- ItineraryTabConfiguration policies: Owner only
CREATE POLICY "Trip members can view itinerary config" ON "ItineraryTabConfiguration" FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "ItineraryTabConfiguration"."tabId")
    UNION SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "ItineraryTabConfiguration"."tabId")
  )
);
CREATE POLICY "Only trip owner can create itinerary config" ON "ItineraryTabConfiguration" FOR INSERT WITH CHECK (
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "ItineraryTabConfiguration"."tabId")
  )
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "ItineraryTabConfiguration"."tabId")
      AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can update itinerary config" ON "ItineraryTabConfiguration" FOR UPDATE USING (
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "ItineraryTabConfiguration"."tabId")
  )
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "ItineraryTabConfiguration"."tabId")
      AND role = 'editor'
  )
) WITH CHECK (
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "ItineraryTabConfiguration"."tabId")
  )
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "ItineraryTabConfiguration"."tabId")
      AND role = 'editor'
  )
);
CREATE POLICY "Only trip owner can delete itinerary config" ON "ItineraryTabConfiguration" FOR DELETE USING (
  auth.uid()::text IN (
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "ItineraryTabConfiguration"."tabId")
  )
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "ItineraryTabConfiguration"."tabId")
      AND role = 'editor'
  )
);

-- ============================================
-- SETUP COMPLETE
-- ============================================
-- Your Tripable database is optimized for:
--
-- 📊 PERFORMANCE:
-- ✓ 17 tables with normalized schema
-- ✓ 45+ composite and performance indexes
-- ✓ All date columns use TIMESTAMPTZ for accuracy
-- ✓ Foreign key constraints for data integrity
--
-- 🔐 SECURITY (Owner/Editor/Suggestor Model):
-- ✓ 80+ RLS policies enforcing user permissions
-- ✓ OWNER (creator only): Full admin, member permissions, invites, revoke access, delete trip
-- ✓ EDITOR: CRUD on trip content/tabs/itinerary/lists/transactions, no member permissions/invites/delete-trip
-- ✓ SUGGESTOR: READ all, CREATE ideas/votes/transactions,
--              EDIT own content, no admin functions
-- ✓ TripMember: READ only access to shared data
--
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
--
-- Legend: C=Create, R=Read, U=Update, D=Delete, -=No access
-- (own) = only own content
