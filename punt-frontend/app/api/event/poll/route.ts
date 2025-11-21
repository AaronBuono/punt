import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

const ADMIN_PASSWORD = "ILoveGambling67";

/**
 * GET /api/event/poll - Get active/frozen/settled event poll
 */
export async function GET() {
  try {
    // First try to get active or frozen poll
    let poll = await prisma.eventPoll.findFirst({
      where: {
        status: {
          in: ["active", "frozen"],
        },
      },
      include: {
        bets: {
          select: {
            id: true,
            handle: true,
            choice: true,
            stake: true,
            wallet: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // If no active/frozen poll, get the most recent settled poll
    if (!poll) {
      poll = await prisma.eventPoll.findFirst({
        where: {
          status: "settled",
        },
        include: {
          bets: {
            select: {
              id: true,
              handle: true,
              choice: true,
              stake: true,
              wallet: true,
              payout: true,
              isCardWinner: true,
            },
          },
        },
        orderBy: {
          settledAt: "desc",
        },
      });
    }

    if (!poll) {
      return NextResponse.json({ poll: null });
    }

    return NextResponse.json({ poll });
  } catch (error) {
    console.error("Failed to fetch event poll:", error);
    return NextResponse.json(
      { error: "Failed to fetch poll" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/event/poll - Create new event poll (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    const { question, adminSecret } = await req.json();

    // Simple auth check
    if (adminSecret !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!question || typeof question !== "string") {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Check for existing active poll
    const existingPoll = await prisma.eventPoll.findFirst({
      where: {
        status: {
          in: ["active", "frozen"],
        },
      },
    });

    if (existingPoll) {
      return NextResponse.json(
        { error: "An active poll already exists. Settle it first." },
        { status: 409 }
      );
    }

    // Create new poll
    const poll = await prisma.eventPoll.create({
      data: {
        question,
        status: "active",
      },
    });

    return NextResponse.json({ poll });
  } catch (error) {
    console.error("Failed to create event poll:", error);
    return NextResponse.json(
      { error: "Failed to create poll" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/event/poll - Update poll status (admin only)
 */
export async function PATCH(req: NextRequest) {
  try {
    const { pollId, action, outcome, adminSecret } = await req.json();

    // Simple auth check
    if (adminSecret !== ADMIN_PASSWORD) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const poll = await prisma.eventPoll.findUnique({
      where: { id: pollId },
      include: { bets: true },
    });

    if (!poll) {
      return NextResponse.json(
        { error: "Poll not found" },
        { status: 404 }
      );
    }

    // Handle freeze action
    if (action === "freeze") {
      const updatedPoll = await prisma.eventPoll.update({
        where: { id: pollId },
        data: { status: "frozen" },
      });

      return NextResponse.json({ poll: updatedPoll });
    }

    // Handle settle action
    if (action === "settle") {
      if (!outcome || !["ULTRA_RARE", "NO_ULTRA_RARE"].includes(outcome)) {
        return NextResponse.json(
          { error: "Valid outcome required (ULTRA_RARE or NO_ULTRA_RARE)" },
          { status: 400 }
        );
      }

      const winningChoice = outcome === "ULTRA_RARE" ? "YES" : "NO";
      const winningBets = poll.bets.filter((b) => b.choice === winningChoice);
      const losingBets = poll.bets.filter((b) => b.choice !== winningChoice);

      const totalPot = poll.bets.reduce((sum, b) => sum + b.stake, 0);
      const winningPot = winningBets.reduce((sum, b) => sum + b.stake, 0);

      // Calculate payouts for winners
      let cardWinner: string | null = null;
      const updates = [];

      if (winningBets.length > 0 && winningPot > 0) {
        for (const bet of winningBets) {
          const payout = (bet.stake / winningPot) * totalPot;
          updates.push(
            prisma.eventBet.update({
              where: { id: bet.id },
              data: { payout },
            })
          );
        }

        // Randomly select card winner if Ultra Rare pulled
        if (outcome === "ULTRA_RARE" && winningBets.length > 0) {
          const randomWinner = winningBets[Math.floor(Math.random() * winningBets.length)];
          cardWinner = randomWinner.wallet;
          
          updates.push(
            prisma.eventBet.update({
              where: { id: randomWinner.id },
              data: { isCardWinner: true },
            })
          );
        }
      }

      // Set payout to 0 for losers
      for (const bet of losingBets) {
        updates.push(
          prisma.eventBet.update({
            where: { id: bet.id },
            data: { payout: 0 },
          })
        );
      }

      // Execute all updates
      await Promise.all(updates);

      // Update poll status
      const settledPoll = await prisma.eventPoll.update({
        where: { id: pollId },
        data: {
          status: "settled",
          outcome,
          cardWinner,
          settledAt: new Date(),
        },
        include: {
          bets: true,
        },
      });

      return NextResponse.json({ poll: settledPoll });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to update event poll:", error);
    return NextResponse.json(
      { error: "Failed to update poll" },
      { status: 500 }
    );
  }
}
