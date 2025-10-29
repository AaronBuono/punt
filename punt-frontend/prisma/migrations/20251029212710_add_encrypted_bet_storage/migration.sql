-- CreateTable
CREATE TABLE "EncryptedBet" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "side" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "arcisPublicKey" TEXT NOT NULL,
    "storedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncryptedBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EncryptedBet_wallet_idx" ON "EncryptedBet"("wallet");

-- CreateIndex
CREATE INDEX "EncryptedBet_pollId_idx" ON "EncryptedBet"("pollId");

-- CreateIndex
CREATE INDEX "EncryptedBet_wallet_storedAt_idx" ON "EncryptedBet"("wallet", "storedAt");
