ALTER TABLE "Stream"
  ADD COLUMN "currentMarketPubkey" TEXT,
  ADD COLUMN "currentMarketCycle" INTEGER,
  ADD COLUMN "currentMarketUpdatedAt" TIMESTAMP(3);
