-- Adds threaded comments for Expense transactions, List activities, and Itinerary days.
-- Safe to run multiple times.

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
