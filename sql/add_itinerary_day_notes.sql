-- Adds editable notes to itinerary days.
-- Safe to run multiple times.

ALTER TABLE "ItineraryDay"
  ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
