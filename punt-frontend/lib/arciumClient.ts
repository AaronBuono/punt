import { AnchorProvider, IdlTypes } from "@coral-xyz/anchor";
import { Keypair, Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { randomBytes } from "crypto";
import {
  compressUint128,
  decompressUint128,
  getMXEPublicKey,
  RescueCipher,
  x25519,
} from "@arcium-hq/client";
import type { ArciumIdlType } from "@arcium-hq/client";

export type BetPayload = {
  wallet: string;
  pollId: string;
  betData: Record<string, unknown>;
  storedAt: string;
};

export type EncryptedBetEnvelope = {
  ciphertext: string[];
  nonce: string;
  arcisPublicKey: string;
};

type ArciumArgument = IdlTypes<ArciumIdlType>["argument"];

type ArciumConfig = {
  rpcUrl: string;
  mxeProgramId: PublicKey;
  payerSecret: Uint8Array;
  clientSecret: Uint8Array;
  storeComputation?: string;
};

let cachedProvider: AnchorProvider | null = null;
let cachedConfig: ArciumConfig | null = null;
let cachedMxePublicKey: Uint8Array | null = null;

class KeypairWallet {
  constructor(private readonly keypair: Keypair) {}

  get publicKey() {
    return this.keypair.publicKey;
  }

  async signTransaction<T extends { partialSign: (...keys: Keypair[]) => void }>(tx: T) {
    tx.partialSign(this.keypair);
    return tx;
  }

  async signAllTransactions<T extends { partialSign: (...keys: Keypair[]) => void }>(txs: T[]) {
    txs.forEach(tx => tx.partialSign(this.keypair));
    return txs;
  }
}

function decodeSecretKey(raw: string | undefined): Uint8Array {
  if (!raw) {
    throw new Error("Missing Arcium secret key env var");
  }
  try {
    return bs58.decode(raw);
  } catch {
    try {
      return Buffer.from(raw, "base64");
    } catch {
      throw new Error("Failed to decode Arcium secret key; expected base58 or base64");
    }
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

function getConfig(): ArciumConfig {
  if (cachedConfig) {
    return cachedConfig;
  }
  if (typeof window !== "undefined") {
    throw new Error("Arcium configuration is only available on the server");
  }
  const rpcUrl = process.env.ARCIUM_SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_NETWORK;
  if (!rpcUrl) {
    throw new Error("ARCIUM_SOLANA_RPC_URL or NEXT_PUBLIC_NETWORK must be configured");
  }
  const mxeProgramId = new PublicKey(requireEnv("ARCIUM_MXE_PROGRAM_ID"));
  const payerSecret = decodeSecretKey(process.env.ARCIUM_PAYER_SECRET_KEY);
  const clientSecret = decodeSecretKey(process.env.ARCIUM_CLIENT_SECRET_KEY);
  cachedConfig = {
    rpcUrl,
    mxeProgramId,
    payerSecret,
    clientSecret,
    storeComputation: process.env.ARCIUM_STORE_COMP_NAME,
  };
  return cachedConfig;
}

export async function getProvider(): Promise<AnchorProvider> {
  if (cachedProvider) {
    return cachedProvider;
  }
  const config = getConfig();
  const payer = Keypair.fromSecretKey(config.payerSecret);
  const connection = new Connection(config.rpcUrl, { commitment: "confirmed" });
  cachedProvider = new AnchorProvider(connection, new KeypairWallet(payer) as unknown as AnchorProvider["wallet"], {
    commitment: "confirmed",
  });
  return cachedProvider;
}

export async function fetchMxePublicKey(): Promise<Uint8Array> {
  if (cachedMxePublicKey) {
    return cachedMxePublicKey;
  }
  const provider = await getProvider();
  const config = getConfig();
  
  // Retry logic for MXE public key (may not be set immediately after deployment)
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      const key = await getMXEPublicKey(provider, config.mxeProgramId);
      if (key) {
        cachedMxePublicKey = key;
        return key;
      }
    } catch (error) {
      console.log(`Attempt ${attempt} to fetch MXE public key failed:`, error);
    }
    
    if (attempt < 10) {
      console.log(`Retrying in 500ms... (attempt ${attempt}/10)`);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  throw new Error("MXE public key is not yet finalized. The MXE may still be initializing.");
}

function padToBlock(bytes: Uint8Array): Uint8Array {
  const extra = bytes.length % 16 === 0 ? 0 : 16 - (bytes.length % 16);
  if (extra === 0) {
    return bytes;
  }
  const padded = new Uint8Array(bytes.length + extra);
  padded.set(bytes);
  return padded;
}

function trimZeros(bytes: Uint8Array): Uint8Array {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) {
    end -= 1;
  }
  return bytes.slice(0, end);
}

export async function encryptBetPayload(payload: BetPayload): Promise<EncryptedBetEnvelope> {
  const config = getConfig();
  const mxePublicKey = await fetchMxePublicKey();
  const sharedSecret = x25519.getSharedSecret(config.clientSecret, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);
  
  // Ultra-compact representation to fit in transaction size limits
  // Store only essential fields with minimal keys
  const betData = payload.betData as Record<string, unknown>;
  const compactPayload = {
    w: payload.wallet.substring(0, 8), // First 8 chars of wallet (just for reference, full wallet in account)
    p: payload.pollId.substring(0, 20), // Truncated poll ID
    s: betData.side as number, // 0 or 1
    a: betData.amount as number, // number
    o: (betData.outcome as string | undefined)?.substring(0, 1) || 'P', // P=Pending, W=Win, L=Loss
    t: payload.storedAt,
  };
  
  const plaintext = Buffer.from(JSON.stringify(compactPayload), "utf8");
  
  // Check size before encryption (max 18 blocks * 16 bytes = 288 bytes)
  const maxPlaintextSize = 18 * 16;
  if (plaintext.length > maxPlaintextSize) {
    console.error(`Payload too large: ${plaintext.length} bytes (max ${maxPlaintextSize})`);
    throw new Error(`Bet payload too large: ${plaintext.length} bytes (max ${maxPlaintextSize})`);
  }
  
  const padded = padToBlock(plaintext);
  const plaintextWords = compressUint128(padded);
  const nonce = randomBytes(16);
  const ciphertext = cipher.encrypt(plaintextWords, nonce);
  
  console.log(`📏 Encryption: ${plaintext.length} bytes plaintext -> ${ciphertext.length} ciphertext blocks`);
  
  return {
    ciphertext: ciphertext.map((block) => Buffer.from(block).toString("base64")),
    nonce: Buffer.from(nonce).toString("hex"),
    arcisPublicKey: Buffer.from(x25519.getPublicKey(config.clientSecret)).toString("base64"),
  };
}

export async function decryptBetPayload(envelope: EncryptedBetEnvelope): Promise<BetPayload> {
  const config = getConfig();
  const mxePublicKey = await fetchMxePublicKey();
  const sharedSecret = x25519.getSharedSecret(config.clientSecret, mxePublicKey);
  const cipher = new RescueCipher(sharedSecret);
  const ciphertext = envelope.ciphertext.map(chunk => Array.from(Buffer.from(chunk, "base64")));
  const nonce = Buffer.from(envelope.nonce, "hex");
  const plaintextWords = cipher.decrypt(ciphertext, nonce);
  const raw = decompressUint128(plaintextWords);
  const trimmed = trimZeros(raw);
  const decoded = Buffer.from(trimmed).toString("utf8");
  
  // Handle both compact and full format
  const parsed = JSON.parse(decoded);
  
  // Compact format (new) - expand it
  if (parsed.w !== undefined && parsed.s !== undefined) {
    const outcomeMap: Record<string, string> = { P: 'Pending', W: 'Win', L: 'Loss' };
    return {
      wallet: parsed.w, // Partial wallet (full wallet is in account data)
      pollId: parsed.p,
      betData: {
        side: parsed.s,
        amount: parsed.a,
        outcome: outcomeMap[parsed.o] || 'Pending',
      },
      storedAt: parsed.t,
    };
  }
  
  // Full format (backward compatibility)
  return parsed as BetPayload;
}

export function getClientPublicKeyBase64(): string {
  const config = getConfig();
  return Buffer.from(x25519.getPublicKey(config.clientSecret)).toString("base64");
}

export function buildEncryptedArguments(ciphertext: EncryptedBetEnvelope): ArciumArgument[] {
  const nonceBigInt = BigInt(`0x${ciphertext.nonce}`);
  return [
    {
      arcisPubkey: Array.from(Buffer.from(ciphertext.arcisPublicKey, "base64")),
    },
    ...ciphertext.ciphertext.map(block => ({
      encryptedU128: Array.from(Buffer.from(block, "base64")),
    })),
    {
      plaintextU128: nonceBigInt,
    },
  ];
}

export function getArciumConfig() {
  const config = getConfig();
  return {
    rpcUrl: config.rpcUrl,
    mxeProgramId: config.mxeProgramId.toBase58(),
    storeComputation: config.storeComputation ?? "",
    arcisClientPublicKey: getClientPublicKeyBase64(),
  };
}
