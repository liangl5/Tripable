DROP POLICY IF EXISTS "Trip owners can delete any availability comments" ON "AvailabilityTabComment";
DROP POLICY IF EXISTS "Trip owners can delete any idea comments" ON "IdeaComment";
DROP POLICY IF EXISTS "Trip owners can delete any transaction comments" ON "TransactionComment";
DROP POLICY IF EXISTS "Trip owners can delete any itinerary day comments" ON "ItineraryDayComment";

CREATE POLICY "Trip owners can delete any availability comments" ON "AvailabilityTabComment" FOR DELETE USING (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "TripTabConfiguration" WHERE id = "AvailabilityTabComment"."tabId")
  )
);

CREATE POLICY "Trip owners can delete any idea comments" ON "IdeaComment" FOR DELETE USING (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Idea" WHERE id = "IdeaComment"."ideaId")
  )
);

CREATE POLICY "Trip owners can delete any transaction comments" ON "TransactionComment" FOR DELETE USING (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "Transaction" WHERE id = "TransactionComment"."transactionId")
  )
);

CREATE POLICY "Trip owners can delete any itinerary day comments" ON "ItineraryDayComment" FOR DELETE USING (
  auth.uid()::text IN (
    SELECT "createdById"
    FROM "Trip"
    WHERE id = (SELECT "tripId" FROM "ItineraryDay" WHERE id = "ItineraryDayComment"."itineraryDayId")
  )
);
