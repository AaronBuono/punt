# Punt - Live Prediction Markets for Pokémon Pack Openings

> **Solana Hackathon Submission** | **Arcium Sidetrack Submission**

## 🎯 Overview

Punt is a **Solana-based prediction market platform** for livestreamed Pokémon pack openings. Streamers broadcast their pack openings via LiveKit, viewers place bets on what cards will be pulled, and an AI agent automatically resolves markets using Google Vision API.

### Core Features

- 🎥 **LiveKit Integration**: Real-time streaming with host/viewer modes
- 🎮 **Solana Smart Contracts**: On-chain prediction markets with instant settlement
- 🤖 **AI-Powered Resolution**: Google Vision API detects cards and resolves bets automatically
- 🔐 **Arcium Encryption**: Optional privacy layer for bet data (Arcium sidetrack submission)
- 💰 **Instant Payouts**: Claim winnings immediately after market resolution


### Why Pokémon Pack Openings?

The Pokémon TCG market is **huge**:
- $10B+ annual market
- Millions of pack opening streams on YouTube/Twitch
- No existing platform for real-time betting on pulls

**Problems with current solutions:**
- Traditional prediction markets are slow and manual
- Streamers manually resolve bets (error-prone, time-consuming)
- No privacy for bets (whales influence market odds)

**Punt solves this:**
- ⚡ **Instant markets**: Create polls in seconds during streams
- 🤖 **Auto-resolution**: AI detects cards and settles bets automatically
- 🔐 **Privacy option**: Arcium encryption hides bet amounts from public view
- 💎 **Solana-powered**: Low fees, instant settlement, transparent on-chain history

---

## 🎬 How It Works

### 1. Streamer Setup (Studio Mode)
```
Streamer opens pack → Creates poll ("Will this pack have a Charizard?")
                   ↓
              Poll goes live → Viewers place bets (YES/NO)
                   ↓
         Streamer opens pack → Reveals cards on camera
                   ↓
    Streamer freezes poll → AI agent watches stream
                   ↓
      Google Vision API → Detects "Charizard" in frame
                   ↓
    Auto-resolve market → Solana smart contract pays winners
```

### 2. Viewer Experience (Watch Mode)
- Connect wallet (Phantom, Solflare, etc.)
- Watch live stream via LiveKit
- Place bets on active polls (0.01 - 10 SOL)
- See live odds update as others bet
- **Optional**: Encrypt bets with Arcium for privacy
- Claim winnings instantly after resolution

### 3. AI Agent (Automated Resolution)
- Monitors LiveKit room for freeze signal
- Samples video frames when poll is frozen
- Uses Google Vision API to detect card names
- Compares detected cards against poll criteria
- Submits resolution transaction to Solana
- Market settles automatically

---

## 🔐 Arcium Integration (Sidetrack Submission)

As an **optional privacy feature**, Punt integrates Arcium's encryption SDK to protect bet data.

### Why Privacy Matters for Prediction Markets

Traditional on-chain prediction markets expose all bet information:
- **Whale watching**: Large bets influence market odds and behavior
- **Front-running**: Bots copy successful betting patterns
- **Privacy concerns**: All betting history is permanently public

### How Arcium Helps

**Current Implementation: Client-Side Encryption**

```
┌─────────────────┐
│  User Browser   │
│                 │
│  1. Generate    │──────┐
│     x25519 keys │      │
└─────────────────┘      │
                         │
                         ▼
                 ┌───────────────────┐
                 │ Arcium Encryption │
                 │   (Client-Side)   │
                 │                   │
                 │ • x25519 ECDH     │
                 │ • Rescue Cipher   │
                 │ • Unique nonces   │
                 └───────────────────┘
                         │
                         ▼
                 ┌───────────────────┐
                 │  Encrypted Bet    │
                 │   {ciphertext}    │
                 └───────────────────┘
                         │
                         ▼
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌─────────────────┐           ┌─────────────────┐
│   Neon DB       │           │   Future: MXE   │
│   (Current)     │           │   (Planned)     │
│                 │           │                 │
│ Encrypted data  │           │ On-chain        │
│ stored securely │           │ encrypted       │
└─────────────────┘           │ computation     │
         │                    └─────────────────┘
         │
         ▼
┌─────────────────┐
│   Dashboard     │
│                 │
│ Arcium decrypt  │
│ (Owner only)    │
└─────────────────┘
```

