# 🔧 Punt Technical Implementation Guide (For AI Agents)

**Last Updated:** November 18, 2025  
**Purpose:** Exact code patterns, imports, and file structure for AI to reference when writing code

---

## 📦 Tech Stack Versions

```json
{
  "frontend": {
    "next": "15.5.3",
    "react": "19.1.0",
    "typescript": "^5",
    "@solana/web3.js": "^1.98.4",
    "@coral-xyz/anchor": "^0.31.1",
    "@arcium-hq/client": "^0.3.0",
    "livekit-client": "^2.15.11",
    "prisma": "^6.2.1",
    "swr": "^2.3.0",
    "tailwindcss": "^4"
  },
  "smartContract": {
    "anchor": "0.31.1",
    "rust": "1.75.0",
    "solana-cli": "1.18.x"
  },
  "aiAgent": {
    "node": "20.x",
    "typescript": "^5",
    "@google-cloud/vision": "^4.0.0",
    "livekit-server-sdk": "^2.14.0"
  }
}
```

---

## 🗂️ Project Structure

```
punt/
├── punt-frontend/          # Next.js web app
│   ├── app/
│   │   ├── watch/page.tsx         # Viewer UI
│   │   ├── studio/page.tsx        # Streamer UI
│   │   ├── dashboard/page.tsx     # Bet history
│   │   └── api/                   # Server-side routes
│   │       ├── polls/route.ts
│   │       ├── store-bet/route.ts
│   │       ├── get-bets/route.ts
│   │       ├── claim-all/route.ts
│   │       └── livekit-token/route.ts
│   ├── components/                # React components
│   │   ├── AppShell.tsx          # Navigation wrapper
│   │   ├── BetOutcomeOverlay.tsx # Results display
│   │   └── ...
│   ├── lib/                      # Utilities
│   │   ├── solana.ts            # Blockchain helpers
│   │   ├── arciumClient.ts      # Encryption logic
│   │   ├── payout.ts            # Payout math
│   │   └── server/
│   │       ├── db.ts            # Prisma client
│   │       ├── solana.ts        # Server-side Solana
│   │       └── signature.ts     # Auth verification
│   ├── prisma/
│   │   └── schema.prisma        # Database schema
│   ├── idl/
│   │   └── punt_program.json    # Solana program interface
│   └── types/
│       └── index.ts             # TypeScript types
│
├── punt-program/           # Solana smart contract
│   ├── programs/punt_program/src/
│   │   ├── lib.rs              # Main program
│   │   ├── instructions/       # Instruction handlers
│   │   ├── state/              # Account structs
│   │   └── errors.rs           # Custom errors
│   └── tests/
│       └── punt_program.ts     # Anchor tests
│
├── punt_mxe/               # Arcium MXE program
│   ├── programs/punt_mxe/src/
│   │   └── lib.rs
│   └── build/
│       └── store_bet.arcis     # Compiled circuit
│
└── ai-agent/               # Resolution bot
    ├── src/
    │   ├── main.ts            # Agent entry point
    │   ├── vision.ts          # Google Vision API
    │   └── solana.ts          # Transaction submission
    └── csv_folder/
        └── SV08SurgingSparksProductsAndPrices.csv
```

---

## 🗄️ Database Schema (Prisma)

**File:** `/punt-frontend/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL") // Neon Postgres
}

model Poll {
  id          String   @id @default(uuid())
  pollId      String   @unique       // UUID, matches Solana market PDA
  title       String                 // "Will this pack have a Charizard?"
  authorityId String                 // Streamer wallet address
  status      String                 // "active" | "frozen" | "resolved"
  outcome     String?                // "yes" | "no" | null
  createdAt   DateTime @default(now())
  
  bets        EncryptedBet[]
}

model EncryptedBet {
  id              Int      @id @default(autoincrement())
  wallet          String                      // Bettor wallet (indexed)
  marketAddress   String                      // Solana market PDA
  pollId          String                      // UUID reference
  pollTitle       String                      // Display name
  side            Int                         // 0 = No, 1 = Yes
  amount          Decimal  @db.Decimal(18, 9) // SOL amount (plaintext for filtering)
  outcome         String                      // "pending" | "win" | "loss"
  encryptedData   String   @db.Text           // JSON string of ciphertext array
  nonce           String                      // Hex-encoded 16-byte nonce
  arcisPublicKey  String   @db.Text           // Base64 client public key
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  poll            Poll     @relation(fields: [pollId], references: [pollId])
  
  @@index([wallet])
  @@index([pollId])
  @@index([marketAddress])
}
```

