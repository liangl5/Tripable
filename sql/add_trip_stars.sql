-- TripStar (per-user starred trips)
-- Lets users star trips without local storage.

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

