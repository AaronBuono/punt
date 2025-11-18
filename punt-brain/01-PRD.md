# 📋 Punt Project Context (For AI Agents)

**Last Updated:** November 18, 2025  
**Purpose:** Give AI agents the business logic context needed to write correct code

---

## 🎯 What Punt Is

Punt is a **live betting platform for Pokémon TCG pack openings** built on Solana. 

**Key Concept:** Streamers open Pokémon card packs on camera, viewers bet on what cards will be pulled, and an AI agent automatically resolves the bets by watching the stream.

---

## 🧩 Core System Components

### 1. Frontend (Next.js App)
**Location:** `/punt-frontend/`

**Three main pages:**
- `/watch` - Viewer UI (watch stream + place bets)
- `/studio` - Streamer UI (broadcast + control polls)
- `/dashboard` - Bet history viewer (decrypt past bets)

### 2. Solana Smart Contract
**Location:** `/punt-program/`
**Program ID:** `3ke7tRTEFF8qr9pJLmufeb9xiPdatFq5K3GSqUQhbbw1` (Devnet)

**Two main accounts:**
- `BetMarket` - One per poll (holds yes/no pools)
- `BetTicket` - One per bet (records user's wager)

### 3. AI Resolution Agent
**Location:** `/ai-agent/`

**Job:** Watch LiveKit stream, detect cards with Google Vision API, submit resolution to Solana

### 4. Arcium Encryption (Optional Privacy)
**Location:** `/punt_mxe/`

**Job:** Encrypt bet metadata before storing in database (so server can't see bet amounts)

---


### **Workflow 1: Creating a Poll (Streamer)**

```
1. Streamer clicks "Create Poll" in /studio
   ↓
2. Frontend: POST /api/polls with { title, authorityId, signature }
   ↓
3. Backend: Verifies signature, stores poll in Postgres (status: "active")
   ↓
4. Frontend: Calls Solana program's initialize_market instruction
   ↓
5. Solana: Creates BetMarket PDA with:
   - authority = streamer wallet
   - poll_id = UUID from database
   - yes_pool = 0, no_pool = 0
   - status = Open
   ↓
6. Frontend: Poll appears in UI, viewers can now bet
```

**Key Data Flow:**
- Database stores poll metadata (title, status)
- Solana stores betting pools and resolution status
- Both use `poll_id` UUID as the link

---

### **Workflow 2: Placing a Bet (Viewer)**

```
1. Viewer selects "Yes" or "No" on /watch page
   ↓
2. Frontend: Wallet adapter prompts for signature
   ↓
3. Frontend: Calls Solana program's place_bet instruction
   ↓
4. Solana: 
   - Transfers lamports from viewer → market vault
   - Creates BetTicket PDA
   - Increments yes_pool or no_pool
   ↓
5. Frontend: POST /api/store-bet (OPTIONAL - for Arcium encryption)
   ↓
6. Backend:
   - Encrypts bet metadata with Arcium
   - Stores in Postgres EncryptedBet table
   ↓
7. Frontend: Shows bet confirmation (< 500ms)
8. SWR refetches poll data → live odds update for all viewers
```

**Key Points:**
- Bet is ALWAYS on-chain (Solana)
- Encryption is OPTIONAL (Phase 1 feature)
- Odds recalculate based on pool ratio: `yes_odds = total_pool / yes_pool`

---

### **Workflow 3: Freezing & Resolving (AI Agent)**

```
1. Streamer clicks "Freeze Poll" in /studio
   ↓
2. Frontend: Calls Solana program's freeze_market instruction
   ↓
3. Solana: Sets market status = Frozen (no more bets allowed)
   ↓
4. Frontend: Sends "🧊 Poll frozen by host" message to LiveKit chat
   ↓
5. AI Agent: Detects freeze signal, starts frame capture
   ↓
6. AI Agent: Samples video at 6 FPS for 5 seconds
   ↓
7. AI Agent: Sends frames to Google Vision API
   ↓
8. Google Vision: Returns OCR text (e.g., "Charizard ex", "Ultra Rare")
   ↓
9. AI Agent: Matches against card database CSV
   ↓
10. AI Agent: Determines winning side (Yes = 1, No = 0)
   ↓
11. AI Agent: Calls Solana program's resolve_market instruction
   ↓
12. Solana: Sets market.winning_side = 1 (or 0)
   ↓
13. AI Agent: POST /api/claim-all to trigger auto-payouts
   ↓
14. Backend: Fetches all winning tickets, submits claim_payout transactions
   ↓
15. Solana: Transfers proportional winnings to each winner
   ↓
16. Frontend: Winners see SOL in wallet (< 2 seconds total)
```

**Key Points:**
- AI agent MUST have authority wallet to sign `resolve_market`
- Auto-claim is server-initiated (not user-initiated)
- Payout formula: `winner_share = (ticket.amount / winning_pool) * total_pool`

---

### **Workflow 4: Viewing Bet History (Dashboard)**

```
1. User navigates to /dashboard
   ↓
2. Frontend: GET /api/get-bets?wallet={userWallet}
   ↓
3. Backend:
   - Queries Postgres for EncryptedBet rows
   - Decrypts each bet with Arcium
   - Returns JSON array of bets
   ↓
4. Frontend: Displays table with:
   - Poll title
   - Bet amount
   - Outcome (pending/win/loss)
   - Payout amount
```

**Key Points:**
- Only encrypted bets appear here (if user opted in)
- On-chain data is public (can query Solana Explorer separately)

---

## 🎲 Betting Math (Payout Calculation)

### Pool-Based Odds

**Example Poll:**
- Yes pool: 5 SOL (10 bets)
- No pool: 3 SOL (6 bets)
- Total pool: 8 SOL

**If "Yes" wins:**
- Each "Yes" bettor gets `(their_bet / 5 SOL) * 8 SOL`
- If you bet 0.5 SOL on Yes, you get `(0.5 / 5) * 8 = 0.8 SOL`
- Net profit: 0.8 - 0.5 = **0.3 SOL profit** (60% ROI)

**If "No" wins:**
- Each "No" bettor gets `(their_bet / 3 SOL) * 8 SOL`
- If you bet 0.3 SOL on No, you get `(0.3 / 3) * 8 = 0.8 SOL`
- Net profit: 0.8 - 0.3 = **0.5 SOL profit** (167% ROI)

**Formula in code:**
```typescript
function computeNetPayoutLamports(
  market: BetMarket,
  ticket: BetTicket
): number {
  const totalPool = market.yesPool + market.noPool;
  const winningPool = ticket.side === 1 ? market.yesPool : market.noPool;
  const grossPayout = (ticket.amount / winningPool) * totalPool;
  return grossPayout - ticket.amount; // Net profit
}
```

---

## � Privacy Layers (Arcium Integration)

### What Gets Encrypted vs Public

| Data | Storage | Privacy |
|------|---------|---------|
| **Poll title** | Postgres | Public |
| **Market status** | Solana | Public |
| **Pool totals** | Solana | Public |
| **Your bet amount** | Solana | **Public** (anyone can query) |
| **Your bet choice** | Solana | **Public** |
| **Bet metadata (encrypted)** | Postgres | **Private** (via Arcium) |

**Why encrypt if Solana is public?**
- Arcium encryption is for **off-chain bet history** (dashboard view)
- On-chain data is inherently public (by design)
- Phase 3 will move encrypted data ON-CHAIN via MXE program

---

## 🚨 Error Scenarios AI Should Know

### 1. **AI Agent Fails to Resolve**
**Cause:** Google Vision can't detect cards (glare, motion blur)

**Handling:**
```typescript
if (detectedCards.length === 0) {
  console.error("No cards detected, manual resolution required");
  // TODO: Notify streamer to manually resolve
  // For now: market stays frozen
}
```

### 2. **User Tries to Bet on Frozen Market**
**Expected behavior:** Solana program rejects transaction with error

**Frontend validation:**
```typescript
if (market.status === "frozen") {
  toast.error("Betting is closed for this poll");
  return; // Don't submit transaction
}
```

### 3. **Claim Payout for Losing Ticket**
**Expected behavior:** Solana program rejects with "You didn't win"

**Frontend should filter:**
```typescript
const canClaim = ticket.side === market.winningSide && !ticket.claimed;
if (!canClaim) {
  // Don't show claim button
}
```

---

## 📊 Key Metrics AI Should Track

When adding analytics/logging:

| Metric | Where to Log | Why |
|--------|--------------|-----|
| **Bet confirmation time** | Frontend → console | Ensure <500ms target |
| **AI resolution time** | AI agent logs | Ensure <10s target |
| **OCR confidence scores** | AI agent logs | Track accuracy over time |
| **Failed resolutions** | AI agent errors | Alert if >10% failure rate |
| **Encrypted bet adoption** | Postgres queries | Track Phase 1 success |

---

## 🔗 Important Identifiers AI Will Use

### Solana Program IDs
```typescript
const PUNT_PROGRAM_ID = "3ke7tRTEFF8qr9pJLmufeb9xiPdatFq5K3GSqUQhbbw1"; // Devnet
const ARCIUM_MXE_PROGRAM_ID = "AeDEKEm6btYZenwJECNUULgdTr4fuFQRgsVJBn2rYFsn"; // Devnet
```

### PDA Seeds
```rust
// BetMarket PDA
seeds = [b"bet_market", authority.key().as_ref(), poll_id.as_bytes()]

// BetTicket PDA
seeds = [b"bet_ticket", market.key().as_ref(), owner.key().as_ref()]
```

### Database Table Names
```sql
Poll          -- Poll metadata
EncryptedBet  -- Encrypted bet history
```

---

**When AI is asked to modify betting logic, ALWAYS:**
1. Check if change affects payout calculation
2. Verify Solana program needs updates too (not just frontend)
3. Consider impact on AI agent's resolution logic
4. Update encryption layer if bet data structure changes
