-- Migration: switch Stream records from Livepeer identifiers to LiveKit rooms

ALTER TABLE "Stream" DROP CONSTRAINT IF EXISTS "Stream_livepeerId_key";

ALTER TABLE "Stream"
  DROP COLUMN IF EXISTS "livepeerId",
  DROP COLUMN IF EXISTS "playbackId",
  DROP COLUMN IF EXISTS "streamKey",
  ADD COLUMN "roomName" TEXT;

UPDATE "Stream"
SET "roomName" = CONCAT('punt-', lower(regexp_replace("authority", '[^a-zA-Z0-9_-]', '', 'g')))
WHERE "roomName" IS NULL;

ALTER TABLE "Stream"
  ALTER COLUMN "roomName" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Stream_roomName_key" ON "Stream" ("roomName");

-- Clean up manuals: drop legacy columns handled above automatically.