**Key Points for AI:**
- `amount` is DECIMAL(18,9) to match Solana lamports precision
- `encryptedData` stores the full bet payload as JSON string
- `side` and `amount` are plaintext for querying (not sensitive)

---

## 🔗 Solana Program IDL

**File:** `/punt-frontend/idl/punt_program.json`

```typescript
// Abbreviated TypeScript interface (generated from Anchor IDL)
export type PuntProgram = {
  "version": "0.1.0",
  "name": "punt_program",
  "instructions": [
    {
      "name": "initializeMarket",
      "accounts": [
        { "name": "market", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "pollId", "type": "string" }
      ]
    },
    {
      "name": "placeBet",
      "accounts": [
        { "name": "market", "isMut": true, "isSigner": false },
        { "name": "ticket", "isMut": true, "isSigner": false },
        { "name": "owner", "isMut": true, "isSigner": true },
        { "name": "systemProgram", "isMut": false, "isSigner": false }
      ],
      "args": [
        { "name": "amount", "type": "u64" },    // Lamports
        { "name": "side", "type": "u8" }         // 0 or 1
      ]
    },
    {
      "name": "freezeMarket",
      "accounts": [
        { "name": "market", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": false, "isSigner": true }
      ],
      "args": []
    },
    {
      "name": "resolveMarket",
      "accounts": [
        { "name": "market", "isMut": true, "isSigner": false },
        { "name": "authority", "isMut": false, "isSigner": true }
      ],
      "args": [
        { "name": "winningSide", "type": "u8" } // 0 or 1
      ]
    },
    {
      "name": "claimPayout",
      "accounts": [
        { "name": "market", "isMut": true, "isSigner": false },
        { "name": "ticket", "isMut": true, "isSigner": false },
        { "name": "owner", "isMut": true, "isSigner": false }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "BetMarket",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "authority", "type": "publicKey" },
          { "name": "pollId", "type": "string" },
          { "name": "yesPool", "type": "u64" },
          { "name": "noPool", "type": "u64" },
          { "name": "status", "type": { "defined": "MarketStatus" } },
          { "name": "winningSide", "type": { "option": "u8" } },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "BetTicket",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "market", "type": "publicKey" },
          { "name": "owner", "type": "publicKey" },
          { "name": "amount", "type": "u64" },
          { "name": "side", "type": "u8" },
          { "name": "claimed", "type": "bool" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
}
```

---

## 🎨 Frontend Code Patterns

### 1. **Fetching Poll Data (Client-Side)**

**File:** `/punt-frontend/app/watch/page.tsx`

```typescript
"use client";
import useSWR from "swr";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program } from "@coral-xyz/anchor";
import { PuntProgram } from "@/idl/punt_program";
import IDL from "@/idl/punt_program.json";

const PROGRAM_ID = new PublicKey("3ke7tRTEFF8qr9pJLmufeb9xiPdatFq5K3GSqUQhbbw1");
const connection = new Connection("https://api.devnet.solana.com");

// SWR fetcher for live poll data
async function fetchMarket(marketPDA: string) {
  const program = new Program<PuntProgram>(
    IDL as PuntProgram,
    PROGRAM_ID,
    { connection }
  );
  
  const marketAccount = await program.account.betMarket.fetch(
    new PublicKey(marketPDA)
  );
  
  return {
    yesPool: marketAccount.yesPool.toNumber() / 1e9, // Convert lamports → SOL
    noPool: marketAccount.noPool.toNumber() / 1e9,
    status: marketAccount.status,
    winningSide: marketAccount.winningSide,
  };
}

export default function WatchPage() {
  const { data: market, error } = useSWR(
    ["market", "marketPDA-here"],
    ([_, pda]) => fetchMarket(pda),
    { refreshInterval: 2000 } // Poll every 2 seconds
  );
  
  if (!market) return <div>Loading...</div>;
  
  const totalPool = market.yesPool + market.noPool;
  const yesOdds = totalPool > 0 ? (totalPool / market.yesPool).toFixed(2) : "0";
  
  return (
    <div>
      <h1>Yes Odds: {yesOdds}x</h1>
      <p>Yes Pool: {market.yesPool} SOL</p>
      <p>No Pool: {market.noPool} SOL</p>
    </div>
  );
}
```

