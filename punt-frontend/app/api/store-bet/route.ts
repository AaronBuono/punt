/**
 * API Route: /api/store-bet
 * 
 * Encrypts and stores user bet data using Arcium encryption + Neon database
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { encryptBetPayload } from '@/lib/arciumClient';
import type { BetPayload } from '@/lib/arciumClient';

const prisma = new PrismaClient();

// Type for request body
interface StoreBetRequest {
  wallet: string;
  pollId: string;
  betData: {
    side: number;
    amount: number;
    labelYes?: string;
    labelNo?: string;
    title?: string;
    timestamp?: string;
    outcome?: string;
  };
}

/**
 * POST /api/store-bet
 * 
 * Encrypts bet data using Arcium and stores in Neon database
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: StoreBetRequest = await request.json();

    if (!body.wallet || !body.pollId || !body.betData) {
      return NextResponse.json(
        { error: 'Missing required fields: wallet, pollId, betData' },
        { status: 400 }
      );
    }

    console.log('📦 Encrypting bet payload:', {
      wallet: body.wallet,
      pollId: body.pollId,
      betData: body.betData,
      storedAt: new Date().toISOString(),
    });

    // Create payload for encryption
    const payload: BetPayload = {
      wallet: body.wallet,
      pollId: body.pollId,
      betData: body.betData,
      storedAt: new Date().toISOString(),
    };

    // Encrypt the payload using Arcium
    const encrypted = await encryptBetPayload(payload);
    
    console.log('🔐 Encrypted successfully:', {
      nonce: encrypted.nonce,
      arcisPublicKey: encrypted.arcisPublicKey.substring(0, 20) + '...',
      ciphertextBlocks: encrypted.ciphertext.length,
    });

    // Combine all ciphertext blocks into single base64 string
    const encryptedData = JSON.stringify(encrypted.ciphertext);

    // Store in database
    const bet = await prisma.encryptedBet.create({
      data: {
        wallet: body.wallet,
        pollId: body.pollId,
        side: body.betData.side,
        amount: body.betData.amount,
        pollTitle: body.betData.title as string | undefined,
        outcome: 'Pending',
        encryptedData,
        nonce: encrypted.nonce,
        arcisPublicKey: encrypted.arcisPublicKey,
      },
    });

    console.log('✅ Bet stored in database:', {
      id: bet.id,
      wallet: bet.wallet,
      pollId: bet.pollId,
    });

    return NextResponse.json({
      success: true,
      betId: bet.id,
      encrypted: true,
      message: 'Bet encrypted and stored successfully',
    });

  } catch (error) {
    console.error('❌ Error storing bet:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to store bet',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
