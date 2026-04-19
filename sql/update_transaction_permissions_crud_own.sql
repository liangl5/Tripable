-- Align expenses permissions with CRUD-own behavior for suggestors.
-- Safe to run multiple times.

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
