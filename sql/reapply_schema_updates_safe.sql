-- Tripable safe schema re-apply script (non-destructive)
-- Purpose: apply latest schema and policy updates without dropping tables.
-- Safe to run multiple times.
--
-- Important:
-- 1) Do NOT run COMPLETE_SCHEMA.sql on an existing database.
-- 2) This script intentionally keeps all existing data.
-- 3) One section cleans up orphan ideas created by an older FK behavior.

BEGIN;

-- ============================================================
-- Remove photo avatar columns (keep color avatar)
-- Source: sql/remove_user_photo_columns.sql
-- ============================================================
ALTER TABLE "User" DROP COLUMN IF EXISTS "photoUrl";
ALTER TABLE "User" DROP COLUMN IF EXISTS "avatarCrop";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarColor" TEXT;

-- ============================================================
-- Fix List -> Idea delete behavior and clean old orphans
-- Source: sql/fix_idea_list_fk_cascade_cleanup_orphans.sql
-- ============================================================
UPDATE "ItineraryItem"
SET "ideaId" = NULL
WHERE "ideaId" IN (SELECT id FROM "Idea" WHERE "listId" IS NULL);

DELETE FROM "Vote"
WHERE "ideaId" IN (SELECT id FROM "Idea" WHERE "listId" IS NULL);

DELETE FROM "Idea"
WHERE "listId" IS NULL;

ALTER TABLE "Idea" DROP CONSTRAINT IF EXISTS fk_idea_list;
ALTER TABLE "Idea"
  ADD CONSTRAINT fk_idea_list
  FOREIGN KEY ("listId") REFERENCES "List"(id)
  ON DELETE CASCADE;

-- ============================================================
-- Add per-user active tab preference
-- Source: sql/add_trip_tab_preferences.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS "TripTabPreference" (
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "activeTabId" TEXT REFERENCES "TripTabConfiguration"(id) ON DELETE SET NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("tripId", "userId")
);

CREATE INDEX IF NOT EXISTS idx_trip_tab_preference_trip ON "TripTabPreference"("tripId");
CREATE INDEX IF NOT EXISTS idx_trip_tab_preference_user ON "TripTabPreference"("userId");

ALTER TABLE "TripTabPreference" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their tab preferences" ON "TripTabPreference";
CREATE POLICY "Users can view their tab preferences" ON "TripTabPreference"
  FOR SELECT USING (
    auth.uid()::text = "userId" AND auth.uid()::text IN (
      SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripTabPreference"."tripId"
      UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripTabPreference"."tripId"
      UNION SELECT "createdById" FROM "Trip" WHERE id = "TripTabPreference"."tripId"
    )
  );

DROP POLICY IF EXISTS "Users can upsert their tab preferences" ON "TripTabPreference";
CREATE POLICY "Users can upsert their tab preferences" ON "TripTabPreference"
  FOR INSERT WITH CHECK (
    auth.uid()::text = "userId" AND auth.uid()::text IN (
      SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripTabPreference"."tripId"
      UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripTabPreference"."tripId"
      UNION SELECT "createdById" FROM "Trip" WHERE id = "TripTabPreference"."tripId"
    )
  );

DROP POLICY IF EXISTS "Users can update their tab preferences" ON "TripTabPreference";
CREATE POLICY "Users can update their tab preferences" ON "TripTabPreference"
  FOR UPDATE USING (
    auth.uid()::text = "userId" AND auth.uid()::text IN (
      SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripTabPreference"."tripId"
      UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripTabPreference"."tripId"
      UNION SELECT "createdById" FROM "Trip" WHERE id = "TripTabPreference"."tripId"
    )
  );

DROP POLICY IF EXISTS "Users can delete their tab preferences" ON "TripTabPreference";
CREATE POLICY "Users can delete their tab preferences" ON "TripTabPreference"
  FOR DELETE USING (
    auth.uid()::text = "userId" AND auth.uid()::text IN (
      SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripTabPreference"."tripId"
      UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripTabPreference"."tripId"
      UNION SELECT "createdById" FROM "Trip" WHERE id = "TripTabPreference"."tripId"
    )
  );

-- ============================================================
-- Add per-user starred trips
-- Source: sql/add_trip_stars.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS "TripStar" (
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("tripId", "userId")
);

CREATE INDEX IF NOT EXISTS idx_trip_star_trip ON "TripStar"("tripId");
CREATE INDEX IF NOT EXISTS idx_trip_star_user ON "TripStar"("userId");

ALTER TABLE "TripStar" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their starred trips" ON "TripStar";
CREATE POLICY "Users can view their starred trips" ON "TripStar"
  FOR SELECT USING (
    auth.uid()::text = "userId" AND auth.uid()::text IN (
      SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripStar"."tripId"
      UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripStar"."tripId"
      UNION SELECT "createdById" FROM "Trip" WHERE id = "TripStar"."tripId"
    )
  );