**Key Patterns:**
- Use `useSWR` with `refreshInterval: 2000` for live updates
- Convert lamports to SOL: `lamports / 1e9`
- Always check `if (!data)` before rendering

---

### 2. **Placing a Bet (Client-Side Transaction)**

**File:** `/punt-frontend/components/BetButton.tsx`

```typescript
"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PuntProgram } from "@/idl/punt_program";
import IDL from "@/idl/punt_program.json";

const PROGRAM_ID = new PublicKey("3ke7tRTEFF8qr9pJLmufeb9xiPdatFq5K3GSqUQhbbw1");

export function BetButton({ marketPDA, side }: { marketPDA: string; side: 0 | 1 }) {
  const wallet = useWallet();
  const connection = new Connection("https://api.devnet.solana.com");
  
  async function placeBet() {
    if (!wallet.publicKey || !wallet.signTransaction) {
      alert("Connect wallet first");
      return;
    }
    
    const provider = new AnchorProvider(connection, wallet as any, {});
    const program = new Program<PuntProgram>(IDL as PuntProgram, PROGRAM_ID, provider);
    
    // Derive PDAs
    const marketPubkey = new PublicKey(marketPDA);
    const [ticketPDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("bet_ticket"),
        marketPubkey.toBuffer(),
        wallet.publicKey.toBuffer(),
      ],
      PROGRAM_ID
    );
    
    const amountLamports = 0.05 * 1e9; // 0.05 SOL
    
    try {
      const tx = await program.methods
        .placeBet(amountLamports, side)
        .accounts({
          market: marketPubkey,
          ticket: ticketPDA,
          owner: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("Bet placed! Signature:", tx);
      
      // Optional: Store encrypted bet
      await fetch("/api/store-bet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: wallet.publicKey.toString(),
          marketAddress: marketPDA,
          pollId: "poll-uuid-here",
          side,
          amount: 0.05,
        }),
      });
      
    } catch (err) {
      console.error("Bet failed:", err);
      alert("Transaction failed");
    }
  }
  
  return (
    <button onClick={placeBet} className="bg-blue-500 px-4 py-2 rounded">
      Bet {side === 1 ? "Yes" : "No"}
    </button>
  );
}
```

**Key Patterns:**
- Use `useWallet()` from `@solana/wallet-adapter-react`
- Derive PDAs with `PublicKey.findProgramAddressSync()`
- Convert SOL to lamports: `sol * 1e9`
- Use `program.methods.instructionName().accounts({...}).rpc()`

---

### 3. **API Route: Storing Encrypted Bet**

**File:** `/punt-frontend/app/api/store-bet/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { encryptBetPayload } from "@/lib/arciumClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wallet, marketAddress, pollId, pollTitle, side, amount } = body;
    
    // Encrypt bet data
    const payload = { pollId, pollTitle, side, amount, wallet };
    const { ciphertext, nonce, arcisPublicKey } = await encryptBetPayload(payload);
    
    // Store in database
    const bet = await prisma.encryptedBet.create({
      data: {
        wallet,
        marketAddress,
        pollId,
        pollTitle,
        side,
        amount,
        outcome: "pending",
        encryptedData: JSON.stringify(ciphertext), // Array → JSON string
        nonce,
        arcisPublicKey,
      },
    });
    
    return NextResponse.json({ success: true, betId: bet.id });
    
  } catch (error) {
    console.error("Failed to store bet:", error);
    return NextResponse.json(
      { error: "Failed to store bet" },
      { status: 500 }
    );
  }
}
```

