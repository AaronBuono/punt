-- CreateTable
CREATE TABLE "Stream" (
  "authority" TEXT NOT NULL PRIMARY KEY,
  "livepeerId" TEXT NOT NULL,
  "playbackId" TEXT NOT NULL,
  "streamKey" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT FALSE,
  "viewerCount" INTEGER NOT NULL DEFAULT 0,
  "manuallyStopped" BOOLEAN NOT NULL DEFAULT FALSE,
  "startedAt" TIMESTAMPTZ,
  "endedAt" TIMESTAMPTZ,
  "lastFetched" TIMESTAMPTZ,
  "lastMetricsFetched" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Stream_livepeerId_key" ON "Stream"("livepeerId");
