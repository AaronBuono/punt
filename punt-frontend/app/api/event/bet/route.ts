import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

/**
 * POST /api/event/bet - Place a bet on the active event poll
 */
export async function POST(req: NextRequest) {
  try {
    const { wallet, handle, choice } = await req.json();

    // Validation
    if (!wallet || typeof wallet !== "string") {
      return NextResponse.json(
        { error: "Wallet address is required" },
        { status: 400 }
      );
    }

    if (!handle || typeof handle !== "string" || handle.trim().length === 0) {
      return NextResponse.json(
        { error: "Handle is required" },
        { status: 400 }
      );
    }

    if (!choice || !["YES", "NO"].includes(choice)) {
      return NextResponse.json(
        { error: "Choice must be YES or NO" },
        { status: 400 }
      );
    }

    // Get active poll
    const activePoll = await prisma.eventPoll.findFirst({
      where: {
        status: "active",
      },
      include: {
        bets: true,
      },
    });

    if (!activePoll) {
      return NextResponse.json(
        { error: "No active poll available" },
        { status: 404 }
      );
    }

    // Check if user already bet
    const existingBet = activePoll.bets.find((b: { wallet: string }) => b.wallet === wallet);
    if (existingBet) {
      return NextResponse.json(
        { error: "You have already placed a bet on this poll" },
        { status: 409 }
      );
    }

    // Create bet
    const bet = await prisma.eventBet.create({
      data: {
        pollId: activePoll.id,
        wallet,
        handle: handle.trim(),
        choice,
        stake: 1, // Fixed $1 stake
      },
    });

    // Update total pot
    await prisma.eventPoll.update({
      where: { id: activePoll.id },
      data: {
        totalPot: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({ bet });
  } catch (error) {
    console.error("Failed to place event bet:", error);
    return NextResponse.json(
      { error: "Failed to place bet" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/event/bet?wallet={address} - Get user's bet on active poll
 */
export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json(
        { error: "Wallet parameter is required" },
        { status: 400 }
      );
    }

    // Get active or frozen poll
    const activePoll = await prisma.eventPoll.findFirst({
      where: {
        status: {
          in: ["active", "frozen", "settled"],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!activePoll) {
      return NextResponse.json({ bet: null, poll: null });
    }

    // Get user's bet
    const bet = await prisma.eventBet.findFirst({
      where: {
        pollId: activePoll.id,
        wallet,
      },
    });

    return NextResponse.json({ bet, poll: activePoll });
  } catch (error) {
    console.error("Failed to fetch event bet:", error);
    return NextResponse.json(
      { error: "Failed to fetch bet" },
      { status: 500 }
    );
  }
}