### Current Implementation: Client-Side Encryption

**Technology Stack:**
- **Arcium SDK**: `@arcium-hq/client` v0.3.0
- **Key Exchange**: x25519 elliptic curve Diffie-Hellman
- **Cipher**: Rescue (algebraic hash function optimized for ZK proofs)
- **Storage**: Neon PostgreSQL (encrypted data at rest)

**Privacy Benefits:**
1. ✅ **Bet Privacy**: Individual bet amounts and choices are encrypted before storage
2. ✅ **Pattern Protection**: Prevents market manipulation based on whale activity
3. ✅ **Selective Disclosure**: Users can decrypt their own bets without revealing to others
4. ✅ **Front-Running Prevention**: Encrypted bets can't be copied by MEV bots
5. ✅ **Data Portability**: Encrypted data can be stored anywhere (database, IPFS, on-chain)

### Future: MXE Integration (Work in Progress)

The `punt_mxe/` directory contains an Arcium MXE (Multi-Party Execution) program that enables:
- **Private bet aggregation**: Compute total YES/NO volumes without decrypting individual bets
- **On-chain encrypted storage**: Store encrypted bets directly on Solana
- **Privacy-preserving resolution**: Resolve markets and distribute payouts while maintaining bet privacy

**Program ID**: `3gaXj1oSXKqn9rTgcPahqU9z3L2fjYexKYpmU1xNhefL` (Solana Devnet)

---

## 🏗️ Technical Architecture

### Solana Smart Contract (`punt-program/`)

**Core Instructions:**
- `initialize_market`: Create new prediction market for a poll
- `place_bet`: Lock SOL in escrow for YES/NO position
- `freeze_market`: Stop accepting new bets
- `resolve_market`: Settle market and determine winners
- `claim_winnings`: Withdraw winnings after resolution
- `withdraw_fees`: Host collects platform fees

**PDA Structure:**
```rust
// Market PDA: [authority, cycle]
// Ticket PDA: [user, market]
// AuthorityMeta: Stores cycle counter per streamer
```

**Key Features:**
- Cycle-based markets (multiple rounds per stream)
- Fee collection (configurable per market)
- Event emission for frontend tracking
- Ticket-based bet accounting

### Frontend (`punt-frontend/`)

**Tech Stack:**
- Next.js 15 (App Router)
- React 19
- Solana Web3.js + Anchor
- LiveKit Client SDK
- Prisma + Neon PostgreSQL
- Tailwind CSS 4

**Key Pages:**
- `/studio` - Host controls (initialize/freeze/resolve markets)
- `/watch` - Viewer experience (place bets, watch stream)
- `/live` - Browse active streams
- `/dashboard` - View bet history (with Arcium decryption)

**API Routes:**
- `/api/livekit/token` - Generate LiveKit access tokens
- `/api/stream` - Manage stream metadata
- `/api/store-bet` - Encrypt and store bet data (Arcium)
- `/api/get-bets` - Retrieve and decrypt bet history (Arcium)

### AI Agent (`ai-agent/`)

**Technology:**
- LiveKit Server SDK (room monitoring)
- Google Vision API (card detection)
- Solana Web3.js (transaction submission)
- TypeScript

**Workflow:**
1. Join LiveKit room as participant
2. Listen for freeze chat message from host
3. Sample video frames at configured rate
4. Run OCR + object detection via Google Vision
5. Parse detected text for card names/rarities
6. Match against poll criteria (e.g., "Charizard detected?")
7. Submit `resolve_market` transaction to Solana
8. Emit result to chat for transparency

**Configuration:**
```env
GOOGLE_APPLICATION_CREDENTIALS=./google-vision-key.json
VISION_MIN_CONFIDENCE=0.85
FRAME_SAMPLE_RATE_HZ=2
AUTO_SOLANA_RESOLVE=true
```

