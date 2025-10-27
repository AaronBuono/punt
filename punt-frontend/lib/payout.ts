import type { ParsedBetMarket, ParsedBetTicket } from "./solana";

/**
 * Computes the net payout in lamports for a winning ticket after platform and host fees.
 */
export function computeNetPayoutLamports(market: ParsedBetMarket, ticket: ParsedBetTicket): number {
  if (market.winningSide !== ticket.side) return 0;
  const winningPool = market.winningSide === 0 ? market.poolYes : market.poolNo;
  if (!Number.isFinite(winningPool) || winningPool <= 0) return 0;
  const totalPool = market.poolYes + market.poolNo;
  if (!Number.isFinite(totalPool) || totalPool <= 0) return 0;

  try {
    const ticketAmount = BigInt(Math.trunc(ticket.amount));
    const poolTotal = BigInt(Math.trunc(totalPool));
    const poolWinning = BigInt(Math.trunc(winningPool));
    if (poolWinning === BigInt(0)) return 0;

    const gross = (ticketAmount * poolTotal) / poolWinning;
    const profit = gross - ticketAmount;
    const totalFeeBps = BigInt(market.feeBps + market.hostFeeBps);
    const totalFee = totalFeeBps > BigInt(0) ? (profit * totalFeeBps) / BigInt(10_000) : BigInt(0);
    const payout = gross - totalFee;
    return payout > BigInt(0) ? Number(payout) : 0;
  } catch {
    return 0;
  }
}
