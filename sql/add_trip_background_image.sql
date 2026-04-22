ALTER TABLE "Trip"
  ADD COLUMN IF NOT EXISTS "backgroundImage" TEXT;

WITH trip_backgrounds AS (
  SELECT ARRAY[
    'autumn_foliage.png',
    'bamboo_forest.png',
    'caribbean_beach.png',
    'colosseum_rome.png',
    'desert_oasis.png',
    'greece_coast.png',
    'hong_kong_harbor.png',
    'iceland_coast.png',
    'icy_aurora.png',
    'istanbul_turkey.png',
    'london_riverside.png',
    'los_angeles.png',
    'maldives_bungalows.png',
    'mediterranean_village.png',
    'new_york_skyline.png',
    'paris_riverside.png',
    'red_desert.png',
    'riverside_temple.png',
    'suburban_city.png',
    'swiss_alps_resort.png',
    'tokyo_river.png',
    'tropical_rainforest.png',
    'tulip.png'
  ]::text[] AS images
)
UPDATE "Trip"
SET "backgroundImage" = trip_backgrounds.images[
  floor(random() * array_length(trip_backgrounds.images, 1) + 1)::int
]
FROM trip_backgrounds
WHERE "backgroundImage" IS NULL
  OR "backgroundImage" = ''
  OR NOT ("backgroundImage" = ANY(trip_backgrounds.images));
