-- CreateTable
CREATE TABLE "Stream" (
  "authority" TEXT NOT NULL PRIMARY KEY,
  "livepeerId" TEXT NOT NULL,
  "playbackId" TEXT NOT NULL,
  "streamKey" TEXT NOT NULL,
  "isActive" INTEGER NOT NULL DEFAULT 0,
  "viewerCount" INTEGER NOT NULL DEFAULT 0,
  "manuallyStopped" INTEGER NOT NULL DEFAULT 0,
  "startedAt" DATETIME,
  "endedAt" DATETIME,
  "lastFetched" DATETIME,
  "lastMetricsFetched" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Stream_livepeerId_key" ON "Stream"("livepeerId");
