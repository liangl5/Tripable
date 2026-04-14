-- TripTabPreference (per-user active tab)
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
