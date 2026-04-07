-- Adds Group Availability comments support (non-destructive)
-- Safe to run multiple times.

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