**Key Patterns:**
- Import `prisma` from `@/lib/server/db`
- Use `await req.json()` to parse body
- Always wrap in `try/catch`
- Return `NextResponse.json()` (not `Response.json()`)

---

### 4. **API Route: Retrieving Encrypted Bets**

**File:** `/punt-frontend/app/api/get-bets/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { decryptBetPayload } from "@/lib/arciumClient";

export async function GET(req: NextRequest) {
  try {
    const wallet = req.nextUrl.searchParams.get("wallet");
    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet param" }, { status: 400 });
    }
    
    // Query encrypted bets
    const encryptedBets = await prisma.encryptedBet.findMany({
      where: { wallet },
      orderBy: { createdAt: "desc" },
    });
    
    // Decrypt each bet
    const decryptedBets = await Promise.all(
      encryptedBets.map(async (bet) => {
        const ciphertext = JSON.parse(bet.encryptedData); // JSON string → array
        const decrypted = await decryptBetPayload({
          ciphertext,
          nonce: bet.nonce,
          arcisPublicKey: bet.arcisPublicKey,
        });
        
        return {
          id: bet.id,
          pollTitle: bet.pollTitle,
          side: bet.side === 1 ? "Yes" : "No",
          amount: bet.amount.toString(),
          outcome: bet.outcome,
          createdAt: bet.createdAt.toISOString(),
          decryptedData: decrypted, // Full bet payload
        };
      })
    );
    
    return NextResponse.json({ bets: decryptedBets });
    
  } catch (error) {
    console.error("Failed to get bets:", error);
    return NextResponse.json(
      { error: "Failed to retrieve bets" },
      { status: 500 }
    );
  }
}
```

**Key Patterns:**
- Use `req.nextUrl.searchParams.get()` for query params
- Use `Promise.all()` for parallel async operations
- Convert Decimal to string: `amount.toString()`

---

## 🔐 Arcium Encryption Helpers

**File:** `/punt-frontend/lib/arciumClient.ts`

```typescript
import { Connection, PublicKey } from "@solana/web3.js";
import { ArciumClient } from "@arcium-hq/client";

const MXE_PROGRAM_ID = new PublicKey("AeDEKEm6btYZenwJECNUULgdTr4fuFQRgsVJBn2rYFsn");
const connection = new Connection(process.env.SOLANA_RPC_URL!);

const client = new ArciumClient({
  programId: MXE_PROGRAM_ID,
  connection,
});

export async function encryptBetPayload(payload: any) {
  // Generate ephemeral keypair
  const clientKeypair = Keypair.generate();
  
  // Fetch MXE public key from Solana
  const mxePubkey = await client.getMxePublicKey();
  
  // Perform x25519 key exchange
  const sharedSecret = await client.deriveSharedSecret(
    clientKeypair.secretKey,
    mxePubkey
  );
  
  // Encrypt with Rescue cipher
  const { ciphertext, nonce } = await client.encrypt(
    JSON.stringify(payload),
    sharedSecret
  );
  
  return {
    ciphertext,
    nonce: Buffer.from(nonce).toString("hex"),
    arcisPublicKey: clientKeypair.publicKey.toBase58(),
  };
}

export async function decryptBetPayload({
  ciphertext,
  nonce,
  arcisPublicKey,
}: {
  ciphertext: number[];
  nonce: string;
  arcisPublicKey: string;
}) {
  // Reconstruct keypair (server holds secret key)
  const clientSecret = Buffer.from(process.env.ARCIUM_CLIENT_SECRET_KEY!, "base58");
  const clientKeypair = Keypair.fromSecretKey(clientSecret);
  
  // Derive shared secret again
  const mxePubkey = await client.getMxePublicKey();
  const sharedSecret = await client.deriveSharedSecret(
    clientKeypair.secretKey,
    mxePubkey
  );
  
  // Decrypt
  const plaintext = await client.decrypt(
    ciphertext,
    Buffer.from(nonce, "hex"),
    sharedSecret
  );
  
  return JSON.parse(plaintext);
}
```