DROP POLICY IF EXISTS "Users can star trips" ON "TripStar";
CREATE POLICY "Users can star trips" ON "TripStar"
  FOR INSERT WITH CHECK (
    auth.uid()::text = "userId" AND auth.uid()::text IN (
      SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripStar"."tripId"
      UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripStar"."tripId"
      UNION SELECT "createdById" FROM "Trip" WHERE id = "TripStar"."tripId"
    )
  );

DROP POLICY IF EXISTS "Users can unstar trips" ON "TripStar";
CREATE POLICY "Users can unstar trips" ON "TripStar"
  FOR DELETE USING (
    auth.uid()::text = "userId" AND auth.uid()::text IN (
      SELECT "userId" FROM "TripMember" WHERE "tripId" = "TripStar"."tripId"
      UNION SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TripStar"."tripId"
      UNION SELECT "createdById" FROM "Trip" WHERE id = "TripStar"."tripId"
    )
  );

-- ============================================================
-- Add Availability tab comments
-- Source: sql/add_availability_tab_comments.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS "AvailabilityTabComment" (
  id TEXT PRIMARY KEY,
  "tabId" TEXT NOT NULL REFERENCES "TripTabConfiguration"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "parentCommentId" TEXT REFERENCES "AvailabilityTabComment"(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE "AvailabilityTabComment"
  ADD COLUMN IF NOT EXISTS "parentCommentId" TEXT;

ALTER TABLE "AvailabilityTabComment"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_availability_comment_parent'
  ) THEN
    ALTER TABLE "AvailabilityTabComment"
      ADD CONSTRAINT fk_availability_comment_parent
      FOREIGN KEY ("parentCommentId")
      REFERENCES "AvailabilityTabComment"(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_availability_tab_comment_tab
  ON "AvailabilityTabComment"("tabId");

CREATE INDEX IF NOT EXISTS idx_availability_tab_comment_created
  ON "AvailabilityTabComment"("createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_availability_tab_comment_parent
  ON "AvailabilityTabComment"("parentCommentId");

ALTER TABLE "AvailabilityTabComment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members can view availability comments" ON "AvailabilityTabComment";
CREATE POLICY "Trip members can view availability comments" ON "AvailabilityTabComment"
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (
      SELECT "tripId" FROM "TripTabConfiguration"
      WHERE id = "AvailabilityTabComment"."tabId"
    )
    UNION
    SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (
      SELECT "tripId" FROM "TripTabConfiguration"
      WHERE id = "AvailabilityTabComment"."tabId"
    )
    UNION
    SELECT "createdById" FROM "Trip"
    WHERE id = (
      SELECT "tripId" FROM "TripTabConfiguration"
      WHERE id = "AvailabilityTabComment"."tabId"
    )
  )
);

DROP POLICY IF EXISTS "Trip members can post availability comments" ON "AvailabilityTabComment";
CREATE POLICY "Trip members can post availability comments" ON "AvailabilityTabComment"
FOR INSERT WITH CHECK (
  auth.uid()::text = "userId" AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (
      SELECT "tripId" FROM "TripTabConfiguration"
      WHERE id = "AvailabilityTabComment"."tabId"
    )
    UNION
    SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (
      SELECT "tripId" FROM "TripTabConfiguration"
      WHERE id = "AvailabilityTabComment"."tabId"
    )
    UNION
    SELECT "createdById" FROM "Trip"
    WHERE id = (
      SELECT "tripId" FROM "TripTabConfiguration"
      WHERE id = "AvailabilityTabComment"."tabId"
    )
  )
);

DROP POLICY IF EXISTS "Users can delete their own availability comments" ON "AvailabilityTabComment";
CREATE POLICY "Users can delete their own availability comments" ON "AvailabilityTabComment"
FOR DELETE USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can edit their own availability comments" ON "AvailabilityTabComment";
CREATE POLICY "Users can edit their own availability comments" ON "AvailabilityTabComment"
FOR UPDATE USING (auth.uid()::text = "userId")
WITH CHECK (auth.uid()::text = "userId");