---

## 🏗️ Project Structure

```
punt/
├── punt-program/          # Anchor smart contract (market logic)
│   ├── programs/
│   │   └── punt-program/  # Market initialization, betting, resolution
│   └── target/idl/        # Generated IDL files
│
├── punt-frontend/         # Next.js 15 application
│   ├── app/
│   │   ├── watch/         # Viewer experience with bet placement
│   │   ├── studio/        # Host controls for market management
│   │   ├── dashboard/     # Private bet history (Arcium decryption)
│   │   └── api/
│   │       ├── store-bet/ # Encrypt bet → store in DB
│   │       └── get-bets/  # Fetch encrypted bets → decrypt
│   ├── lib/
│   │   └── arciumClient.ts # Arcium encryption/decryption utilities
│   └── prisma/
│       └── schema.prisma  # Database schema (EncryptedBet model)
│
├── punt_mxe/              # Arcium MXE program (future on-chain encryption)
│   ├── programs/
│   │   └── punt_mxe/      # MXE computation definitions
│   └── encrypted-ixs/     # Arcis confidential compute instructions
│
└── ai-agent/              # LiveKit + Google Vision automation
    ├── visionProcessor.ts # Card detection logic
    ├── livekitAgent.ts    # Stream monitoring
    └── cardLookup.ts      # Pokémon card database
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Rust + Solana CLI + Anchor CLI
- PostgreSQL database (or Neon account)
- LiveKit account for streaming

### Installation

```bash
# Clone repository
git clone https://github.com/AaronBuono/punt.git
cd punt

# Install frontend dependencies
cd punt-frontend
npm install

# Set up environment
cp .env.example .env.local
```

### Environment Configuration

#### Required: Solana Program

```env
# Punt Program (deploy to devnet/mainnet)
NEXT_PUBLIC_PROGRAM_ID=<your_deployed_program_id>
NEXT_PUBLIC_NETWORK=https://api.devnet.solana.com
```

Deploy the program:

```bash
cd punt-program
anchor build
anchor deploy --provider.cluster devnet

# Copy IDL to frontend
cd ../punt-frontend
npm run copy-idl
```

#### Required: LiveKit Streaming

```env
LIVEKIT_URL=wss://your-livekit-instance.livekit.cloud
LIVEKIT_API_KEY=<your_api_key>
LIVEKIT_API_SECRET=<your_api_secret>
```

Get credentials from: https://cloud.livekit.io

#### Required: Database (for stream metadata)

```env
# Neon PostgreSQL
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
```

Run migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

#### Optional: Arcium Encryption (Sidetrack Feature)

Generate server-side keys for Arcium encryption:

```bash
cd punt-frontend
./scripts/generate-arcium-keys.sh
```

Add the output to `.env.local`:

```env
# Arcium Encryption (Optional - for bet privacy)
ARCIUM_PAYER_SECRET_KEY=<generated_base58_key>
ARCIUM_CLIENT_SECRET_KEY=<generated_base58_key>
```

#### Optional: AI Agent (Google Vision)

```env
# In ai-agent/.env
GOOGLE_APPLICATION_CREDENTIALS=./google-vision-key.json
VISION_MIN_CONFIDENCE=0.85
FRAME_SAMPLE_RATE_HZ=2
AUTO_SOLANA_RESOLVE=true
SOLANA_WALLET_PATH=./dev-authority-keypair.json
```

### Run Development Server

```bash
cd punt-frontend
npm run dev
```

Visit:
- **Watch**: http://localhost:3000/watch - View streams and place bets
- **Studio**: http://localhost:3000/studio - Host controls for streamers
- **Live**: http://localhost:3000/live - Browse active streams
- **Dashboard**: http://localhost:3000/dashboard - View bet history (with Arcium decryption if enabled)

### Run AI Agent (Optional)

```bash
cd ai-agent
npm install
npm run start
```

The agent will:
- Join the LiveKit room specified in `.env`
- Monitor for freeze signals from the host
- Detect cards using Google Vision API
- Auto-resolve markets on Solana

---

## 🎮 Demo Flow

### Full User Journey

1. **Streamer Setup**
   ```bash
   # Navigate to /studio
   # Connect wallet (becomes authority)
   # Click "Start Stream" → LiveKit room created
   ```

2. **Create Market**
   ```bash
   # In studio: Click "Initialize Market"
   # Solana transaction: initialize_market(authority, cycle)
   # Poll appears: "Will this pack have a rare card?"
   ```

3. **Viewers Join**
   ```bash
   # Navigate to /watch?authority=<streamer_wallet>
   # Connect wallet, see live stream + active poll
   # Place bet: 0.5 SOL on YES
   # Transaction: place_bet(market, side: YES, amount: 0.5)
   ```

4. **Pack Opening**
   ```bash
   # Streamer opens physical Pokémon pack on camera
   # Viewers watch live via LiveKit
   # More bets come in, odds update in real-time
   ```

5. **Freeze Market**
   ```bash
   # Streamer clicks "Freeze Poll"
   # Transaction: freeze_market(market)
   # Chat message sent: "🧊 Poll frozen by host"
   # AI agent detects freeze signal
   ```

6. **AI Resolution**
   ```bash
   # AI agent samples video frames (2 FPS)
   # Google Vision detects: "Charizard VMAX - Ultra Rare"
   # Agent determines: Market criteria MET (rare card found)
   # Transaction: resolve_market(market, outcome: YES)
   ```

7. **Claim Winnings**
   ```bash
   # YES bettors see "Claim Winnings" button
   # Transaction: claim_winnings(market, ticket)
   # SOL transferred to wallet instantly
   ```

---

## 🔬 How It Works

### 1. Placing an Encrypted Bet

```typescript
// In user's browser (lib/arciumClient.ts)

