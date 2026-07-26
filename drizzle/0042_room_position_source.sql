-- Distinguish positions an editor dragged into place from ones the room-code
-- inference suggested (src/lib/room-placement.ts). Existing rows are all human
-- work, so they baseline to 'manual' and inference can never overwrite them.
ALTER TABLE "room_positions"
  ADD COLUMN IF NOT EXISTS "source" varchar(16) DEFAULT 'manual' NOT NULL;
