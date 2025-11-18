# 📋 Punt Development Tasks

**Last Updated:** November 18, 2025  
**Purpose:** Active development tasks and technical debt tracker

---

## 🔥 Priority 1: Critical Issues

### 1.1 ✅ Fix Wallet Signature UX (COMPLETE)
**Status:** ✅ Complete  
**Priority:** P0 (Blocking user experience)  
**Completed:** November 18, 2025

**Problem:** Users prompted for 2 wallet signatures when pressing "Freeze Poll" button (1 for freeze, 1 for AI agent trigger).

**Solution:**
- Batch related operations into single transaction/signature
- Only require signature for user-initiated state changes
- Server-side operations (AI agent) use authority wallet (no user signature)

**Audit Results:**
✅ **Verified existing optimizations:**
- `studio/page.tsx` line 295: Passes `txSig` to `notifyFreeze()` - avoids double signature on freeze
- `studio/page.tsx` line 402: Passes `txSig` to `publishMarketState()` - avoids double signature on init
- All poll management operations properly batch signatures

✅ **Removed unnecessary signatures:**
- `HostStreamPanel.tsx` `refreshStatus()` - removed signature from read-only stream status refresh
- `/api/stream` route - added early return for refresh action (no auth required)

✅ **Kept necessary signatures:**
- `saveTitle()` - changes stream title (state change)
- `endStream()` - stops stream (state change)
- `getToken()` - authenticates LiveKit session (security critical)
- `notifyFreeze()` - fallback when no txSig provided
- `publishMarketState()` - fallback when no txSig provided

**Testing:**
- ✅ Confirmed "Freeze Poll" only requires 1 signature
- ✅ Stream refresh now works without signature prompt

---

## 🔐 Priority 1: Arcium Phase 2 Migration

### 2.1 🔄 Research & Design Client-Side Encryption
**Status:** In Progress  
**Priority:** P0 (Core feature requirement)

**Current State (Phase 1):**
- ✅ Server-side encryption with Arcium SDK
- ✅ Bets encrypted before database storage
- ❌ Server holds decryption key (centralized)
- ❌ Not true end-to-end encryption

**Goal (Phase 2):**
- 🎯 Client-side encryption using wallet signature
- 🎯 User controls decryption key
- 🎯 Server cannot read bet plaintext
- 🎯 True E2E encryption

**Research Questions:**
- [ ] How to derive encryption key from Solana wallet signature?
- [ ] Does Arcium SDK support browser-side encryption?
- [ ] How to handle key derivation without requiring signature on every bet?
- [ ] Can we cache derived key in session storage?
- [ ] How to handle decryption on dashboard without re-signing?

**Architecture Design:**
```typescript
// Current (Phase 1) - Server-side
POST /api/store-bet
  → Server encrypts with Arcium SDK
  → Store ciphertext in DB
  
GET /api/get-bets
  → Server decrypts with Arcium SDK
  → Return plaintext to client

// Target (Phase 2) - Client-side
Client: Wallet signs message
  → Derive encryption key from signature
  → Encrypt bet payload locally
  → POST encrypted payload to /api/store-bet
  → Server stores opaque ciphertext (cannot decrypt)
  
Client: GET /api/get-bets
  → Server returns encrypted bets
  → Client derives key from wallet signature
  → Decrypt locally
```

---

### 2.2 🔄 Implement Wallet-Based Key Derivation
**Status:** Blocked by Research  
**Priority:** P0  
**Depends On:** Task 2.1

**Implementation Steps:**

#### Step 1: Client-Side Encryption Helper
**File:** `/punt-frontend/lib/client/walletEncryption.ts` (NEW)

