# Punt Arcium MXE Integration

This document explains how the Arcium Multi-party eXecution Environment (MXE) is integrated into Punt for secure, encrypted bet storage.

## 🏗️ Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  API Routes      │────▶│  Arcium MXE     │
│   Dashboard     │     │  /api/store-bet  │     │  Solana Program │
│                 │◀────│  /api/get-bets   │◀────│  (On-chain)     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

## 📁 Project Structure

### MXE Contract (`/punt/punt_mxe/`)
```
punt_mxe/
├── programs/punt_mxe/src/
│   └── lib.rs                    # Main MXE program
├── encrypted-ixs/src/
│   └── lib.rs                    # Encrypted instruction circuit
├── tests/
│   └── punt_mxe.ts              # Integration tests
└── target/
    ├── idl/punt_mxe.json        # Generated IDL
    └── types/punt_mxe.ts        # TypeScript types
```

### Frontend Integration (`/punt/punt-frontend/`)
```
punt-frontend/
├── lib/
│   └── arciumClient.ts          # Arcium SDK wrapper
├── app/
│   ├── api/
│   │   ├── store-bet/route.ts   # Encrypt & store bets
│   │   └── get-bets/route.ts    # Retrieve & decrypt bets
│   └── dashboard/
│       └── page.tsx             # Dashboard UI
├── idl/
│   ├── punt_mxe.json           # Copied from MXE project
│   └── punt_mxe.ts             # TypeScript types
└── components/
    └── Header.tsx               # Updated nav with Dashboard link
```

## 🚀 Setup Instructions

### 1. MXE Program Deployment

The MXE program is already deployed on **Solana Devnet**:
- **Program ID**: `AeDEKEm6btYZenwJECNUULgdTr4fuFQRgsVJBn2rYFsn`
- **Network**: https://api.devnet.solana.com

To redeploy or update:

```bash
cd /path/to/punt/punt_mxe

# Build the program
arcium build

# Deploy to devnet
arcium deploy \
  --cluster-offset 0 \
  --keypair-path ~/.config/solana/id.json \
  --rpc-url devnet \
  --mempool-size Small
```

### 2. Frontend Configuration

#### Generate Server-Side Keypairs

Run the key generation script:

```bash
cd /path/to/punt/punt-frontend
./scripts/generate-arcium-keys.sh
```

This will output two base58-encoded secret keys. Add them to your `.env`:

```env
ARCIUM_PAYER_SECRET_KEY=<generated_payer_key>
ARCIUM_CLIENT_SECRET_KEY=<generated_client_key>
```

#### Fund the Payer Account

The payer account needs SOL to pay for transactions:

```bash
# Replace with your payer public key from the script output
solana airdrop 2 <PAYER_PUBKEY> --url devnet
```

#### Install Dependencies

```bash
npm install @arcium-hq/client @coral-xyz/anchor @solana/web3.js
```

### 3. Initialize the MXE (One-time)

Before storing bets, initialize the computation definition:

```bash
cd /path/to/punt/punt_mxe
yarn test  # This will run init_store_bet_comp_def
```

Or call it programmatically from the frontend once.

## 🎯 How It Works

### Storing a Bet

```typescript
// Client calls API
const response = await fetch('/api/store-bet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    wallet: publicKey.toBase58(),
    pollId: 'poll-123',
    betData: {
      prediction: 'Charizard',
      amount: 0.5,
      outcome: 'Pending',
    },
  }),
});
```

**Flow:**
1. Frontend sends bet data to `/api/store-bet`
2. Server encrypts data using Arcium SDK (`encryptBetPayload`)
3. Server calls `store_bet` instruction on MXE program
4. MXE program:
   - Stores encrypted bet in `BetComputationMeta` account
   - Queues encrypted computation
   - Emits `BetQueuedEvent`
5. Arcium network processes computation
6. Callback emits `BetStoredEvent` with metadata

### Retrieving Bets

```typescript
// Client calls API
const response = await fetch(`/api/get-bets?wallet=${publicKey.toBase58()}`);
const { bets } = await response.json();
```

**Flow:**
1. Frontend requests bets from `/api/get-bets`
2. Server queries on-chain `BetComputationMeta` accounts filtered by wallet
3. Server decrypts ciphertext using Arcium SDK (`decryptBetPayload`)
4. Server returns decrypted bet data as JSON
5. Frontend displays in dashboard table

## 🔐 Security Model

### Encryption
- **Algorithm**: Rescue cipher (Arcium's MPC-friendly encryption)
- **Key Management**: x25519 key exchange with MXE public key
- **Data**: Bets are encrypted client-side before submission

### On-Chain Storage
- **Ciphertext**: Stored in `BetComputationMeta` PDA account
- **Metadata**: Wallet, poll ID, computation offset (public)
- **Decryption**: Only possible with client secret key + MXE cooperation

### Access Control
- Each bet is tied to a wallet address
- Only the wallet owner's secret key can decrypt their bets
- Server-side keys should be kept secure and never exposed to clients

## 📊 Data Schema

### BetPayload (Decrypted)
```typescript
{
  wallet: string;          // Solana wallet address
  pollId: string;          // Unique poll identifier
  betData: {               // Flexible bet data
    prediction: string;
    amount: number;
    outcome: string;
  };
  storedAt: string;       // ISO timestamp
}
```

### BetComputationMeta (On-Chain)
```rust
pub struct BetComputationMeta {
    pub bettor_wallet: Pubkey,          // 32 bytes
    pub poll_id: [u8; 32],              // 32 bytes
    pub computation_offset: u64,        // 8 bytes
    pub arcis_public_key: [u8; 32],     // 32 bytes
    pub nonce: [u8; 16],                // 16 bytes
    pub ciphertext: Vec<[u8; 32]>,      // Variable (max 19 blocks)
    pub bump: u8,                       // 1 byte
}
```

## 🧪 Testing

### Unit Tests
```bash
cd /path/to/punt/punt_mxe
yarn test
```

### Frontend Testing
```bash
cd /path/to/punt/punt-frontend
npm run dev
```

1. Navigate to http://localhost:3000/dashboard
2. Connect your Solana wallet (devnet)
3. Test storing and retrieving bets

## 🐛 Troubleshooting

### "MXE public key is not yet finalized"
Run the Arcium keygen workflow to finalize the MXE public key.

### "Failed to fetch bets"
- Ensure `ARCIUM_PAYER_SECRET_KEY` and `ARCIUM_CLIENT_SECRET_KEY` are set
- Verify the payer account has SOL for transactions
- Check the MXE program is deployed on the correct network

### Stack overflow during build
The Arcium SDK has known stack warnings in dependencies. These don't affect deployment as long as the build completes successfully.

## 📚 Resources

- [Arcium Documentation](https://docs.arcium.com/)
- [Arcium SDK (@arcium-hq/client)](https://www.npmjs.com/package/@arcium-hq/client)
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/)
- [Anchor Framework](https://www.anchor-lang.com/)

## 🎨 Dashboard Features

- ✅ Wallet connection
- ✅ Encrypted bet history display
- ✅ Real-time bet retrieval
- ✅ Responsive table layout
- ✅ Date/time formatting
- ✅ Bet outcome badges (Win/Loss/Pending)
- ✅ Empty state handling
- ✅ Loading and error states

## 🔜 Future Enhancements

- [ ] Pagination for large bet histories
- [ ] Bet filtering by poll or date range
- [ ] Export bet history to CSV
- [ ] Real-time bet updates via WebSocket
- [ ] Bet analytics and statistics
- [ ] Multi-sig support for shared wallets