**Key Points:**
- Phase 1 uses SERVER-SIDE keys (stored in env vars)
- Phase 2 will use CLIENT-SIDE wallet keys instead

---

## 🤖 AI Agent Patterns

**File:** `/ai-agent/src/main.ts`

```typescript
import { Room, RoomEvent, DataPacket_Kind } from "livekit-client";
import vision from "@google-cloud/vision";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import fs from "fs";

const FREEZE_SIGNAL = "🧊 Poll frozen by host";
const visionClient = new vision.ImageAnnotatorClient({
  keyFilename: "./google-vision-key.json",
});

let isResolving = false;

async function startAgent() {
  const room = new Room();
  
  room.on(RoomEvent.DataReceived, async (payload, participant) => {
    const message = new TextDecoder().decode(payload);
    
    if (message.includes(FREEZE_SIGNAL) && !isResolving) {
      isResolving = true;
      console.log("🧊 Freeze detected, starting resolution...");
      
      await resolvePoll(room);
      
      isResolving = false;
    }
  });
  
  await room.connect(process.env.LIVEKIT_URL!, process.env.LIVEKIT_TOKEN!);
  console.log("✅ AI Agent connected to room");
}

async function resolvePoll(room: Room) {
  // 1. Capture frames
  const frames = [];
  for (let i = 0; i < 30; i++) { // 5 seconds at 6 FPS
    const frame = await captureFrame(room);
    if (frame) frames.push(frame);
    await sleep(167); // ~6 FPS
  }
  
  // 2. Send to Google Vision
  const detectedTexts = [];
  for (const frame of frames) {
    const [result] = await visionClient.textDetection(frame);
    const texts = result.textAnnotations?.map(t => t.description) || [];
    detectedTexts.push(...texts);
  }
  
  // 3. Match against card database
  const cardDB = loadCardDatabase();
  const hasUltraRare = detectedTexts.some(text =>
    cardDB.some(card =>
      text.toLowerCase().includes(card.name.toLowerCase()) &&
      card.rarity === "Ultra Rare"
    )
  );
  
  // 4. Submit resolution
  const winningSide = hasUltraRare ? 1 : 0; // 1 = Yes, 0 = No
  await submitResolution(winningSide);
  
  console.log(`✅ Resolved: ${winningSide === 1 ? "YES" : "NO"}`);
}

async function submitResolution(winningSide: 0 | 1) {
  const connection = new Connection(process.env.SOLANA_RPC_URL!);
  const authorityKeypair = Keypair.fromSecretKey(
    Buffer.from(process.env.SOLANA_AUTHORITY_SECRET_KEY!, "base58")
  );
  
  const wallet = new Wallet(authorityKeypair);
  const provider = new AnchorProvider(connection, wallet, {});
  const program = new Program(IDL, PROGRAM_ID, provider);
  
  const marketPDA = new PublicKey("market-pda-here");
  
  await program.methods
    .resolveMarket(winningSide)
    .accounts({
      market: marketPDA,
      authority: authorityKeypair.publicKey,
    })
    .rpc();
}

startAgent();
```

**Key Patterns:**
- Use `RoomEvent.DataReceived` to listen for chat messages
- Use `isResolving` flag to prevent duplicate resolutions
- Always await `sleep()` between API calls to avoid rate limits

---

## 🧪 Testing Patterns

**File:** `/punt-frontend/tests/payout.test.ts`

```typescript
import { test } from "node:test";
import assert from "node:assert";
import { computeNetPayoutLamports } from "@/lib/payout";

test("calculates correct payout for winning bet", () => {
  const market = {
    yesPool: 5_000_000_000, // 5 SOL
    noPool: 3_000_000_000,   // 3 SOL
    winningSide: 1,          // Yes wins
  };
  
  const ticket = {
    amount: 500_000_000,     // 0.5 SOL on Yes
    side: 1,
  };
  
  const payout = computeNetPayoutLamports(market, ticket);
  
  // Expected: (0.5 / 5) * 8 = 0.8 SOL gross
  // Net: 0.8 - 0.5 = 0.3 SOL profit = 300M lamports
  assert.strictEqual(payout, 300_000_000);
});

test("returns 0 for losing bet", () => {
  const market = { yesPool: 5e9, noPool: 3e9, winningSide: 1 };
  const ticket = { amount: 3e8, side: 0 }; // Bet on No, but Yes won
  
  const payout = computeNetPayoutLamports(market, ticket);
  assert.strictEqual(payout, 0);
});
```

