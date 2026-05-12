-- Add Splitwise-style settlement tracking for expense splits.
-- Run this on existing databases after deploying the app changes.

BEGIN;

CREATE TABLE IF NOT EXISTS "TransactionSettlement" (
  id TEXT PRIMARY KEY,
  "tripId" TEXT NOT NULL REFERENCES "Trip"(id) ON DELETE CASCADE,
  "sourceSplitId" TEXT REFERENCES "TransactionSplit"(id) ON DELETE CASCADE,
  "fromUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "toUserId" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  note TEXT DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'void')),
  "createdById" TEXT NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  "markedPaidAt" TIMESTAMPTZ,
  "confirmedByUserId" TEXT REFERENCES "User"(id) ON DELETE SET NULL,
  "confirmedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_transaction_settlement_amount CHECK (amount > 0),
  CONSTRAINT chk_transaction_settlement_users CHECK ("fromUserId" <> "toUserId")
);

CREATE INDEX IF NOT EXISTS idx_transaction_settlement_trip ON "TransactionSettlement"("tripId");
CREATE INDEX IF NOT EXISTS idx_transaction_settlement_split ON "TransactionSettlement"("sourceSplitId");
CREATE INDEX IF NOT EXISTS idx_transaction_settlement_from_user ON "TransactionSettlement"("fromUserId");
CREATE INDEX IF NOT EXISTS idx_transaction_settlement_to_user ON "TransactionSettlement"("toUserId");
CREATE INDEX IF NOT EXISTS idx_transaction_settlement_status ON "TransactionSettlement"("status");

ALTER TABLE "TransactionSettlement" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Trip members can view transaction settlements" ON "TransactionSettlement";
CREATE POLICY "Trip members can view transaction settlements" ON "TransactionSettlement"
FOR SELECT USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TransactionSettlement"."tripId"
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = "TransactionSettlement"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "TransactionSettlement"."tripId"
  )
);

DROP POLICY IF EXISTS "Trip members can create transaction settlements" ON "TransactionSettlement";
CREATE POLICY "Trip members can create transaction settlements" ON "TransactionSettlement"
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  auth.uid()::text = "createdById" AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TransactionSettlement"."tripId"
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = "TransactionSettlement"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "TransactionSettlement"."tripId"
  ) AND
  "fromUserId" IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TransactionSettlement"."tripId"
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = "TransactionSettlement"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "TransactionSettlement"."tripId"
  ) AND
  "toUserId" IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "TransactionSettlement"."tripId"
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = "TransactionSettlement"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "TransactionSettlement"."tripId"
  )
);

DROP POLICY IF EXISTS "Trip members can update transaction settlements" ON "TransactionSettlement";
CREATE POLICY "Trip members can update transaction settlements" ON "TransactionSettlement"
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = "createdById" OR
    auth.uid()::text = "fromUserId" OR
    auth.uid()::text = "toUserId" OR
    auth.uid()::text IN (
      SELECT "createdById" FROM "Trip" WHERE id = "TransactionSettlement"."tripId"
    ) OR
    auth.uid()::text IN (
      SELECT "userId" FROM "UserTripRole"
      WHERE "tripId" = "TransactionSettlement"."tripId" AND role = 'editor'
    )
  )
) WITH CHECK (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = "createdById" OR
    auth.uid()::text = "fromUserId" OR
    auth.uid()::text = "toUserId" OR
    auth.uid()::text IN (
      SELECT "createdById" FROM "Trip" WHERE id = "TransactionSettlement"."tripId"
    ) OR
    auth.uid()::text IN (
      SELECT "userId" FROM "UserTripRole"
      WHERE "tripId" = "TransactionSettlement"."tripId" AND role = 'editor'
    )
  )
);

DROP POLICY IF EXISTS "Trip members can delete transaction settlements" ON "TransactionSettlement";
CREATE POLICY "Trip members can delete transaction settlements" ON "TransactionSettlement"
FOR DELETE USING (
  auth.uid() IS NOT NULL AND (
    auth.uid()::text = "createdById" OR
    auth.uid()::text IN (
      SELECT "createdById" FROM "Trip" WHERE id = "TransactionSettlement"."tripId"
    ) OR
    auth.uid()::text IN (
      SELECT "userId" FROM "UserTripRole"
      WHERE "tripId" = "TransactionSettlement"."tripId" AND role = 'editor'
    )
  )
);

COMMIT;