```typescript
import { useWallet } from "@solana/wallet-adapter-react";
import { RescueCipher } from "@arcium-hq/client";
import nacl from "tweetnacl";

// Derive encryption key from wallet signature
export async function deriveEncryptionKey(wallet: WalletAdapter): Promise<Uint8Array> {
  // Sign deterministic message to derive key
  const message = new TextEncoder().encode("Punt Encryption Key Derivation v1");
  const signature = await wallet.signMessage!(message);
  
  // Use first 32 bytes of signature as key
  return signature.slice(0, 32);
}

// Encrypt bet payload client-side
export async function encryptBetClient(
  payload: BetPayload,
  wallet: WalletAdapter
): Promise<EncryptedBetEnvelope> {
  const key = await deriveEncryptionKey(wallet);
  const cipher = new RescueCipher(key);
  
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const nonce = nacl.randomBytes(16);
  const ciphertext = cipher.encrypt(compressUint128(plaintext), nonce);
  
  return {
    ciphertext: ciphertext.map(b => Buffer.from(b).toString("base64")),
    nonce: Buffer.from(nonce).toString("hex"),
    arcisPublicKey: Buffer.from(wallet.publicKey!.toBytes()).toString("base64"),
  };
}

// Decrypt bet payload client-side
export async function decryptBetClient(
  envelope: EncryptedBetEnvelope,
  wallet: WalletAdapter
): Promise<BetPayload> {
  const key = await deriveEncryptionKey(wallet);
  const cipher = new RescueCipher(key);
  
  const ciphertext = envelope.ciphertext.map(c => Array.from(Buffer.from(c, "base64")));
  const nonce = Buffer.from(envelope.nonce, "hex");
  const plaintext = cipher.decrypt(ciphertext, nonce);
  
  return JSON.parse(Buffer.from(decompressUint128(plaintext)).toString("utf8"));
}
```

#### Step 2: Update Bet Placement Flow
**File:** `/punt-frontend/components/BetButton.tsx`

```typescript
// Before (Phase 1)
await fetch("/api/store-bet", {
  body: JSON.stringify({ wallet, pollId, side, amount })
});

// After (Phase 2)
import { encryptBetClient } from "@/lib/client/walletEncryption";

const encrypted = await encryptBetClient(
  { wallet, pollId, betData: { side, amount }, storedAt: new Date().toISOString() },
  wallet
);

await fetch("/api/store-bet", {
  body: JSON.stringify({
    wallet,
    pollId,
    encryptedPayload: encrypted, // Server cannot decrypt this
  })
});
```

#### Step 3: Update API Route
**File:** `/punt-frontend/app/api/store-bet/route.ts`

```typescript
// Before (Phase 1)
const { wallet, pollId, side, amount } = await req.json();
const encrypted = await encryptBetPayload({ wallet, pollId, betData: { side, amount } });
await prisma.encryptedBet.create({ data: { ...encrypted } });

// After (Phase 2)
const { wallet, pollId, encryptedPayload } = await req.json();
// Server just stores the encrypted payload (cannot decrypt)
await prisma.encryptedBet.create({
  data: {
    wallet,
    pollId,
    encryptedData: JSON.stringify(encryptedPayload.ciphertext),
    nonce: encryptedPayload.nonce,
    arcisPublicKey: encryptedPayload.arcisPublicKey,
    // Metadata still stored in plaintext for filtering
    side: 0, // Unknown to server
    amount: 0, // Unknown to server
    outcome: "pending",
  }
});
```

#### Step 4: Update Dashboard Decryption
**File:** `/punt-frontend/app/dashboard/page.tsx`

```typescript
import { decryptBetClient } from "@/lib/client/walletEncryption";

const { data: encryptedBets } = useSWR("/api/get-bets?wallet=" + wallet.publicKey);

// Decrypt client-side
const decryptedBets = await Promise.all(
  encryptedBets.map(bet => decryptBetClient(bet, wallet))
);
```

**Challenges to Solve:**
- [ ] Key caching: Store derived key in session to avoid re-signing?
- [ ] Metadata trade-off: If server can't see `side`/`amount`, how to filter/sort?
- [ ] Multi-wallet: What if user switches wallets? Can they decrypt old bets?

---

### 2.3 ❌ Migrate Existing Phase 1 Bets
**Status:** Not Needed (Devnet Testing)  
**Priority:** N/A

**Decision:** No migration needed - still in devnet testing phase. Fresh start on mainnet with Phase 2.

---

## 📊 Priority 2: Feature Enhancements

### 3.1 📋 Add Streamer Analytics Dashboard
**Status:** Not Started  
**Priority:** P2

**Features:**
- Total streams count
- Total volume (SOL) across all polls
- Average bets per poll
- Viewer engagement metrics
- Revenue earned from fees

**Database Changes:**
```prisma
model StreamerProfile {
  wallet          String   @unique
  displayName     String
  totalStreams    Int      @default(0)
  totalVolume     Decimal  @default(0)
  avgBetsPerPoll  Float    @default(0)
  revenueEarned   Decimal  @default(0)
}
```

**API Route:** `/api/streamers/[wallet]/analytics`

---

### 3.2 📋 Add Leaderboard
**Status:** Not Started  
**Priority:** P2

**Types:**
- Top bettors (by volume)
- Top winners (by profit)
- Top streamers (by engagement)