**Key Patterns:**
- Use Node.js built-in test runner (`node:test`)
- Use `assert.strictEqual()` for exact number comparisons
- Always test with lamports (not SOL) to avoid floating-point errors

---

## 🚀 Deployment Commands

### Frontend (Vercel)
```bash
cd punt-frontend
npm run build
vercel --prod
```

### Solana Program (Devnet)
```bash
cd punt-program
anchor build
anchor deploy --provider.cluster devnet
```

### AI Agent (Railway)
```bash
cd ai-agent
npm run build
# Push to Railway via Git
git push railway main
```

---

## 🔑 Environment Variables

**Frontend (`.env`):**
```bash
# Database
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Solana
NEXT_PUBLIC_SOLANA_RPC_URL="https://api.devnet.solana.com"
NEXT_PUBLIC_SOLANA_PROGRAM_ID="3ke7tRTEFF8qr9pJLmufeb9xiPdatFq5K3GSqUQhbbw1"

# LiveKit
LIVEKIT_API_KEY="your_api_key"
LIVEKIT_API_SECRET="your_secret"
NEXT_PUBLIC_LIVEKIT_URL="wss://punt-fhvi3fy6.livekit.cloud"

# Arcium (Phase 1 - server-side keys)
ARCIUM_PAYER_SECRET_KEY="base58_encoded_secret"
ARCIUM_CLIENT_SECRET_KEY="base58_encoded_secret"
```

**AI Agent (`.env`):**
```bash
# LiveKit
LIVEKIT_URL="wss://punt-fhvi3fy6.livekit.cloud"
LIVEKIT_API_KEY="your_key"
LIVEKIT_API_SECRET="your_secret"
LIVEKIT_ROOM="punt-stream-123"
LIVEKIT_PROGRAM_IDENTITY="host"

# Google Vision
GOOGLE_APPLICATION_CREDENTIALS="./google-vision-key.json"

# Solana
SOLANA_RPC_URL="https://api.devnet.solana.com"
SOLANA_PROGRAM_ID="3ke7tRTEFF8qr9pJLmufeb9xiPdatFq5K3GSqUQhbbw1"
SOLANA_AUTHORITY_SECRET_KEY="base58_encoded_secret"

# Performance
FRAME_SAMPLE_RATE_HZ=6
VISION_FRAME_STRIDE_MS=250
VISION_MIN_CONFIDENCE=0.75
```

---

## 🚨 Common Errors AI Should Handle

### 1. **Wallet Not Connected**
```typescript
if (!wallet.publicKey) {
  toast.error("Please connect your wallet first");
  return;
}
```

### 2. **Insufficient SOL Balance**
```typescript
try {
  await program.methods.placeBet(...).rpc();
} catch (err) {
  if (err.message.includes("insufficient")) {
    toast.error("Not enough SOL in wallet");
  }
}
```

### 3. **Market Already Frozen**
```typescript
if (market.status === "frozen") {
  toast.error("Betting is closed for this poll");
  return; // Don't submit transaction
}
```

### 4. **Google Vision API Rate Limit**
```typescript
if (err.code === 429) {
  console.error("Vision API rate limit hit, retrying in 1s...");
  await sleep(1000);
  return retry();
}
```

---

**When AI is asked to add features, ALWAYS:**
1. Check existing patterns in this document first
2. Reuse utility functions from `/lib/` instead of creating new ones
3. Match import statements exactly (versions matter)
4. Use the same error handling patterns
5. Update Prisma schema if adding new database fields
6. Update IDL types if modifying Solana program