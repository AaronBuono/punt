/**
 * API Route: /api/get-bets
 * 
 * Retrieves and decrypts user bets from Neon database using Arcium
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { decryptBetPayload } from '@/lib/arciumClient';
import type { BetPayload } from '@/lib/arciumClient';

const prisma = new PrismaClient();

// Type for response
export interface BetRecord extends BetPayload {
  betId: string;
}

/**
 * GET /api/get-bets?wallet=<address>
 * 
 * Fetches and decrypts all bets for a given wallet
 */
export async function GET(request: NextRequest) {
  try {
    // Get wallet from query params
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');

    if (!wallet) {
      return NextResponse.json(
        { error: 'Missing required parameter: wallet' },
        { status: 400 }
      );
    }

    // Fetch encrypted bets from database
    const encryptedBets = await prisma.encryptedBet.findMany({
      where: { wallet },
      orderBy: { storedAt: 'desc' },
    });

    console.log(`📥 Retrieved ${encryptedBets.length} encrypted bets for wallet ${wallet.substring(0, 8)}...`);

    // Decrypt each bet
    const bets: BetRecord[] = [];

    for (const encBet of encryptedBets) {
      try {
        // Parse ciphertext blocks
        const ciphertextBlocks: string[] = JSON.parse(encBet.encryptedData);

        // Reconstruct encryption envelope
        const envelope = {
          ciphertext: ciphertextBlocks,
          nonce: encBet.nonce,
          arcisPublicKey: encBet.arcisPublicKey,
        };

        // Decrypt using Arcium
        const decrypted = await decryptBetPayload(envelope);

        // Use pollTitle from database if available, fallback to decrypted data
        if (encBet.pollTitle && (!decrypted.betData.title || decrypted.betData.title === 'Prediction Market')) {
          decrypted.betData.title = encBet.pollTitle;
        }

        bets.push({
          ...decrypted,
          betId: encBet.id,
        });
      } catch (error) {
        console.error(`Failed to decrypt bet ${encBet.id}:`, error);
        // Skip bets that fail to decrypt
        continue;
      }
    }

    console.log(`✅ Successfully decrypted ${bets.length}/${encryptedBets.length} bets`);

    return NextResponse.json({
      success: true,
      wallet,
      bets,
      count: bets.length,
    });

  } catch (error) {
    console.error('Error fetching bets:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch bets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
