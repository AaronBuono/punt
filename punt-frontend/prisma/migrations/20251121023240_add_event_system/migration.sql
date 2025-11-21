-- CreateTable
CREATE TABLE "EventPoll" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "outcome" TEXT,
    "totalPot" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cardWinner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "EventPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventBet" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "stake" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "payout" DOUBLE PRECISION,
    "isCardWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventBet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventPoll_status_idx" ON "EventPoll"("status");

-- CreateIndex
CREATE INDEX "EventBet_pollId_idx" ON "EventBet"("pollId");

-- CreateIndex
CREATE INDEX "EventBet_wallet_idx" ON "EventBet"("wallet");

-- CreateIndex
CREATE INDEX "EventBet_pollId_choice_idx" ON "EventBet"("pollId", "choice");

-- AddForeignKey
ALTER TABLE "EventBet" ADD CONSTRAINT "EventBet_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "EventPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