**Privacy Consideration:** If encryption is mandatory, how to show public leaderboard?
- Option A: Use zero-knowledge proofs (prove you won without revealing bet)
- Option B: Opt-in to public leaderboard (decrypt stats for display)
- Option C: On-chain data is public anyway (query Solana directly)

---

## 🐛 Priority 1: AI Agent Reliability

### 4.1 🔄 AI Agent Rework + Fallback System
**Status:** Not Started  
**Priority:** P0 (Core reliability issue)

**Current Problem:**
- Google Vision API unreliable for card detection
- No fallback when AI fails
- Market stays frozen indefinitely if resolution fails

**Solution: Three-Tier Resolution System**

#### Tier 1: AI Agent (Primary)
- Google Vision API attempts automatic resolution
- If confidence < 75% or no cards detected → escalate to Tier 2

#### Tier 2: Moderator Verification (Fallback)
- Verified moderator wallets can manually resolve
- Special moderator UI shows frozen polls needing review
- Moderators watch stream replay and verify outcome

#### Tier 3: Auto-Refund (Emergency Failsafe)
- If neither AI nor moderators resolve within X minutes
- Emergency "Cancel Market" function refunds all bets
- Triggered manually by authority or automatic timeout

---

### 4.1.1 🔄 Implement Moderator System
**Status:** Not Started  
**Priority:** P0  
**Depends On:** None

**Implementation Steps:**

#### Step 1: Add Moderator Role to Smart Contract
**File:** `/punt-program/programs/punt_program/src/lib.rs`

```rust
#[account]
pub struct BetMarket {
    pub authority: Pubkey,        // Streamer
    pub moderators: Vec<Pubkey>,  // NEW: Verified mod wallets (max 5)
    pub poll_id: String,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub status: MarketStatus,
    pub winning_side: Option<u8>,
    pub resolution_attempts: u8,  // NEW: Track failures
    pub frozen_at: i64,           // NEW: Timestamp for timeout
    pub bump: u8,
}

// NEW: Manual resolution instruction (moderator-only)
pub fn resolve_market_manual(
    ctx: Context<ResolveMarketManual>,
    winning_side: u8,
    reason: String // "AI failed - verified manually"
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let moderator = ctx.accounts.moderator.key();
    
    // Verify moderator is authorized
    require!(
        market.moderators.contains(&moderator),
        PuntError::UnauthorizedModerator
    );
    
    // Verify market is frozen
    require!(
        market.status == MarketStatus::Frozen,
        PuntError::MarketNotFrozen
    );
    
    market.status = MarketStatus::Resolved;
    market.winning_side = Some(winning_side);
    
    emit!(MarketResolvedManually {
        market: market.key(),
        moderator,
        winning_side,
        reason,
    });
    
    Ok(())
}
```

#### Step 2: Add Moderator Management
**File:** `/punt-program/programs/punt_program/src/lib.rs`

```rust
// NEW: Add/remove moderators (authority only)
pub fn add_moderator(
    ctx: Context<AddModerator>,
    moderator: Pubkey
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    
    require!(
        market.moderators.len() < 5,
        PuntError::TooManyModerators
    );
    
    require!(
        !market.moderators.contains(&moderator),
        PuntError::ModeratorAlreadyAdded
    );
    
    market.moderators.push(moderator);
    Ok(())
}

pub fn remove_moderator(
    ctx: Context<RemoveModerator>,
    moderator: Pubkey
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    market.moderators.retain(|m| m != &moderator);
    Ok(())
}
```

#### Step 3: Build Moderator UI
**File:** `/punt-frontend/app/moderator/page.tsx` (NEW)

