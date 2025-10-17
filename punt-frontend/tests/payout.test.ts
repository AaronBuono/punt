import test from "node:test";
import assert from "node:assert/strict";
import { computeNetPayoutLamports } from "../lib/payout";
import type { ParsedBetMarket, ParsedBetTicket } from "../lib/solana";

const baseMarket: ParsedBetMarket = {
  authority: "auth",
  cycle: 1,
  poolYes: 4_000,
  poolNo: 6_000,
  resolved: true,
  frozen: false,
  feeBps: 200,
  hostFeeBps: 100,
  bump: 0,
  winningSide: 0,
  feesAccrued: 0,
  title: "Test Market",
  labelYes: "YES",
  labelNo: "NO",
};

const baseTicket: ParsedBetTicket = {
  user: "user",
  market: "market",
  side: 0,
  amount: 1_000,
  claimed: false,
  bump: 0,
};

test("returns 0 when ticket side does not match winning side", () => {
  const payout = computeNetPayoutLamports(
    { ...baseMarket, winningSide: 1 },
    baseTicket,
  );
  assert.equal(payout, 0);
});

test("applies platform and host fees to winner payouts", () => {
  const payout = computeNetPayoutLamports(baseMarket, baseTicket);
  // Gross payout: 2_500. Profit: 1_500. Fees: 300 bps => 45. Net payout => 2_455.
  assert.equal(payout, 2_455);
});

test("guards against zero winning pool", () => {
  const payout = computeNetPayoutLamports(
    { ...baseMarket, poolYes: 0 },
    baseTicket,
  );
  assert.equal(payout, 0);
});