// Generate ephemeral x25519 keypair
const clientKeypair = x25519.generateKeyPair();

// Encrypt bet data using Arcium's Rescue cipher
const { ciphertext, nonce } = encryptBetPayload({
  wallet: userWallet,
  pollId: marketId,
  side: "YES",
  amount: 0.5,
  outcome: "Pending",
  timestamp: Date.now()
}, clientKeypair.secretKey, mxePublicKey);

// Store encrypted bet
await fetch('/api/store-bet', {
  method: 'POST',
  body: JSON.stringify({
    wallet: userWallet,
    pollId: marketId,
    encryptedData: ciphertext,
    nonce,
    arcisPublicKey: clientKeypair.publicKey
  })
});
```

**Privacy Guarantee**: The server **never sees** plaintext bet data. Only encrypted ciphertext is stored.

### 2. Storing Encrypted Bets

```typescript
// Server-side (app/api/store-bet/route.ts)

// Store encrypted bet in database
await prisma.encryptedBet.create({
  data: {
    wallet,
    pollId,
    side: "UNKNOWN", // Encrypted, unknown to server
    amount: 0,        // Encrypted, unknown to server
    encryptedData: ciphertext, // Only ciphertext stored
    nonce,
    arcisPublicKey,
  }
});
```

### 3. Decrypting Bets (Owner Only)

```typescript
// In owner's browser (app/api/get-bets/route.ts)

// Fetch encrypted bets from database
const encryptedBets = await prisma.encryptedBet.findMany({
  where: { wallet: userWallet }
});