-- ============================================================
-- Add editable itinerary day notes
-- Source: sql/add_itinerary_day_notes.sql
-- ============================================================
ALTER TABLE "ItineraryDay"
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- ============================================================
-- Add comments for transactions, ideas, itinerary days
-- Source: sql/add_trip_feature_comments.sql
-- ============================================================
CREATE TABLE IF NOT EXISTS "TransactionComment" (
  id TEXT PRIMARY KEY,
  "transactionId" TEXT NOT NULL REFERENCES "Transaction"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "parentCommentId" TEXT REFERENCES "TransactionComment"(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "IdeaComment" (
  id TEXT PRIMARY KEY,
  "ideaId" TEXT NOT NULL REFERENCES "Idea"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "parentCommentId" TEXT REFERENCES "IdeaComment"(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ItineraryDayComment" (
  id TEXT PRIMARY KEY,
  "itineraryDayId" TEXT NOT NULL REFERENCES "ItineraryDay"(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "parentCommentId" TEXT REFERENCES "ItineraryDayComment"(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_comment_transaction ON "TransactionComment"("transactionId");
CREATE INDEX IF NOT EXISTS idx_transaction_comment_created ON "TransactionComment"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_comment_parent ON "TransactionComment"("parentCommentId");

CREATE INDEX IF NOT EXISTS idx_idea_comment_idea ON "IdeaComment"("ideaId");
CREATE INDEX IF NOT EXISTS idx_idea_comment_created ON "IdeaComment"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_idea_comment_parent ON "IdeaComment"("parentCommentId");

CREATE INDEX IF NOT EXISTS idx_itinerary_day_comment_day ON "ItineraryDayComment"("itineraryDayId");
CREATE INDEX IF NOT EXISTS idx_itinerary_day_comment_created ON "ItineraryDayComment"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS idx_itinerary_day_comment_parent ON "ItineraryDayComment"("parentCommentId");

ALTER TABLE "TransactionComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IdeaComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItineraryDayComment" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members can view transaction comments" ON "TransactionComment";
CREATE POLICY "Trip members can view transaction comments" ON "TransactionComment"
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
    UNION
    SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
    UNION
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
  )
);

DROP POLICY IF EXISTS "Trip members can post transaction comments" ON "TransactionComment";
CREATE POLICY "Trip members can post transaction comments" ON "TransactionComment"
FOR INSERT WITH CHECK (
  auth.uid()::text = "userId" AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
    UNION
    SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
    UNION
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
  )
);

DROP POLICY IF EXISTS "Users can delete their own transaction comments" ON "TransactionComment";
CREATE POLICY "Users can delete their own transaction comments" ON "TransactionComment"
FOR DELETE USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can edit their own transaction comments" ON "TransactionComment";
CREATE POLICY "Users can edit their own transaction comments" ON "TransactionComment"
FOR UPDATE USING (auth.uid()::text = "userId")
WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Trip members can view idea comments" ON "IdeaComment";
CREATE POLICY "Trip members can view idea comments" ON "IdeaComment"
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
    UNION
    SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
    UNION
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
  )
);

DROP POLICY IF EXISTS "Trip members can post idea comments" ON "IdeaComment";
CREATE POLICY "Trip members can post idea comments" ON "IdeaComment"
FOR INSERT WITH CHECK (
  auth.uid()::text = "userId" AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
    UNION
    SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
    UNION
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
  )
);

DROP POLICY IF EXISTS "Users can delete their own idea comments" ON "IdeaComment";
CREATE POLICY "Users can delete their own idea comments" ON "IdeaComment"
FOR DELETE USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can edit their own idea comments" ON "IdeaComment";
CREATE POLICY "Users can edit their own idea comments" ON "IdeaComment"
FOR UPDATE USING (auth.uid()::text = "userId")
WITH CHECK (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Trip members can view itinerary day comments" ON "ItineraryDayComment";
CREATE POLICY "Trip members can view itinerary day comments" ON "ItineraryDayComment"
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
    UNION
    SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
    UNION
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
  )
);

DROP POLICY IF EXISTS "Trip members can post itinerary day comments" ON "ItineraryDayComment";
CREATE POLICY "Trip members can post itinerary day comments" ON "ItineraryDayComment"
FOR INSERT WITH CHECK (
  auth.uid()::text = "userId" AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
    UNION
    SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
    UNION
    SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
  )
);

DROP POLICY IF EXISTS "Users can delete their own itinerary day comments" ON "ItineraryDayComment";
CREATE POLICY "Users can delete their own itinerary day comments" ON "ItineraryDayComment"
FOR DELETE USING (auth.uid()::text = "userId");

DROP POLICY IF EXISTS "Users can edit their own itinerary day comments" ON "ItineraryDayComment";
CREATE POLICY "Users can edit their own itinerary day comments" ON "ItineraryDayComment"
FOR UPDATE USING (auth.uid()::text = "userId")
WITH CHECK (auth.uid()::text = "userId");

-- ============================================================
-- Align transaction and split delete permissions with CRUD-own
-- Source: sql/update_transaction_permissions_crud_own.sql
-- ============================================================
DROP POLICY IF EXISTS "Only trip owner can delete transaction" ON "Transaction";
DROP POLICY IF EXISTS "Creator or owner can delete transaction" ON "Transaction";
CREATE POLICY "Creator or owner can delete transaction" ON "Transaction" FOR DELETE USING (
  auth.uid()::text = "createdById" OR
  auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "Transaction"."tripId")
  OR auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = "Transaction"."tripId" AND role = 'editor'
  )
);

DROP POLICY IF EXISTS "Creator can create splits" ON "TransactionSplit";
DROP POLICY IF EXISTS "Creator or owner can create splits" ON "TransactionSplit";
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

DROP POLICY IF EXISTS "Only owner can delete splits" ON "TransactionSplit";
DROP POLICY IF EXISTS "Creator or owner can delete splits" ON "TransactionSplit";
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

COMMIT;
