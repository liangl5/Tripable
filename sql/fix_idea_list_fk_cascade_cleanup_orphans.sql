-- Fix list deletion behavior:
-- - When a list is deleted, its ideas should be deleted too (instead of leaving orphan pins / activity-bank items).
-- - Clean up existing orphan ideas where listId is NULL.
--
-- Safe to run multiple times.

-- 1) Clean up existing orphans (created by the previous ON DELETE SET NULL FK)
UPDATE "ItineraryItem"
SET "ideaId" = NULL
WHERE "ideaId" IN (SELECT id FROM "Idea" WHERE "listId" IS NULL);

DELETE FROM "Vote"
WHERE "ideaId" IN (SELECT id FROM "Idea" WHERE "listId" IS NULL);

DELETE FROM "Idea"
WHERE "listId" IS NULL;

-- 2) Update FK to cascade deletes from List -> Idea
ALTER TABLE "Idea" DROP CONSTRAINT IF EXISTS fk_idea_list;
ALTER TABLE "Idea"
  ADD CONSTRAINT fk_idea_list
  FOREIGN KEY ("listId") REFERENCES "List"(id)
  ON DELETE CASCADE;