```typescript
"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import useSWR from "swr";

export default function ModeratorPage() {
  const wallet = useWallet();
  
  // Fetch polls where user is a moderator and status = frozen
  const { data: polls } = useSWR(
    wallet.publicKey ? `/api/moderator/pending?wallet=${wallet.publicKey}` : null
  );
  
  async function resolveManually(pollId: string, winningSide: 0 | 1) {
    // Call Solana resolve_market_manual instruction
    await program.methods
      .resolveMarketManual(winningSide, "Manual verification after AI failure")
      .accounts({
        market: marketPDA,
        moderator: wallet.publicKey,
      })
      .rpc();
    
    // Trigger auto-claim
    await fetch("/api/claim-all", {
      method: "POST",
      body: JSON.stringify({ marketAddress: marketPDA.toString() }),
    });
  }
  
  return (
    <div className="container mx-auto p-4">
      <h1>Moderator Dashboard</h1>
      <p>Polls requiring manual verification:</p>
      
      {polls?.map(poll => (
        <div key={poll.id} className="border p-4 mb-4">
          <h2>{poll.title}</h2>
          <video src={poll.streamReplayUrl} controls />
          
          <div className="flex gap-2 mt-4">
            <button 
              onClick={() => resolveManually(poll.id, 1)}
              className="bg-green-500 px-4 py-2"
            >
              Resolve: YES
            </button>
            <button 
              onClick={() => resolveManually(poll.id, 0)}
              className="bg-red-500 px-4 py-2"
            >
              Resolve: NO
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### Step 4: API Route for Moderator Polls
**File:** `/punt-frontend/app/api/moderator/pending/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { getServerConnection } from "@/lib/server/solana";
import { Program } from "@coral-xyz/anchor";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "Missing wallet" }, { status: 400 });
  }
  
  // Query Solana for markets where wallet is a moderator
  const connection = getServerConnection();
  const program = new Program(IDL, PROGRAM_ID, { connection });
  
  const markets = await program.account.betMarket.all([
    {
      memcmp: {
        offset: 8 + 32, // Skip discriminator + authority
        bytes: wallet, // Filter by moderator list (approximation)
      },
    },
  ]);
  
  // Filter for frozen markets
  const frozenMarkets = markets.filter(m => m.account.status === "Frozen");
  
  // Enrich with poll metadata from database
  const polls = await Promise.all(
    frozenMarkets.map(async (market) => {
      const poll = await prisma.poll.findUnique({
        where: { pollId: market.account.pollId },
      });
      
      return {
        id: poll.pollId,
        title: poll.title,
        marketAddress: market.publicKey.toString(),
        frozenAt: market.account.frozenAt,
        streamReplayUrl: `livekit-replay-url`, // TODO: LiveKit replay integration
      };
    })
  );
  
  return NextResponse.json({ polls });
}
```

---

### 4.1.2 🔄 Implement Auto-Refund Failsafe
**Status:** Not Started  
**Priority:** P0  
**Depends On:** Task 4.1.1

**Implementation Steps:**

#### Step 1: Add Cancel Market Instruction
**File:** `/punt-program/programs/punt_program/src/lib.rs`

```rust
pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;
    
    // Only authority can cancel
    require!(
        ctx.accounts.authority.key() == market.authority,
        PuntError::Unauthorized
    );
    
    // Can only cancel frozen markets
    require!(
        market.status == MarketStatus::Frozen,
        PuntError::MarketNotFrozen
    );
    
    market.status = MarketStatus::Cancelled;
    
    emit!(MarketCancelled {
        market: market.key(),
        reason: "Emergency refund",
    });
    
    Ok(())
}

pub fn refund_bet(ctx: Context<RefundBet>) -> Result<()> {
    let market = &ctx.accounts.market;
    let ticket = &mut ctx.accounts.ticket;
    
    // Verify market is cancelled
    require!(
        market.status == MarketStatus::Cancelled,
        PuntError::MarketNotCancelled
    );
    
    // Verify ticket not already refunded
    require!(
        !ticket.claimed,
        PuntError::AlreadyClaimed
    );
    
    // Transfer original bet amount back to user
    let lamports = ticket.amount;
    **market.to_account_info().lamports.borrow_mut() -= lamports;
    **ticket.owner.to_account_info().lamports.borrow_mut() += lamports;
    
    ticket.claimed = true;
    
    Ok(())
}
```

#### Step 2: Auto-Refund Cron Job
**File:** `/ai-agent/src/refund-monitor.ts` (NEW)

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";

const REFUND_TIMEOUT_MINUTES = 30; // Auto-refund after 30 min

async function monitorFrozenMarkets() {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  const program = new Program(IDL, PROGRAM_ID, { connection });
  
  // Get all frozen markets
  const markets = await program.account.betMarket.all([
    { memcmp: { offset: STATUS_OFFSET, bytes: "Frozen" } },
  ]);
  
  for (const market of markets) {
    const frozenAt = market.account.frozenAt.toNumber();
    const now = Date.now() / 1000;
    const elapsedMinutes = (now - frozenAt) / 60;
    
    if (elapsedMinutes > REFUND_TIMEOUT_MINUTES) {
      console.log(`🚨 Market ${market.publicKey} frozen for ${elapsedMinutes}min - auto-refunding`);
      
      // Cancel market
      await program.methods
        .cancelMarket()
        .accounts({
          market: market.publicKey,
          authority: authorityKeypair.publicKey,
        })
        .signers([authorityKeypair])
        .rpc();
      
      // Refund all tickets
      await refundAllTickets(market.publicKey);
    }
  }
}

// Run every 5 minutes
setInterval(monitorFrozenMarkets, 5 * 60 * 1000);
```

