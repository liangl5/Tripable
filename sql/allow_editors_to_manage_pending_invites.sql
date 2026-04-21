DROP POLICY IF EXISTS "Owners can view pending invites" ON "PendingTripInvite";
DROP POLICY IF EXISTS "Owners can create pending invites" ON "PendingTripInvite";
DROP POLICY IF EXISTS "Owners can update pending invites" ON "PendingTripInvite";
DROP POLICY IF EXISTS "Owners and editors can view pending invites" ON "PendingTripInvite";
DROP POLICY IF EXISTS "Owners and editors can create pending invites" ON "PendingTripInvite";
DROP POLICY IF EXISTS "Owners and editors can update pending invites" ON "PendingTripInvite";

CREATE POLICY "Owners and editors can view pending invites" ON "PendingTripInvite" FOR SELECT USING (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = "PendingTripInvite"."tripId"
  )
  OR EXISTS (
    SELECT 1
    FROM "UserTripRole"
    WHERE "tripId" = "PendingTripInvite"."tripId"
      AND "userId" = auth.uid()::text
      AND role = 'editor'
  )
);

CREATE POLICY "Owners and editors can create pending invites" ON "PendingTripInvite" FOR INSERT WITH CHECK (
  (
    auth.uid()::text IN (
      SELECT "createdById"
      FROM "Trip"
      WHERE id = "PendingTripInvite"."tripId"
    )
    OR EXISTS (
      SELECT 1
      FROM "UserTripRole"
      WHERE "tripId" = "PendingTripInvite"."tripId"
        AND "userId" = auth.uid()::text
        AND role = 'editor'
    )
  )
  AND role IN ('editor', 'suggestor')
);

CREATE POLICY "Owners and editors can update pending invites" ON "PendingTripInvite" FOR UPDATE USING (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = "PendingTripInvite"."tripId"
  )
  OR EXISTS (
    SELECT 1
    FROM "UserTripRole"
    WHERE "tripId" = "PendingTripInvite"."tripId"
      AND "userId" = auth.uid()::text
      AND role = 'editor'
  )
) WITH CHECK (
  (
    auth.uid()::text IN (
      SELECT "createdById"
      FROM "Trip"
      WHERE id = "PendingTripInvite"."tripId"
    )
    OR EXISTS (
      SELECT 1
      FROM "UserTripRole"
      WHERE "tripId" = "PendingTripInvite"."tripId"
        AND "userId" = auth.uid()::text
        AND role = 'editor'
    )
  )
  AND role IN ('editor', 'suggestor')
);
