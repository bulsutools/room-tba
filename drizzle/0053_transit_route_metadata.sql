-- BulSU Malolos transit layer (#6): route metadata and per-segment fares.
--
-- operator: vehicle class (jeepney | bus | tricycle); existing rows are all
-- jeeps, so the default backfills them honestly.
-- route_number: the signboard text riders look for ("BACO", "C1"), nullable
-- because not every operator posts one.
-- segment_fare_*: fare charged for the hop from the previous stop to this
-- stop. NULL means the route's flat fare applies; real Malolos fares are
-- field-collected under #7, so nothing is seeded yet.
ALTER TABLE "jeepney_routes"
  ADD COLUMN IF NOT EXISTS "route_number" varchar(32),
  ADD COLUMN IF NOT EXISTS "operator" varchar(16) DEFAULT 'jeepney' NOT NULL;

ALTER TABLE "jeepney_stops"
  ADD COLUMN IF NOT EXISTS "segment_fare_regular" double precision,
  ADD COLUMN IF NOT EXISTS "segment_fare_discounted" double precision;
