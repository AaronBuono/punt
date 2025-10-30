-- AlterTable
ALTER TABLE "EncryptedBet" ADD COLUMN     "outcome" TEXT NOT NULL DEFAULT 'Pending',
ADD COLUMN     "pollTitle" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "winningSide" INTEGER;

-- CreateIndex
CREATE INDEX "EncryptedBet_outcome_idx" ON "EncryptedBet"("outcome");
