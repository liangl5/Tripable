ALTER TABLE "Idea"
  ADD COLUMN IF NOT EXISTS "order" INTEGER;

UPDATE "Idea"
SET "order" = COALESCE("order", 0);

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "tripId", "listId"
      ORDER BY COALESCE("createdAt", NOW()), id
    ) - 1 AS new_order
  FROM "Idea"
)
UPDATE "Idea" AS idea
SET "order" = ranked.new_order
FROM ranked
WHERE idea.id = ranked.id;

ALTER TABLE "Idea"
  ALTER COLUMN "order" SET DEFAULT 0,
  ALTER COLUMN "order" SET NOT NULL;