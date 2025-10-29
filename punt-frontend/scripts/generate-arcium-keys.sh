#!/bin/bash

# Script to generate Arcium MXE keypairs for server-side operations
# Payer: Solana keypair (64 bytes) for paying transactions
# Client: x25519 keypair (32 bytes) for encryption

echo "🔑 Generating Arcium MXE Keypairs..."
echo ""

# Create a temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Generate payer keypair (Solana keypair - 64 bytes)
echo "1️⃣  Generating payer keypair (Solana)..."
solana-keygen new --no-bip39-passphrase --outfile payer.json --silent
PAYER_BASE58=$(cat payer.json | python3 -c "import sys, json, base58; data = json.load(sys.stdin); print(base58.b58encode(bytes(data)).decode())")
PAYER_PUBKEY=$(solana-keygen pubkey payer.json)

echo "✅ Payer public key: $PAYER_PUBKEY"
echo ""

# Generate client x25519 keypair (32 bytes for encryption)
echo "2️⃣  Generating client x25519 keypair..."
CLIENT_BASE58=$(python3 -c "import os, base58; key = os.urandom(32); print(base58.b58encode(key).decode())")

echo "✅ Client x25519 key generated (32 bytes)"
echo ""

# Display results
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Add these to your .env file:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "ARCIUM_PAYER_SECRET_KEY=$PAYER_BASE58"
echo "ARCIUM_CLIENT_SECRET_KEY=$CLIENT_BASE58"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️  Important: Keep these secret keys safe and never commit them to git!"
echo ""
echo "💰 Fund the payer account with devnet SOL:"
echo "   solana airdrop 2 $PAYER_PUBKEY --url devnet"
echo ""

# Cleanup
cd -
rm -rf "$TEMP_DIR"

echo "✅ Done!"
