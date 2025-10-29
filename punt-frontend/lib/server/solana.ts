import { Connection, PublicKey, clusterApiUrl, type Commitment } from "@solana/web3.js";

let sharedConnection: Connection | null = null;

function resolveEndpoint(): string {
  const direct = process.env.SOLANA_RPC_URL?.trim();
  if (direct) return direct;
  const envList = process.env.NEXT_PUBLIC_SOLANA_ENDPOINTS?.split(",").map(v => v.trim()).filter(Boolean);
  if (envList && envList.length) return envList[0];
  const network = process.env.NEXT_PUBLIC_NETWORK?.trim();
  if (network) {
    try {
      return clusterApiUrl(network as Parameters<typeof clusterApiUrl>[0]);
    } catch {
      /* fall through */
    }
  }
  return clusterApiUrl("devnet");
}

export function getServerConnection(): Connection {
  if (sharedConnection) return sharedConnection;
  sharedConnection = new Connection(resolveEndpoint(), { commitment: "confirmed" });
  return sharedConnection;
}

export interface VerifyAuthorityOptions {
  expectedLog?: string | string[];
  commitment?: Commitment;
  maxWaitMs?: number;
}

function normalizeLogs(logs?: readonly string[]) {
  return Array.isArray(logs) ? logs : [];
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function verifyAuthorityTransaction(signature: string, authority: string, opts: VerifyAuthorityOptions = {}): Promise<boolean> {
  if (!signature) return false;
  let authorityKey: PublicKey;
  try {
    authorityKey = new PublicKey(authority);
  } catch {
    return false;
  }

  const connection = getServerConnection();
  const maxWaitMs = Math.max(500, opts.maxWaitMs ?? 5_000);
  const started = Date.now();

  while (Date.now() - started <= maxWaitMs) {
    try {
  const requested = opts.commitment ?? "confirmed";
  const commitment = requested === "finalized" ? "finalized" : "confirmed";
      const tx = await connection.getTransaction(signature, {
        commitment,
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) {
        await delay(400);
        continue;
      }
      if (tx.meta?.err) return false;
      const message = tx.transaction.message as unknown;
      let signerKeys: PublicKey[] = [];
      if (message && typeof message === "object" && "header" in message && message.header && typeof message.header === "object") {
        const header = (message as { header: { numRequiredSignatures: number } }).header;
        const required = header?.numRequiredSignatures ?? 0;
        if ("getAccountKeys" in message && typeof (message as { getAccountKeys: () => { staticAccountKeys: PublicKey[] } }).getAccountKeys === "function") {
          const accountKeys = (message as { getAccountKeys: () => { staticAccountKeys: PublicKey[] } }).getAccountKeys();
          signerKeys = accountKeys.staticAccountKeys.slice(0, required);
        } else if ("accountKeys" in message && Array.isArray((message as { accountKeys: PublicKey[] }).accountKeys)) {
          signerKeys = (message as { accountKeys: PublicKey[] }).accountKeys.slice(0, required);
        }
      }
      if (!signerKeys.some(key => key.equals(authorityKey))) {
        return false;
      }
  const logs = normalizeLogs(tx.meta?.logMessages ?? undefined);
      if (opts.expectedLog) {
        const expectations = Array.isArray(opts.expectedLog) ? opts.expectedLog : [opts.expectedLog];
        const lowered = logs.map(log => log.toLowerCase());
        const satisfied = expectations.some(expect => lowered.some(log => log.includes(expect.toLowerCase())));
        if (!satisfied) return false;
      }
      return true;
    } catch {
      await delay(500);
    }
  }
  return false;
}
