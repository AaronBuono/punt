#!/bin/bash

set -e

echo "🚀 Deploying Punt MXE to Devnet..."

# Configuration
CLUSTER_OFFSET=1078779259  # Public testnet cluster
KEYPAIR_PATH="$HOME/.config/solana/id.json"
RPC_URL="https://api.devnet.solana.com"

# Check if running on devnet
echo "📡 Setting Solana CLI to devnet..."
solana config set --url "$RPC_URL"

# Check balance
echo "💰 Checking wallet balance..."
BALANCE=$(solana balance --url "$RPC_URL")
echo "Balance: $BALANCE"

if [[ "$BALANCE" == "0 SOL" ]]; then
  echo "❌ Insufficient balance. Run: solana airdrop 2 --url devnet"
  exit 1
fi

# Build the program
echo "🔨 Building MXE program..."
cd "$(dirname "$0")"
arcium build

# Deploy with cluster configuration
echo "🌐 Deploying to devnet with cluster offset $CLUSTER_OFFSET..."
arcium deploy \
  --cluster-offset "$CLUSTER_OFFSET" \
  --keypair-path "$KEYPAIR_PATH" \
  --rpc-url "$RPC_URL"

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Update punt-frontend/.env with the new ARCIUM_MXE_PROGRAM_ID"
echo "2. Run: cd ../punt-frontend && npm run dev"
echo "3. Test the dashboard at http://localhost:3000/dashboard"
