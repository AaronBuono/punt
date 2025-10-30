/**
 * API Route: /api/update-bets
 * 
 * Updates bet outcomes when a poll freezes or resolves
 */

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { encryptBetPayload, decryptBetPayload } from '@/lib/arciumClient';

const prisma = new PrismaClient();

interface UpdateBetsRequest {
  pollId: string;
  status: 'frozen' | 'resolved';
  winningSide?: number; // 0 or 1, required if status is 'resolved'
}

/**
 * POST /api/update-bets
 * 
 * Updates all bets for a given poll when it freezes or resolves
 */
export async function POST(request: NextRequest) {
  try {
    const body: UpdateBetsRequest = await request.json();

    if (!body.pollId || !body.status) {
      return NextResponse.json(
        { error: 'Missing required fields: pollId, status' },
        { status: 400 }
      );
    }

    if (body.status === 'resolved' && body.winningSide === undefined) {
      return NextResponse.json(
        { error: 'winningSide is required when status is "resolved"' },
        { status: 400 }
      );
    }

    console.log('🔄 Updating bets for poll:', {
      pollId: body.pollId,
      status: body.status,
      winningSide: body.winningSide,
    });

    // Fetch all bets for this poll
    const bets = await prisma.encryptedBet.findMany({
      where: { pollId: body.pollId },
    });

    if (bets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No bets found for this poll',
        updated: 0,
      });
    }

    console.log(`📦 Found ${bets.length} bets to update`);

    let updatedCount = 0;

    // Update each bet
    for (const bet of bets) {
      try {
        // Determine new outcome
        let newOutcome: string;
        if (body.status === 'frozen') {
          newOutcome = 'Frozen';
        } else {
          // Resolved - determine win/loss
          newOutcome = bet.side === body.winningSide ? 'Win' : 'Loss';
        }

        // Decrypt existing data
        const ciphertextBlocks: string[] = JSON.parse(bet.encryptedData);
        const envelope = {
          ciphertext: ciphertextBlocks,
          nonce: bet.nonce,
          arcisPublicKey: bet.arcisPublicKey,
        };

        const decrypted = await decryptBetPayload(envelope);
        
        // Update the bet data
        const updatedBetData = {
          ...decrypted.betData,
          outcome: newOutcome,
        };

        // Re-encrypt with updated data
        const updatedPayload = {
          ...decrypted,
          betData: updatedBetData,
        };

        const encrypted = await encryptBetPayload(updatedPayload);
        const encryptedData = JSON.stringify(encrypted.ciphertext);

        // Update in database (both plaintext fields and encrypted data)
        await prisma.encryptedBet.update({
          where: { id: bet.id },
          data: {
            outcome: newOutcome,
            winningSide: body.winningSide,
            encryptedData,
            nonce: encrypted.nonce,
            arcisPublicKey: encrypted.arcisPublicKey,
          },
        });

        updatedCount++;
      } catch (error) {
        console.error(`Failed to update bet ${bet.id}:`, error);
        // Continue with other bets
      }
    }

    console.log(`✅ Updated ${updatedCount}/${bets.length} bets`);

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} bet(s)`,
      updated: updatedCount,
      total: bets.length,
    });

  } catch (error) {
    console.error('❌ Error updating bets:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to update bets',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
