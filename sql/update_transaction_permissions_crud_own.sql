-- Align expenses permissions with CRUD-own behavior for suggestors.
-- Safe to run multiple times.

DROP POLICY IF EXISTS "Only trip owner can delete transaction" ON "Transaction";
DROP POLICY IF EXISTS "Creator or owner can delete transaction" ON "Transaction";
CREATE POLICY "Creator or owner can delete transaction" ON "Transaction" FOR DELETE USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole" WHERE "tripId" = "Transaction"."tripId"
    UNION SELECT "userId" FROM "TripMember" WHERE "tripId" = "Transaction"."tripId"
    UNION SELECT "createdById" FROM "Trip" WHERE id = "Transaction"."tripId"
  ) AND (
    "paidByUserId" IS NULL OR
    auth.uid()::text = "paidByUserId" OR
    auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = "Transaction"."tripId") OR
    auth.uid()::text IN (
      SELECT "userId" FROM "UserTripRole"
      WHERE "tripId" = "Transaction"."tripId" AND role = 'editor'
    )
  )
);

DROP POLICY IF EXISTS "Creator can create splits" ON "TransactionSplit";
DROP POLICY IF EXISTS "Creator or owner can create splits" ON "TransactionSplit";
CREATE POLICY "Creator or owner can create splits" ON "TransactionSplit" FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
    UNION SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
    UNION SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
  ) AND (
    (SELECT "paidByUserId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId") IS NULL OR
    auth.uid()::text = (SELECT "paidByUserId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId") OR
    auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")) OR
    auth.uid()::text IN (
      SELECT "userId" FROM "UserTripRole"
      WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
        AND role = 'editor'
    )
  )
);

DROP POLICY IF EXISTS "Only owner can delete splits" ON "TransactionSplit";
DROP POLICY IF EXISTS "Creator or owner can delete splits" ON "TransactionSplit";
CREATE POLICY "Creator or owner can delete splits" ON "TransactionSplit" FOR DELETE USING (
  auth.uid() IS NOT NULL AND
  auth.uid()::text IN (
    SELECT "userId" FROM "UserTripRole"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
    UNION SELECT "userId" FROM "TripMember"
    WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
    UNION SELECT "createdById" FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
  ) AND (
    (SELECT "paidByUserId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId") IS NULL OR
    auth.uid()::text = (SELECT "paidByUserId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId") OR
    auth.uid()::text IN (SELECT "createdById" FROM "Trip" WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")) OR
    auth.uid()::text IN (
      SELECT "userId" FROM "UserTripRole"
      WHERE "tripId" = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionSplit"."transactionId")
        AND role = 'editor'
    )
  )
);