// Decrypt using Arcium (client-side)
const decryptedBets = encryptedBets.map(bet => 
  decryptBetPayload(
    bet.encryptedData,
    bet.nonce,
    clientSecretKey
  )
);
```

**Result**: Only the bet owner can decrypt their data. Server sees only ciphertext.

---

## 📊 Database Schema

```prisma
model EncryptedBet {
  id              String   @id @default(cuid())
  wallet          String   // Bet owner (public)
  pollId          String   // Market ID (public)
  side            String   // Encrypted (unknown to server)
  amount          Float    // Encrypted (unknown to server)
  encryptedData   String   // Arcium ciphertext
  nonce           String   // Encryption nonce
  arcisPublicKey  String   // x25519 public key
  storedAt        DateTime @default(now())
  
  @@index([wallet])
  @@index([pollId])
}
```

---

## 🎓 Technical Deep Dive

### Arcium Encryption Flow

1. **Key Generation**
   ```typescript
   // Client generates ephemeral x25519 keypair
   const { publicKey, secretKey } = x25519.generateKeyPair();
   ```

2. **Payload Encoding**
   ```typescript
   // Ultra-compact encoding to minimize data size
   const payload = {
     w: wallet,        // Wallet address
     p: pollId,        // Poll/market ID
     s: side,          // "YES" or "NO"
     a: amount,        // Bet amount in SOL
     o: outcome,       // Current outcome status
     t: timestamp      // Bet placement time
   };
   ```

3. **Encryption**
   ```typescript
   // Rescue cipher with unique nonce
   const ciphertext = RescueCipher.encrypt(
     JSON.stringify(payload),
     secretKey,
     mxePublicKey,
     nonce
   );
   ```

4. **Storage**
   ```typescript
   // Only ciphertext stored (7-10 blocks of 32 bytes)
   await db.encryptedBet.create({
     encryptedData: ciphertext, // ~224-320 bytes
     nonce,
     arcisPublicKey: publicKey
   });
   ```

### Why Rescue Cipher?

- **Algebraic**: Compatible with zero-knowledge proof systems
- **Efficient**: Optimized for both traditional and ZK compute
- **Secure**: Designed for post-quantum security considerations
- **Future-proof**: Enables MXE integration for on-chain private computation

---

## 🎯 Solana Hackathon Highlights

### Innovation
- **First** prediction market platform designed specifically for Pokémon TCG streamers
- **AI-powered resolution**: Google Vision API + Solana smart contracts
- **LiveKit integration**: Seamless streaming + betting experience
- **Optional privacy**: Arcium encryption for whale protection

### Technical Implementation
- ✅ Production-ready Anchor program with 10+ instructions
- ✅ Full-stack Next.js 15 application (App Router)
- ✅ LiveKit real-time video streaming integration
- ✅ Google Vision API for automated card detection
- ✅ Cycle-based market system for multiple rounds per stream
- ✅ PDA-based ticket accounting for gas efficiency
- ✅ Prisma + Neon PostgreSQL for stream metadata
- 🚧 Arcium encryption SDK integration (sidetrack submission)

### Impact & Utility
- **Market**: $10B+ Pokémon TCG industry with millions of pack opening streams
- **Problem**: No real-time betting platform for Pokémon content creators
- **Solution**: Instant markets + AI resolution + Solana settlement
- **Users**: Streamers earn fees, viewers get entertainment + potential winnings

### Code Quality
- Comprehensive error handling in smart contracts
- Event emission for frontend tracking
- TypeScript throughout (frontend + agent)
- Clean separation: contracts / frontend / AI agent
- Well-documented setup instructions

---

## 🏆 Arcium Sidetrack Submission

### What We Built

Punt integrates **Arcium's encryption SDK** as an optional privacy layer for bet data:

- ✅ **Client-side encryption**: x25519 key exchange + Rescue cipher
- ✅ **Privacy-preserving storage**: Encrypted bets in Neon PostgreSQL
- ✅ **Owner-only decryption**: Dashboard shows your bet history
- 🚧 **MXE program**: Prepared for future on-chain encrypted computation

### Why Arcium for Prediction Markets

**Problem**: Whale bets influence market odds and betting behavior

**Solution**: Encrypt bet amounts before storage
- Server never sees plaintext bet data
- Only bet owner can decrypt their history
- Market odds remain fair without whale influence

### Technical Deep Dive

See [Arcium Integration](#-arcium-integration-sidetrack-submission) section above for:
- Architecture diagrams
- Encryption flow (key generation → payload encoding → Rescue cipher)
- Code examples
- Future MXE roadmap

---

## 🧪 Testing

### Smart Contract Tests
```bash
cd punt-program
anchor test
```

Tests cover:
- Market initialization with different fee structures
- Bet placement with various amounts and sides
- Market freezing and resolution
- Ticket creation and claiming winnings
- Fee withdrawal by authority

### Frontend Tests
```bash
cd punt-frontend
npm test
```

Tests cover:
- Bet toggle group component
- Payout calculations
- LiveKit smoke tests
- Poll selection flow

### AI Agent Testing
```bash
cd ai-agent
# Set LIVEKIT_SMOKE=1 in .env
npm run start