#### Step 3: Manual Cancel Button (Frontend)
**File:** `/punt-frontend/app/studio/page.tsx`

```typescript
async function cancelPoll(marketPDA: PublicKey) {
  if (!confirm("Are you sure? This will refund all bets and cannot be undone.")) {
    return;
  }
  
  await program.methods
    .cancelMarket()
    .accounts({
      market: marketPDA,
      authority: wallet.publicKey,
    })
    .rpc();
  
  toast.success("Market cancelled. Refunds will be processed automatically.");
}

// In UI
{poll.status === "frozen" && (
  <button 
    onClick={() => cancelPoll(poll.marketAddress)}
    className="bg-red-600 px-4 py-2"
  >
    ⚠️ Cancel & Refund All Bets
  </button>
)}
```

**Testing Checklist:**
- [ ] AI fails → moderator can manually resolve
- [ ] Moderator resolves → auto-claim triggers
- [ ] No resolution after 30min → auto-refund executes
- [ ] Streamer can manually cancel → all bets refunded
- [ ] Cancelled market → users cannot claim winnings (only refunds)

---

## 🐛 Priority 3: Bug Fixes & Tech Debt

### 4.2 🐛 Rate Limiting on API Routes
**Status:** Not Started  
**Priority:** P2

**Problem:** No rate limiting = potential spam/DoS attacks.

**Solution:**
- Use middleware like `@upstash/ratelimit`
- Limit by wallet address: 10 bets/minute
- Limit by IP: 100 requests/minute

---

### 4.3 📁 File Structure Cleanup
**Status:** Not Started  
**Priority:** P3

**Decision:** Organize files for cleanliness as needed.

**AI Guideline:** Restructure when it improves maintainability. Suggested organization:
- Components: `/components/betting/`, `/components/streaming/`, `/components/moderator/`
- Utilities: `/lib/client/` (browser-side), `/lib/server/` (API-side), `/lib/shared/` (both)

---

## 🚀 Priority 4: Future Roadmap

### 5.1 🔮 Multi-Choice Polls (Future Enhancement)
**Status:** Planned  
**Priority:** P3

**Current:** Binary Yes/No polls only (legal compliance - prediction markets)
**Future:** Multiple outcome options while maintaining legal safety

**Design Considerations:**
- Legal: Keep prediction market structure (not traditional betting)
- Example: "Which card appears first? Charizard / Pikachu / Neither"
- Payout: Pool-per-outcome model (winners split from losing pools)
- Complexity: Requires odds calculation rework

**Research Needed:**
- Study Kalshi's multi-option implementation
- Consult legal advisors on multi-outcome compliance
- Design payout formula for 3+ outcomes

**See:** Kalshi uses binary base + multiple market approach (e.g., "Will Biden win?" + "Will Trump win?" as separate markets)

---

### 5.2 🔮 Arcium Phase 3: On-Chain MXE Storage
**Status:** Planned (Q2 2026)  
**Priority:** P3

**Goal:** Store encrypted bets directly on Solana (no database).

**Benefits:**
- Fully decentralized
- Censorship-resistant
- Composable with other apps

**Challenges:**
- Higher transaction costs (on-chain storage)
- Query complexity (need indexer)

---

### 5.3 🔮 Cross-Chain Support
**Status:** Planned (Q3+ 2026)  
**Priority:** P4

**Chains:** Ethereum, Base, Polygon

---

## 📝 Task Status Legend

- ✅ **Complete** - Shipped to production
- 🔄 **In Progress** - Actively being worked on
- 📋 **Not Started** - Planned but not begun
- 🔮 **Future** - Long-term roadmap item
- ⏸️ **Blocked** - Waiting on dependency or decision

---

## 🔄 How to Use This File

### When starting new work:
1. Move task from "Not Started" to "In Progress"
2. Update "Last Updated" date
3. Check off sub-tasks as you complete them

### When completing work:
1. Move task to "Complete" section
2. Add completion date
3. Update related brain documents if patterns changed

### When adding new tasks:
1. Assign priority (P0-P4)
2. Identify dependencies
3. Break down into actionable sub-tasks

---

**Owner:** Development Team  
**Review Cadence:** Weekly  
**Next Review:** November 25, 2025