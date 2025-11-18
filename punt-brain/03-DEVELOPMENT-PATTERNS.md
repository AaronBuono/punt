# 🛠️ Development Patterns & Standards (For AI Agents)

**Last Updated:** November 18, 2025  
**Purpose:** Step-by-step guides for common development tasks

---

## 📋 Table of Contents

1. [Adding a New API Route](#adding-a-new-api-route)
2. [Creating a New Solana Instruction](#creating-a-new-solana-instruction)
3. [Building a New Frontend Component](#building-a-new-frontend-component)
4. [Adding a Database Table](#adding-a-database-table)
5. [Modifying AI Agent Logic](#modifying-ai-agent-logic)
6. [Error Handling Standards](#error-handling-standards)
7. [Testing New Features](#testing-new-features)
8. [Code Style Guidelines](#code-style-guidelines)

---

## 1. Adding a New API Route

### Example: Create `/api/polls/[id]/route.ts` (Get single poll)

**Step 1:** Create file at `/punt-frontend/app/api/polls/[id]/route.ts`

**Step 2:** Implement GET handler

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    const poll = await prisma.poll.findUnique({
      where: { pollId: id },
      include: { bets: true }, // Optional: include related data
    });
    
    if (!poll) {
      return NextResponse.json(
        { error: "Poll not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ poll });
    
  } catch (error) {
    console.error("Failed to fetch poll:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 3:** Add POST/PATCH/DELETE handlers if needed

```typescript
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    
    // Validate input
    if (!body.status || !["active", "frozen", "resolved"].includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid status value" },
        { status: 400 }
      );
    }
    
    const updatedPoll = await prisma.poll.update({
      where: { pollId: id },
      data: { status: body.status },
    });
    
    return NextResponse.json({ poll: updatedPoll });
    
  } catch (error) {
    console.error("Failed to update poll:", error);
    return NextResponse.json(
      { error: "Failed to update poll" },
      { status: 500 }
    );
  }
}
```

**Step 4:** Test with curl or Postman

```bash
# GET
curl http://localhost:3000/api/polls/poll-123

# PATCH
curl -X PATCH http://localhost:3000/api/polls/poll-123 \
  -H "Content-Type: application/json" \
  -d '{"status": "frozen"}'
```

---

## 2. Creating a New Solana Instruction

### Example: Add `cancel_market` instruction

**Step 1:** Add instruction handler in `/punt-program/programs/punt_program/src/lib.rs`

```rust
use anchor_lang::prelude::*;

#[program]
pub mod punt_program {
    use super::*;
    
    // ... existing instructions ...
    
    pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
        let market = &mut ctx.accounts.market;
        
        // Validation
        require!(
            market.status == MarketStatus::Open,
            PuntError::MarketNotOpen
        );
        
        // Logic
        market.status = MarketStatus::Cancelled;
        
        emit!(MarketCancelled {
            market: market.key(),
            authority: ctx.accounts.authority.key(),
        });
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CancelMarket<'info> {
    #[account(
        mut,
        has_one = authority @ PuntError::Unauthorized
    )]
    pub market: Account<'info, BetMarket>,
    
    pub authority: Signer<'info>,
}

#[event]
pub struct MarketCancelled {
    pub market: Pubkey,
    pub authority: Pubkey,
}
```

**Step 2:** Add error code if needed

```rust
#[error_code]
pub enum PuntError {
    #[msg("Market must be open to cancel")]
    MarketNotOpen,
    
    #[msg("Unauthorized")]
    Unauthorized,
    
    // ... other errors ...
}
```

**Step 3:** Rebuild and deploy

```bash
cd punt-program
anchor build
anchor deploy --provider.cluster devnet
```

**Step 4:** Update IDL in frontend

```bash
cp target/idl/punt_program.json ../punt-frontend/idl/
cp target/types/punt_program.ts ../punt-frontend/idl/
```

**Step 5:** Call from frontend

```typescript
await program.methods
  .cancelMarket()
  .accounts({
    market: marketPDA,
    authority: wallet.publicKey,
  })
  .rpc();
```

---

## 3. Building a New Frontend Component

### Example: Create `<PollCard>` component

**Step 1:** Create file at `/punt-frontend/components/PollCard.tsx`

```typescript
"use client";
import { motion } from "framer-motion";

interface PollCardProps {
  title: string;
  yesPool: number;
  noPool: number;
  status: "active" | "frozen" | "resolved";
  onBet?: (side: 0 | 1) => void;
}

export function PollCard({ title, yesPool, noPool, status, onBet }: PollCardProps) {
  const totalPool = yesPool + noPool;
  const yesOdds = totalPool > 0 ? (totalPool / yesPool).toFixed(2) : "0";
  const noOdds = totalPool > 0 ? (totalPool / noPool).toFixed(2) : "0";
  
  const isBettingOpen = status === "active";
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg"
    >
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <div className="text-sm text-gray-500">Yes Pool</div>
          <div className="text-2xl font-bold">{yesPool.toFixed(2)} SOL</div>
          <div className="text-sm text-green-600">{yesOdds}x odds</div>
        </div>
        
        <div className="flex-1">
          <div className="text-sm text-gray-500">No Pool</div>
          <div className="text-2xl font-bold">{noPool.toFixed(2)} SOL</div>
          <div className="text-sm text-red-600">{noOdds}x odds</div>
        </div>
      </div>
      
      {isBettingOpen && onBet && (
        <div className="flex gap-2">
          <button
            onClick={() => onBet(1)}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg transition"
          >
            Bet YES
          </button>
          <button
            onClick={() => onBet(0)}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg transition"
          >
            Bet NO
          </button>
        </div>
      )}
      
      {status === "frozen" && (
        <div className="text-center text-gray-500 py-2">
          🧊 Betting Closed - Resolving...
        </div>
      )}
      
      {status === "resolved" && (
        <div className="text-center text-blue-600 font-bold py-2">
          ✅ Resolved
        </div>
      )}
    </motion.div>
  );
}
```

**Step 2:** Add to page

```typescript
// /punt-frontend/app/watch/page.tsx
import { PollCard } from "@/components/PollCard";

export default function WatchPage() {
  // ... fetch data with useSWR ...
  
  return (
    <div className="container mx-auto p-4">
      <PollCard
        title={poll.title}
        yesPool={poll.yesPool}
        noPool={poll.noPool}
        status={poll.status}
        onBet={handleBet}
      />
    </div>
  );
}
```

**Component Standards:**
- ✅ Use TypeScript interfaces for props
- ✅ Add `"use client"` if using hooks/interactivity
- ✅ Use Framer Motion for animations
- ✅ Support dark mode with `dark:` Tailwind classes
- ✅ Export as named export (not default)

---

## 4. Adding a Database Table

### Example: Add `StreamerProfile` table

**Step 1:** Update `/punt-frontend/prisma/schema.prisma`

```prisma
model StreamerProfile {
  id              String   @id @default(uuid())
  wallet          String   @unique           // Solana wallet address
  displayName     String
  bio             String?
  twitterHandle   String?
  totalStreams    Int      @default(0)
  totalVolume     Decimal  @default(0) @db.Decimal(18, 9)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  polls           Poll[]   @relation("StreamerPolls")
  
  @@index([wallet])
}

// Add relation to existing Poll model
model Poll {
  // ... existing fields ...
  
  streamer        StreamerProfile @relation("StreamerPolls", fields: [authorityId], references: [wallet])
}
```

**Step 2:** Generate migration

```bash
cd punt-frontend
npx prisma migrate dev --name add_streamer_profiles
```

**Step 3:** Regenerate Prisma client

```bash
npx prisma generate
```

**Step 4:** Use in API route

```typescript
// Create profile
const profile = await prisma.streamerProfile.create({
  data: {
    wallet: "wallet-address",
    displayName: "CoolStreamer",
    bio: "TCG enthusiast",
  },
});

// Query with relations
const profileWithPolls = await prisma.streamerProfile.findUnique({
  where: { wallet: "wallet-address" },
  include: { polls: true },
});
```

---

## 5. Modifying AI Agent Logic

### Example: Add support for multiple card sets

**Step 1:** Load multiple CSV files in `/ai-agent/src/main.ts`

```typescript
import fs from "fs";
import path from "path";
import csv from "csv-parser";

interface CardData {
  name: string;
  rarity: string;
  set: string;
}

let cardDatabase: CardData[] = [];

function loadCardDatabases() {
  const csvFolder = path.join(__dirname, "../csv_folder");
  const files = fs.readdirSync(csvFolder).filter(f => f.endsWith(".csv"));
  
  for (const file of files) {
    const filePath = path.join(csvFolder, file);
    const setName = file.replace(".csv", "");
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        cardDatabase.push({
          name: row.Name || row.name,
          rarity: row.Rarity || row.rarity,
          set: setName,
        });
      })
      .on("end", () => {
        console.log(`✅ Loaded ${setName} card data`);
      });
  }
}

loadCardDatabases();
```

**Step 2:** Update matching logic

```typescript
function detectUltraRare(detectedTexts: string[]): boolean {
  const normalizedTexts = detectedTexts.map(t => t.toLowerCase());
  
  for (const card of cardDatabase) {
    const cardNameLower = card.name.toLowerCase();
    
    // Check if any detected text contains the card name
    const isDetected = normalizedTexts.some(text => text.includes(cardNameLower));
    
    if (isDetected && card.rarity === "Ultra Rare") {
      console.log(`✅ Detected Ultra Rare: ${card.name} (${card.set})`);
      return true;
    }
  }
  
  return false;
}
```

**Step 3:** Add environment variable for active set

```bash
# .env
ACTIVE_CARD_SET="SV08SurgingSparks" # Only match cards from this set
```

**Step 4:** Filter by set

```typescript
const activeSet = process.env.ACTIVE_CARD_SET;
const relevantCards = cardDatabase.filter(c => c.set === activeSet);
```

---

## 6. Error Handling Standards

### Frontend Error Handling

```typescript
import { toast } from "sonner"; // Or your toast library

// API call errors
try {
  const response = await fetch("/api/polls");
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const data = await response.json();
} catch (error) {
  console.error("Failed to fetch polls:", error);
  toast.error("Failed to load polls. Please try again.");
}

// Solana transaction errors
try {
  await program.methods.placeBet(...).rpc();
  toast.success("Bet placed successfully!");
} catch (error) {
  console.error("Transaction failed:", error);
  
  if (error.message.includes("insufficient")) {
    toast.error("Insufficient SOL balance");
  } else if (error.message.includes("rejected")) {
    toast.error("Transaction rejected by wallet");
  } else {
    toast.error("Transaction failed. Please try again.");
  }
}
```

### Backend Error Handling

```typescript
// API routes
export async function POST(req: NextRequest) {
  try {
    // ... logic ...
  } catch (error) {
    // Log full error for debugging
    console.error("API Error:", error);
    
    // Return generic message to client (don't expose internals)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Input validation
const body = await req.json();

if (!body.wallet || typeof body.wallet !== "string") {
  return NextResponse.json(
    { error: "Invalid wallet address" },
    { status: 400 }
  );
}

if (body.amount < 0.01 || body.amount > 10) {
  return NextResponse.json(
    { error: "Amount must be between 0.01 and 10 SOL" },
    { status: 400 }
  );
}
```

### Solana Program Error Handling

```rust
// Custom errors
#[error_code]
pub enum PuntError {
    #[msg("Market is not open for betting")]
    MarketNotOpen,
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
    
    #[msg("Unauthorized")]
    Unauthorized,
}

// Use in instruction
pub fn place_bet(ctx: Context<PlaceBet>, amount: u64, side: u8) -> Result<()> {
    let market = &mut ctx.accounts.market;
    
    require!(
        market.status == MarketStatus::Open,
        PuntError::MarketNotOpen
    );
    
    require!(
        side == 0 || side == 1,
        PuntError::InvalidSide
    );
    
    // ... rest of logic ...
}
```

---

## 7. Testing New Features

### Unit Tests (Utilities)

**File:** `/punt-frontend/tests/payout.test.ts`

```typescript
import { test, describe } from "node:test";
import assert from "node:assert";
import { computeNetPayoutLamports } from "@/lib/payout";

describe("Payout Calculation", () => {
  test("calculates correct payout for winning bet", () => {
    const market = {
      yesPool: 5_000_000_000,
      noPool: 3_000_000_000,
      winningSide: 1,
    };
    
    const ticket = {
      amount: 500_000_000,
      side: 1,
    };
    
    const payout = computeNetPayoutLamports(market, ticket);
    assert.strictEqual(payout, 300_000_000); // 0.3 SOL profit
  });
  
  test("returns 0 for losing bet", () => {
    const market = { yesPool: 5e9, noPool: 3e9, winningSide: 1 };
    const ticket = { amount: 3e8, side: 0 };
    
    const payout = computeNetPayoutLamports(market, ticket);
    assert.strictEqual(payout, 0);
  });
});
```

**Run tests:**
```bash
npm test
```

---

### Integration Tests (API Routes)

**File:** `/punt-frontend/tests/api/polls.test.ts`

```typescript
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { prisma } from "@/lib/server/db";

describe("POST /api/polls", () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.poll.deleteMany({ where: { title: { contains: "TEST" } } });
  });
  
  test("creates a new poll", async () => {
    const response = await fetch("http://localhost:3000/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "TEST: Will pack have Charizard?",
        authorityId: "test-wallet-123",
      }),
    });
    
    assert.strictEqual(response.status, 200);
    
    const data = await response.json();
    assert.ok(data.poll);
    assert.strictEqual(data.poll.title, "TEST: Will pack have Charizard?");
  });
});
```

---

### Solana Program Tests

**File:** `/punt-program/tests/punt_program.ts`

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PuntProgram } from "../target/types/punt_program";
import { assert } from "chai";

describe("punt_program", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.PuntProgram as Program<PuntProgram>;
  
  it("initializes a market", async () => {
    const authority = provider.wallet.publicKey;
    const pollId = "test-poll-123";
    
    const [marketPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("bet_market"),
        authority.toBuffer(),
        Buffer.from(pollId),
      ],
      program.programId
    );
    
    await program.methods
      .initializeMarket(pollId)
      .accounts({
        market: marketPDA,
        authority,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    
    const market = await program.account.betMarket.fetch(marketPDA);
    assert.equal(market.pollId, pollId);
    assert.equal(market.yesPool.toNumber(), 0);
    assert.equal(market.noPool.toNumber(), 0);
  });
});
```

**Run tests:**
```bash
anchor test
```

---

## 8. Code Style Guidelines

### TypeScript

```typescript
// ✅ Good: Named exports
export function calculateOdds(pool: number, total: number): number {
  return total / pool;
}

// ❌ Avoid: Default exports (makes refactoring harder)
export default function calculateOdds() { ... }

// ✅ Good: Explicit types
interface BetData {
  amount: number;
  side: 0 | 1;
}

function processBet(data: BetData): void { ... }

// ❌ Avoid: Any types
function processBet(data: any) { ... }

// ✅ Good: Early returns
function validateBet(amount: number): string | null {
  if (amount < 0.01) return "Amount too low";
  if (amount > 10) return "Amount too high";
  return null; // No error
}

// ❌ Avoid: Deep nesting
function validateBet(amount: number): string | null {
  if (amount >= 0.01) {
    if (amount <= 10) {
      return null;
    } else {
      return "Amount too high";
    }
  } else {
    return "Amount too low";
  }
}
```

### Rust (Solana Programs)

```rust
// ✅ Good: Use require! for validation
require!(
    market.status == MarketStatus::Open,
    PuntError::MarketNotOpen
);

// ❌ Avoid: Manual error returns
if market.status != MarketStatus::Open {
    return Err(PuntError::MarketNotOpen.into());
}

// ✅ Good: Derive traits
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketStatus {
    Open,
    Frozen,
    Resolved,
}

// ✅ Good: Use has_one constraint
#[account(
    mut,
    has_one = authority @ PuntError::Unauthorized
)]
pub market: Account<'info, BetMarket>,
```

### React Components

```typescript
// ✅ Good: Functional components with explicit props
interface Props {
  title: string;
  onSubmit: () => void;
}

export function MyComponent({ title, onSubmit }: Props) {
  return <button onClick={onSubmit}>{title}</button>;
}

// ✅ Good: Use hooks for state
const [isLoading, setIsLoading] = useState(false);

// ✅ Good: Use useEffect with dependencies
useEffect(() => {
  fetchData();
}, [pollId]); // Re-run when pollId changes

// ❌ Avoid: Missing dependencies
useEffect(() => {
  fetchData(pollId); // pollId not in deps array
}, []);
```

### File Naming

```
// ✅ Good
components/BetButton.tsx        // PascalCase for components
lib/utils/formatSol.ts          // camelCase for utilities
app/api/polls/route.ts          // lowercase for routes
types/index.ts                  // lowercase for config files

// ❌ Avoid
components/bet-button.tsx       // kebab-case
lib/FormatSol.ts                // PascalCase for non-components
```

---

## 🚀 Deployment Checklist

### Before Deploying to Production

- [ ] Run all tests: `npm test`, `anchor test`
- [ ] Build succeeds: `npm run build`, `anchor build`
- [ ] No TypeScript errors: `tsc --noEmit`
- [ ] No ESLint warnings: `npm run lint`
- [ ] Update environment variables in Vercel/Railway
- [ ] Test on Devnet first
- [ ] Audit Solana program (if changes made)
- [ ] Update documentation if API changes
- [ ] Tag release in Git: `git tag v1.0.0`

---

**When AI implements new features, ALWAYS:**
1. Follow these patterns exactly
2. Add tests for new functionality
3. Handle errors gracefully
4. Update this document if introducing new patterns
5. Ask clarifying questions if requirements are unclear