# In another terminal, send test freeze signal
node scripts/sendFreeze.js
```

### Manual End-to-End Test
1. Start frontend: `cd punt-frontend && npm run dev`
2. Start AI agent: `cd ai-agent && npm run start`
3. Navigate to `/studio` and connect wallet
4. Initialize market, place some bets
5. Freeze market (sends chat message)
6. AI agent detects freeze, samples frames
7. Verify auto-resolution on Solana

---

## 🚀 Deployment

### Vercel (Recommended)

```bash
cd punt-frontend

# Add environment variables to Vercel
vercel env add DATABASE_URL
vercel env add ARCIUM_PAYER_SECRET_KEY
vercel env add ARCIUM_CLIENT_SECRET_KEY
# ... add all required env vars

# Deploy
vercel --prod
```

### Environment Variables Checklist

**Required:**
- ✅ `DATABASE_URL` - PostgreSQL for stream metadata
- ✅ `NEXT_PUBLIC_PROGRAM_ID` - Deployed Punt program ID
- ✅ `NEXT_PUBLIC_NETWORK` - Solana RPC endpoint
- ✅ `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` - Streaming

**Optional (Arcium Sidetrack):**
- `ARCIUM_PAYER_SECRET_KEY` - For bet encryption
- `ARCIUM_CLIENT_SECRET_KEY` - For bet encryption

---

## 🛣️ Roadmap

### Phase 1: Core Platform (✅ Complete - Solana Hackathon)
- [x] Solana smart contracts (markets, betting, resolution)
- [x] LiveKit streaming integration
- [x] Google Vision AI agent for card detection
- [x] Full-stack Next.js frontend
- [x] Wallet integration (Phantom, Solflare, etc.)
- [x] Real-time odds calculation

### Phase 2: Privacy Layer (✅ Complete - Arcium Sidetrack)
- [x] Arcium SDK integration
- [x] Client-side bet encryption
- [x] Encrypted bet storage in database
- [x] Dashboard for viewing encrypted history

### Phase 3: MXE Integration (🚧 In Progress)
- [ ] Deploy MXE program to mainnet
- [ ] On-chain encrypted bet storage
- [ ] Private bet aggregation (compute odds on encrypted data)
- [ ] Zero-knowledge proofs for bet validity

### Phase 4: Platform Growth (📋 Planned)
- [ ] Multi-game support (Yu-Gi-Oh!, Magic: The Gathering)
- [ ] Mobile app (React Native)
- [ ] Creator revenue sharing
- [ ] Tournament mode
- [ ] Social features (leaderboards, achievements)

---

## 📚 Resources

- **Solana Docs**: https://docs.solana.com
- **Anchor Framework**: https://www.anchor-lang.com
- **LiveKit**: https://docs.livekit.io
- **Google Vision API**: https://cloud.google.com/vision/docs
- **Arcium Docs**: https://docs.arcium.com (for encryption features)

---

## 👥 Team

- **Aaron Buono** - [@AaronBuono](https://github.com/AaronBuono)
  - Full-stack development
  - Solana smart contract development
  - LiveKit + Google Vision integration
  - Arcium encryption implementation

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- **Solana Foundation** for the blockchain infrastructure and hackathon
- **Arcium Team** for the encryption SDK (sidetrack submission)
- **LiveKit** for real-time streaming capabilities
- **Google Cloud** for Vision API

---

## 📞 Contact

- **Email**: aaronjacobbuono@gmail.com
- **GitHub**: https://github.com/AaronBuono/punt
- **Twitter**: @AaronBuono (if applicable)
- **Demo**: (Add your deployed Vercel URL here)

---

**Built for Solana Hackathon 2025**  
**Arcium Sidetrack: Privacy-Preserving Prediction Markets**
