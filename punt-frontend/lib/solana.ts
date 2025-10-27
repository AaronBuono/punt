import { Connection, PublicKey, SystemProgram, Transaction, clusterApiUrl, ComputeBudgetProgram, SendTransactionError } from "@solana/web3.js";
import bs58 from "bs58";
import { Program, AnchorProvider, BN, type Provider, type Wallet as AnchorWallet } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { PUNT_PROGRAM_IDL, PUNT_PROGRAM_ID } from "@/idl/punt_program";

// Host (platform) wallet used on-chain for fee split
export const HOST_PUBKEY = new PublicKey("9KQjnCXwNcnaojsfvuD894UjnCKvgwEDe4Kt1nfpDNHB");

// -------------------------------------------------------------------------------------------------
// Resilient RPC Connection (handles 403 / rate-limit by rotating endpoints)
// -------------------------------------------------------------------------------------------------
// Configure multiple endpoints via env (comma separated). Example:
// NEXT_PUBLIC_SOLANA_ENDPOINTS="https://api.devnet.solana.com,https://devnet.helius-rpc.com/?api-key=YOUR_KEY"
// Fallback defaults included if none provided.

const userEndpoints = (process.env.NEXT_PUBLIC_SOLANA_ENDPOINTS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

const primaryEnv = process.env.NEXT_PUBLIC_NETWORK?.trim();

const DEFAULT_ENDPOINTS = [
  primaryEnv || "",
  clusterApiUrl("devnet"),
  "https://api.devnet.solana.com", // explicit duplicate of cluster for clarity
  // Add more community / public endpoints if desired (kept minimal to avoid accidental ToS issues)
].filter((v, i, a) => v && a.indexOf(v) === i);

const RPC_ENDPOINTS = [...userEndpoints, ...DEFAULT_ENDPOINTS];
if (!RPC_ENDPOINTS.length) {
  RPC_ENDPOINTS.push(clusterApiUrl("devnet"));
}

let _rpcIndex = 0;
let _connection: Connection = new Connection(RPC_ENDPOINTS[_rpcIndex], { commitment: "confirmed" });
let _lastHealthCheck = 0;
const HEALTH_INTERVAL_MS = 15_000; // throttle health checks
const LAGGING_SLOT_THRESHOLD = 500; // if endpoint is this many slots behind best candidate, treat as unhealthy
const NODE_BEHIND_COOLDOWN_MS = 60_000; // don't immediately reuse a lagging endpoint

type ConnectionWithEndpoint = Connection & { rpcEndpoint?: string };

const getRpcEndpoint = (conn: Connection | null | undefined): string | undefined => {
  if (!conn) return undefined;
  return (conn as ConnectionWithEndpoint).rpcEndpoint;
};

interface EndpointMeta {
  endpoint: string;
  lastSlot: number;
  lastLatencyMs: number;
  lastChecked: number;
  laggingUntil?: number; // timestamp until which we avoid this endpoint
}

const endpointStats: Record<string, EndpointMeta> = Object.fromEntries(RPC_ENDPOINTS.map(e => [e, { endpoint: e, lastSlot: 0, lastLatencyMs: 0, lastChecked: 0 }]));

async function probeEndpoint(endpoint: string, timeoutMs = 3_000): Promise<EndpointMeta | null> {
  const started = performance.now?.() ?? Date.now();
  const conn = new Connection(endpoint, { commitment: 'processed' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const slotPromise = conn.getSlot();
    const raced = await Promise.race([
      slotPromise,
      new Promise<number>((_, reject) => {
        timer = setTimeout(() => reject(new Error('probe-timeout')), timeoutMs);
      })
    ]);
    const slot = raced as number;
    const latency = (performance.now?.() ?? Date.now()) - started;
    const meta: EndpointMeta = endpointStats[endpoint] || { endpoint, lastSlot: 0, lastLatencyMs: 0, lastChecked: 0 };
    meta.lastSlot = slot;
    meta.lastLatencyMs = latency;
    meta.lastChecked = Date.now();
    endpointStats[endpoint] = meta;
    return meta;
  } catch {
    const meta: EndpointMeta = endpointStats[endpoint] || { endpoint, lastSlot: 0, lastLatencyMs: 0, lastChecked: 0 };
    meta.lastChecked = Date.now();
    endpointStats[endpoint] = meta;
    return null;
  } finally { if (timer) clearTimeout(timer); }
}

async function selectBestEndpoint(): Promise<string | null> {
  // Probe all (in parallel) but skip those in lagging cooldown window unless no alternatives
  const usable = RPC_ENDPOINTS.filter(e => {
    const meta = endpointStats[e];
    if (!meta?.laggingUntil) return true;
    return meta.laggingUntil < Date.now();
  });
  const toProbe = usable.length ? usable : RPC_ENDPOINTS;
  const results = await Promise.allSettled(toProbe.map(e => probeEndpoint(e)));
  const metas = results.reduce<EndpointMeta[]>((acc, result) => {
    if (result.status === 'fulfilled' && result.value) {
      acc.push(result.value);
    }
    return acc;
  }, []);
  if (!metas.length) return null;
  // Choose highest slot; tie-breaker lower latency
  metas.sort((a, b) => {
    if (b.lastSlot !== a.lastSlot) return b.lastSlot - a.lastSlot;
    return a.lastLatencyMs - b.lastLatencyMs;
  });
  const best = metas[0];
  return best.endpoint;
}

function rotateEndpoint(reason?: string) {
  _rpcIndex = (_rpcIndex + 1) % RPC_ENDPOINTS.length;
  _connection = new Connection(RPC_ENDPOINTS[_rpcIndex], { commitment: "confirmed" });
  // Invalidate cached program so new provider is generated with the new connection
  _program = null; _programWallet = null;
  if (typeof window !== 'undefined') {
    console.warn("[solana] Rotated RPC endpoint", { endpoint: RPC_ENDPOINTS[_rpcIndex], reason });
  }
}

async function promoteBestEndpoint(reason: string) {
  try {
    const best = await selectBestEndpoint();
    const currentEndpoint = getRpcEndpoint(_connection);
    if (best && best !== currentEndpoint) {
      _connection = new Connection(best, { commitment: 'confirmed' });
      _program = null; _programWallet = null;
      if (typeof window !== 'undefined') console.warn('[solana] Promoted best endpoint', { best, reason });
    }
  } catch {
    // fallback to simple rotation if selection fails
    rotateEndpoint(reason + ':fallback-rotate');
  }
}

// -------------------------------------------------------------------------------------------------
// Debug / Diagnostics Helpers
// -------------------------------------------------------------------------------------------------
export interface RpcEndpointStatus { endpoint: string; lastSlot: number; lastLatencyMs: number; lastChecked: number; laggingUntil?: number; current?: boolean; slotDeltaFromBest: number; }

export async function debugRpcStatus(forceProbe = true): Promise<RpcEndpointStatus[]> {
  if (forceProbe) {
    await Promise.allSettled(RPC_ENDPOINTS.map(e => probeEndpoint(e)));
  }
  const bestSlot = Math.max(0, ...RPC_ENDPOINTS.map(e => endpointStats[e]?.lastSlot || 0));
  return RPC_ENDPOINTS.map(e => {
    const meta = endpointStats[e];
    return {
      endpoint: e,
      lastSlot: meta?.lastSlot || 0,
      lastLatencyMs: meta?.lastLatencyMs || 0,
      lastChecked: meta?.lastChecked || 0,
      laggingUntil: meta?.laggingUntil,
      current: getRpcEndpoint(_connection) === e,
      slotDeltaFromBest: bestSlot - (meta?.lastSlot || 0),
    } as RpcEndpointStatus;
  }).sort((a,b)=> a.slotDeltaFromBest - b.slotDeltaFromBest);
}

async function ensureHealthyConnection(force = false) {
  const now = Date.now();
  if (!force && now - _lastHealthCheck < HEALTH_INTERVAL_MS) return _connection;
  _lastHealthCheck = now;
  // Proactively probe all endpoints on first pass (cold start) to avoid landing on a lagging public node
  if (Object.values(endpointStats).every(m => m.lastChecked === 0)) {
    try {
      await selectBestEndpoint().then(async best => {
        if (best) {
          _connection = new Connection(best, { commitment: 'confirmed' });
          _program = null; _programWallet = null;
          if (typeof window !== 'undefined') console.warn('[solana] Initial best endpoint selected', best);
        }
      });
    } catch {/* ignore */}
  } else {
    // If current endpoint lags far behind a probed alternative, promote best
    const currentEndpoint = getRpcEndpoint(_connection);
    const currentMeta = currentEndpoint ? endpointStats[currentEndpoint] : undefined;
    const best = Object.values(endpointStats).reduce<EndpointMeta | undefined>((acc, candidate) => {
      if (!acc || candidate.lastSlot > acc.lastSlot) return candidate;
      return acc;
    }, currentMeta);
    if (best && currentMeta && best.lastSlot - currentMeta.lastSlot > LAGGING_SLOT_THRESHOLD) {
      await promoteBestEndpoint('proactive-lag-detected');
    }
  }
  try {
    await _connection.getLatestBlockhash({ commitment: 'processed' });
    return _connection;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/403|503|forbidden|service unavailable|rate/i.test(msg)) {
      rotateEndpoint('http-error');
      // Retry once with new endpoint
      try { await _connection.getLatestBlockhash({ commitment: 'processed' }); return _connection; } catch { /* fall through */ }
    }
    // Explicitly detect a lagging node (common on some public devnet RPCs)
    if (/node is behind/i.test(msg) || /slot/i.test(msg) && /behind/i.test(msg)) {
      // Mark current endpoint as lagging to avoid immediate reuse
      const currentEndpoint = getRpcEndpoint(_connection);
      if (currentEndpoint) {
        const meta = endpointStats[currentEndpoint];
        if (meta) meta.laggingUntil = Date.now() + NODE_BEHIND_COOLDOWN_MS;
      }
      await promoteBestEndpoint('node-behind');
      try { await _connection.getLatestBlockhash({ commitment: 'processed' }); return _connection; } catch { /* ignore, best-effort */ }
    }
    // Generic failure: rotate and return new connection (best effort)
    rotateEndpoint('generic-failure');
    return _connection;
  }
}

export async function getConnection() { return ensureHealthyConnection(); }
// Backwards compatibility named export (will be a dynamic proxy to current connection)
export const connection: Connection = ((): Connection => {
  return (_connection as unknown) as Connection; // direct reference; rotated in-place
})();

export const PROGRAM_ID = new PublicKey(PUNT_PROGRAM_ID);

// Wallet Adapter types (minimal) so we don't import heavy types all over.
export interface WalletLike {
  publicKey: PublicKey | null;
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
}

// Construct Anchor provider on-demand (avoid SSR issues).
export function getProvider(wallet: WalletLike | null): Provider {
  if (!wallet || !wallet.publicKey) throw new Error("Wallet not connected");
  if (!wallet.signTransaction) throw new Error("Wallet missing signTransaction support");
  // Some Anchor versions expect a NodeWallet shape with a payer Keypair. Provide a stub payer (not used for signing when using web wallet).
  const dummyPayer = Keypair.generate();
  const anchorWallet: AnchorWallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions || (async (txs: Transaction[]) => Promise.all(txs.map(tx => wallet.signTransaction!(tx)))),
    payer: dummyPayer,
  } as AnchorWallet;
  return new AnchorProvider(_connection, anchorWallet, { commitment: "confirmed" });
}

let _program: Program | null = null;
let _programWallet: string | null = null; // track which wallet the cached Program was created with
let _readonlyProgram: Program | null = null;
let _readonlyProvider: AnchorProvider | null = null;

function getReadonlyProvider(): AnchorProvider {
  if (_readonlyProvider) return _readonlyProvider;
  // Dummy wallet (never signs transactions) for Anchor account fetches
  const dummy = Keypair.generate();
  const rw: AnchorWallet = {
    publicKey: dummy.publicKey,
    signTransaction: async (tx: Transaction) => tx,
    signAllTransactions: async (txs: Transaction[]) => txs,
    payer: dummy,
  } as AnchorWallet;
  _readonlyProvider = new AnchorProvider(_connection, rw, { commitment: 'confirmed' });
  return _readonlyProvider;
}

export async function getReadonlyProgram() {
  // Rebuild if connection rotated
  if (_readonlyProgram) {
    const provider = _readonlyProgram.provider as AnchorProvider | undefined;
    const providerConn = provider?.connection;
    if (providerConn && getRpcEndpoint(providerConn) !== getRpcEndpoint(_connection)) {
      _readonlyProgram = null; _readonlyProvider = null;
    }
  }
  if (_readonlyProgram) return _readonlyProgram;
  const provider = getReadonlyProvider();
  const idl = PUNT_PROGRAM_IDL as unknown as { address?: string; name: string; instructions: unknown[]; accounts?: unknown[] };
  if (idl.address && idl.address === PROGRAM_ID.toBase58()) {
    _readonlyProgram = new Program(idl, provider) as Program;
    return _readonlyProgram;
  }
  const fetched = await Program.fetchIdl(PROGRAM_ID, provider);
  if (!fetched) throw new Error('Failed to fetch IDL for program (readonly)');
  _readonlyProgram = new Program(fetched as unknown as Record<string, unknown>, provider) as Program;
  return _readonlyProgram;
}
export async function getProgram(wallet: WalletLike | null) {
  if (!wallet || !wallet.publicKey) throw new Error("Wallet not connected");
  const current = wallet.publicKey.toBase58();
  if (_program && _programWallet === current) {
    const provider = _program.provider as AnchorProvider | undefined;
    const providerConn = provider?.connection;
    if (providerConn && getRpcEndpoint(providerConn) !== getRpcEndpoint(_connection)) {
      // Endpoint changed underneath; rebuild
      _program = null; _programWallet = null;
    }
  }
  if (_program && _programWallet === current) return _program;
  const provider = getProvider(wallet);
  const idl = PUNT_PROGRAM_IDL as unknown as { address?: string; name: string; instructions: unknown[]; accounts?: unknown[] };
  if (idl.address && idl.address === PROGRAM_ID.toBase58()) {
    _program = new Program(idl, provider as AnchorProvider) as Program;
    _programWallet = current;
    return _program;
  }
  const fetched = await Program.fetchIdl(PROGRAM_ID, provider as AnchorProvider);
  if (!fetched) throw new Error("Failed to fetch IDL for program");
  _program = new Program(fetched as unknown as Record<string, unknown>, provider as AnchorProvider) as Program;
  _programWallet = current;
  return _program;
}

// Utility to force a rebuild (e.g., after manual wallet switch events if needed)
export function resetProgramCache() {
  _program = null;
  _programWallet = null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function hydrateTransactionError(error: unknown): Promise<void> {
  if (!isObject(error)) return;
  const existingLogs = error['logs'];
  if (Array.isArray(existingLogs) && existingLogs.every(line => typeof line === 'string')) return;
  const getterCandidate = error['getLogs'];
  const getter = typeof getterCandidate === 'function' ? getterCandidate : null;
  if (typeof getter !== 'function') return;
  try {
    const result = await getter.call(error);
    if (Array.isArray(result)) {
      const filtered = result.filter((line): line is string => typeof line === 'string');
      if (filtered.length) {
        (error as { logs?: string[] }).logs = filtered;
      }
    }
  } catch (logErr) {
    console.warn('[solana] Failed to fetch transaction logs', logErr);
  }
}

function extractLogs(err: unknown): string[] {
  if (!err || typeof err !== 'object') return [];
  const candidate = (err as { logs?: unknown; data?: { logs?: unknown }; value?: { logs?: unknown } });
  const logsCandidates = [candidate.logs, candidate.data?.logs, candidate.value?.logs];
  for (const item of logsCandidates) {
    if (Array.isArray(item)) {
      return item.filter((line): line is string => typeof line === 'string');
    }
  }
  return [];
}

function decodeAnchorError(codeHex: string): string | null {
  try {
    const code = parseInt(codeHex, 16);
    if (Number.isNaN(code)) return null;
  const idlErrors = (PUNT_PROGRAM_IDL as unknown as { errors?: ReadonlyArray<{ code: number; msg: string }> }).errors;
    if (!Array.isArray(idlErrors)) return null;
    const match = idlErrors.find(e => e.code === code);
    return match?.msg ?? null;
  } catch {
    return null;
  }
}

function describeSendError(err: unknown): string {
  const base = err instanceof Error ? err.message : String(err ?? 'Unknown transaction error');
  const logs = extractLogs(err);
  if (base === '[object Object]' && !logs.length) {
    return 'Transaction failed';
  }
  const combined = [base, ...logs].join('\n');
  const customMatch = combined.match(/custom program error: (0x[0-9a-f]+)/i);
  if (customMatch) {
    const friendly = decodeAnchorError(customMatch[1]);
    if (friendly) return `${friendly} (${customMatch[1]})`;
    return `Program error (${customMatch[1]})`;
  }
  const anchorLog = logs.find(line => /anchorerror/i.test(line));
  if (anchorLog) {
    return anchorLog.replace(/Program log:\s*/i, '').trim();
  }
  const firstProgramLog = logs.find(line => /Program log:/i.test(line));
  if (firstProgramLog) {
    return firstProgramLog.replace(/Program log:\s*/i, '').trim();
  }
  if (/blockhash expired/i.test(base)) {
    return base;
  }
  if (/insufficient funds/i.test(base)) {
    return 'Insufficient balance to cover bet amount and rent';
  }
  if (logs.length) {
    return `${base}\n${logs.join('\n')}`;
  }
  return base;
}

// Tx send helper with 403 retry/rotation
async function sendAndConfirmSafe(wallet: WalletLike, tx: Transaction, label: string, maxRetries = 3): Promise<string> {
  if (!tx.feePayer && wallet.publicKey) tx.feePayer = wallet.publicKey;
  const EXPECTED_COMMITMENT = 'confirmed' as const;
  const POLL_INTERVAL_MS_BASE = 500;
  const MAX_CONFIRM_MS = 90_000; // extended beyond Anchor default 30s
  const PRIORITY_MICRO_LAMPORTS = 5_000; // adjust if you want higher priority; devnet modest value

  function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

  // Persist signed payload across retries to avoid additional wallet prompts
  let raw: Buffer | null = null;
  let latest: { blockhash: string; lastValidBlockHeight: number } | null = null;
  let sig: string | null = null;
  let expectedSignature: string | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await ensureHealthyConnection(attempt > 0);

      // Only build and sign once
      if (!raw) {
        latest = await _connection.getLatestBlockhash('finalized');
        tx.recentBlockhash = latest.blockhash;
        tx.lastValidBlockHeight = latest.lastValidBlockHeight;
        if (!tx.feePayer && wallet.publicKey) tx.feePayer = wallet.publicKey;

        // Inject compute budget / priority fee if not already present
        const hasComputeIx = tx.instructions.some(ix => ix.programId.equals(ComputeBudgetProgram.programId));
        if (!hasComputeIx) {
          tx.instructions.unshift(
            ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
            ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_MICRO_LAMPORTS })
          );
        }

        const programInstance = await getProgram(wallet);
        const provider = programInstance.provider as AnchorProvider;
        const providerWallet = provider.wallet as AnchorWallet;
        if (!providerWallet?.signTransaction) {
          throw new Error('Wallet does not support signTransaction');
        }
        const signed = await providerWallet.signTransaction(tx);
        const firstSig = signed.signatures?.[0]?.signature;
        expectedSignature = firstSig ? bs58.encode(firstSig) : null;
        raw = signed.serialize();
      }

      // Try sending the same signed tx a few times without re-signing (avoid double wallet prompts)
      const sendOpts = { skipPreflight: false, preflightCommitment: 'processed' as const, maxRetries: 15 };
      let lastSendError: unknown = null;
      for (let sendTry = 0; sendTry < 3 && !sig; sendTry++) {
        try {
          sig = await _connection.sendRawTransaction(raw!, sendOpts);
          lastSendError = null;
        } catch (sendErr) {
          lastSendError = sendErr;
          await hydrateTransactionError(sendErr);
          const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
          if (/transaction has already been processed/i.test(msg) || /already been processed/i.test(msg)) {
            if (!sig && expectedSignature) {
              sig = expectedSignature;
              lastSendError = null;
              break;
            }
          }
          // Surface deterministic failures (simulation, account issues, etc.) immediately
          const deterministicFailure =
            sendErr instanceof SendTransactionError ||
            /custom program error/i.test(msg) ||
            /transaction simulation failed/i.test(msg) ||
            /insufficient funds/i.test(msg) ||
            /blockhash/i.test(msg) ||
            extractLogs(sendErr).length > 0;
          if (deterministicFailure) {
            const friendly = describeSendError(sendErr);
            console.warn(`[sendAndConfirmSafe:${label}] broadcast error`, { message: friendly, raw: msg, logs: extractLogs(sendErr) });
            throw new Error(friendly);
          }
          // brief backoff then retry same raw
          await sleep(250 * (sendTry + 1));
        }
      }
      if (!sig) {
        // Could not broadcast without a signature; surface last known error if available
        if (lastSendError) {
          await hydrateTransactionError(lastSendError);
          const friendly = describeSendError(lastSendError);
          console.warn(`[sendAndConfirmSafe:${label}] exhausted broadcast retries`, { message: friendly, logs: extractLogs(lastSendError) });
          throw new Error(friendly);
        }
        throw new Error('Broadcast failed: no signature returned');
      }

      // Confirmation loop; periodically rebroadcast the same raw for nodal propagation
      const start = Date.now();
      let currentBlockHeight = latest!.lastValidBlockHeight;
      let pollCount = 0;
      while (true) {
        // Periodically refresh block height to ensure we don't exceed validity window
        if (pollCount % 4 === 0) {
          try { currentBlockHeight = await _connection.getBlockHeight('processed'); } catch {/* ignore */}
          if (currentBlockHeight > latest!.lastValidBlockHeight) {
            // blockhash expired; abort to avoid re‑signing (prevents second wallet prompt)
            throw new Error(`Blockhash expired before confirmation (sig ${sig})`);
          }
        }
        const status = await _connection.getSignatureStatuses([sig]);
        const info = status.value[0];
        if (info) {
          if (info.err) {
            console.warn(`[sendAndConfirmSafe:${label}] transaction error`, info.err);
            let friendly = describeSendError(info.err);
            if (!friendly || friendly === '[object Object]') friendly = 'Transaction failed';
            throw new Error(`${friendly} (sig ${sig})`);
          }
          if (info.confirmationStatus === EXPECTED_COMMITMENT || info.confirmationStatus === 'finalized') {
            return sig;
          }
        }
        // Opportunistic re-broadcast every ~3s
        if (pollCount % 6 === 0) {
          try { await _connection.sendRawTransaction(raw!, { ...sendOpts, maxRetries: 0 }); } catch {/* ignore */}
        }
        const elapsed = Date.now() - start;
        if (elapsed > MAX_CONFIRM_MS) {
          throw new Error(`Transaction not confirmed after ${(elapsed/1000).toFixed(1)}s (sig ${sig})`);
        }
        pollCount++;
        const backoff = POLL_INTERVAL_MS_BASE * Math.min(6, 1 + Math.floor(pollCount / 10));
        await sleep(backoff);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Diagnostic logs extraction if available
      try {
        const errorWithLogs = e as Partial<{ logs?: unknown; getLogs?: () => Promise<unknown> }>;
        if (Array.isArray(errorWithLogs.logs)) {
          console.warn(`[sendAndConfirmSafe:${label}] simulation logs (attempt ${attempt}):`, errorWithLogs.logs);
        } else if (typeof errorWithLogs.getLogs === 'function') {
          const fetchedLogs = await errorWithLogs.getLogs();
          if (fetchedLogs) {
            console.warn(`[sendAndConfirmSafe:${label}] simulation logs (attempt ${attempt}):`, fetchedLogs);
          }
        }
      } catch {/* ignore */}
      if (/403|503|forbidden|service unavailable/i.test(msg) && attempt < maxRetries) {
        rotateEndpoint('tx-http-error');
        continue;
      }
      // Fail fast on blockhash expiry to avoid re-signing loops
      if (/blockhash expired/i.test(msg)) {
        throw e instanceof Error ? e : new Error(String(e));
      }
      if (/node is behind/i.test(msg) && attempt < maxRetries) {
        const currentEndpoint = getRpcEndpoint(_connection);
        if (currentEndpoint) {
          const meta = endpointStats[currentEndpoint];
          if (meta) meta.laggingUntil = Date.now() + NODE_BEHIND_COOLDOWN_MS;
        }
        await promoteBestEndpoint('tx-node-behind');
        continue;
      }
      // Remove re-signing fallback to avoid second wallet prompts
      if (attempt === maxRetries) {
        throw e instanceof Error ? e : new Error(String(e));
      }
    }
  }
  throw new Error(`Failed to send transaction (${label}) after retries`);
}

// PDA helpers (cycle aware)
export function getAuthorityMetaPda(authority: PublicKey) {
  return PublicKey.findProgramAddressSync([
    Buffer.from("authority_meta"),
    authority.toBuffer(),
  ], PROGRAM_ID)[0];
}

export function getMarketPda(authority: PublicKey, cycle: number) {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(cycle, 0);
  return PublicKey.findProgramAddressSync([
    Buffer.from("market"),
    authority.toBuffer(),
    buf,
  ], PROGRAM_ID)[0];
}

export function getTicketPda(market: PublicKey, user: PublicKey) {
  return PublicKey.findProgramAddressSync([
    Buffer.from("ticket"),
    market.toBuffer(),
    user.toBuffer(),
  ], PROGRAM_ID)[0];
}

// AuthorityMeta fetch helper
export interface RawAuthorityMeta { authority: PublicKey; nextCycle?: number; next_cycle?: number; bump: number; }
export interface ParsedAuthorityMeta { authority: string; nextCycle: number; bump: number; }

async function fetchAuthorityMeta(program: Program, authority: PublicKey): Promise<ParsedAuthorityMeta | null> {
  const pda = getAuthorityMetaPda(authority);
  try {
  type RawAuthMetaPossible = { authority: PublicKey; nextCycle?: number; next_cycle?: number; bump: number };
  const ns = program.account as unknown as { authorityMeta: { fetch: (pk: PublicKey) => Promise<RawAuthMetaPossible> } };
  const raw = await ns.authorityMeta.fetch(pda);
  const nextCycleVal = typeof raw.nextCycle === 'number' ? raw.nextCycle : (typeof raw.next_cycle === 'number' ? raw.next_cycle : 0);
  return { authority: raw.authority.toBase58(), nextCycle: nextCycleVal, bump: raw.bump };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : String(e)).toLowerCase();
    if (msg.includes('account does not exist') || msg.includes('could not find')) return null;
    return null;
  }
}

// Initialize market (authority = connected wallet) - cycle aware (auto inits AuthorityMeta if needed)
export async function initializeMarket(wallet: WalletLike, params: { title: string; labelYes: string; labelNo: string; feeBps?: number; }) {
  const { title, labelYes, labelNo, feeBps } = params;
  const program = await getProgram(wallet);
  const authority = wallet.publicKey!;
  const authorityMeta = getAuthorityMetaPda(authority);
  let meta = await fetchAuthorityMeta(program, authority);
  const tx = new Transaction();
  if (!meta) {
    const ixInitMeta = await program.methods.initAuthorityMeta().accounts({ authority, authorityMeta, systemProgram: SystemProgram.programId }).instruction();
    tx.add(ixInitMeta);
    meta = { authority: authority.toBase58(), nextCycle: 0, bump: 0 };
  }
  const market = getMarketPda(authority, meta.nextCycle);
  const ixInitMarket = await program.methods.initializeMarket(title, labelYes, labelNo, feeBps === undefined ? null : feeBps).accounts({
    authority,
    authorityMeta,
    market,
    systemProgram: SystemProgram.programId,
  }).instruction();
  tx.add(ixInitMarket);
  const sig = await sendAndConfirmSafe(wallet, tx, 'initializeMarket');
  return { txSig: sig, market, cycle: meta.nextCycle };
}

// Create a ticket for a given market authority (defaults to self for backwards compat)
export async function createTicket(wallet: WalletLike, side: 0 | 1, marketAuthority?: PublicKey) {
  const program = await getProgram(wallet);
  const user = wallet.publicKey!;
  const authority = marketAuthority ?? user;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) throw new Error('No active market (meta missing or first cycle not initialized)');
  const currentCycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, currentCycle);
  const ticket = getTicketPda(market, user);
  const ix = await program.methods.createTicket(side).accounts({ user, market, ticket, systemProgram: SystemProgram.programId }).instruction();
  const tx = new Transaction().add(ix);
  const txSig = await sendAndConfirmSafe(wallet, tx, 'createTicket');
  return { txSig, ticket, market, cycle: currentCycle };
}

export async function placeBet(wallet: WalletLike, amountLamports: number, marketAuthority?: PublicKey) {
  const program = await getProgram(wallet);
  const user = wallet.publicKey!;
  const authority = marketAuthority ?? user;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) throw new Error('No active market');
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, cycle);
  const ticket = getTicketPda(market, user);
  const ix = await program.methods.placeBet(new BN(amountLamports)).accounts({ user, market, ticket, systemProgram: SystemProgram.programId }).instruction();
  const tx = new Transaction().add(ix);
  const txSig = await sendAndConfirmSafe(wallet, tx, 'placeBet');
  return { txSig, cycle };
}

// Client-side unified bet: ensure ticket exists then place bet
export async function bet(wallet: WalletLike, params: { side: 0 | 1; amountLamports: number; marketAuthority?: PublicKey }) {
  const { side, amountLamports, marketAuthority } = params;
  const program = await getProgram(wallet);
  const user = wallet.publicKey!;
  const authority = marketAuthority ?? user;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) throw new Error('No active market');
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, cycle);
  const ticket = getTicketPda(market, user);
  let needCreate = false;
  try {
    const ns = program.account as unknown as AccountNamespace;
    await ns.betTicket.fetch(ticket);
  } catch { needCreate = true; }
  const tx = new Transaction();
  if (needCreate) {
    const ixCreate = await program.methods.createTicket(side).accounts({ user, market, ticket, systemProgram: SystemProgram.programId }).instruction();
    tx.add(ixCreate);
  } else {
    const ns = program.account as unknown as AccountNamespace;
    const existing = await ns.betTicket.fetch(ticket);
    if (existing.side !== side) throw new Error('Ticket already created with opposite side');
  }
  const ixBet = await program.methods.placeBet(new BN(amountLamports)).accounts({ user, market, ticket, systemProgram: SystemProgram.programId }).instruction();
  tx.add(ixBet);
  const sig = await sendAndConfirmSafe(wallet, tx, 'bet');
  return { txSig: sig, ticket, market, cycle };
}

export async function freezeMarket(wallet: WalletLike) {
  const program = await getProgram(wallet);
  const authority = wallet.publicKey!;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) throw new Error('No active market');
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, cycle);
  const ix = await program.methods.freezeMarket().accounts({ authority, market }).instruction();
  const tx = new Transaction().add(ix);
  const txSig = await sendAndConfirmSafe(wallet, tx, 'freezeMarket');
  return { txSig, cycle };
}

export async function resolveMarket(wallet: WalletLike, winningSide: 0 | 1) {
  const program = await getProgram(wallet);
  const authority = wallet.publicKey!;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) throw new Error('No active market');
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, cycle);
  const ix = await program.methods.resolveMarket(winningSide).accounts({ resolver: authority, market }).instruction();
  const tx = new Transaction().add(ix);
  const txSig = await sendAndConfirmSafe(wallet, tx, 'resolveMarket');
  return { txSig, cycle };
}

export async function claimWinnings(wallet: WalletLike, marketAuthority?: PublicKey) {
  const program = await getProgram(wallet);
  const user = wallet.publicKey!;
  const authority = marketAuthority ?? user;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) throw new Error('No active market');
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, cycle);
  const ticket = getTicketPda(market, user);
  const ix = await program.methods.claimWinnings().accounts({ user, market, ticket }).instruction();
  const tx = new Transaction().add(ix);
  const txSig = await sendAndConfirmSafe(wallet, tx, 'claimWinnings');
  return { txSig, cycle };
}

export async function withdrawFees(wallet: WalletLike) {
  const program = await getProgram(wallet);
  const authority = wallet.publicKey!;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) throw new Error('No active market');
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, cycle);
  const ix = await program.methods.withdrawFees().accounts({ authority, market, host: HOST_PUBKEY }).instruction();
  const tx = new Transaction().add(ix);
  const txSig = await sendAndConfirmSafe(wallet, tx, 'withdrawFees');
  return { txSig, cycle };
}

export async function closeMarket(wallet: WalletLike) {
  const program = await getProgram(wallet);
  const authority = wallet.publicKey!;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) throw new Error('No active market');
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, cycle);
  const ix = await program.methods.closeMarket().accounts({ authority, market, host: HOST_PUBKEY }).instruction();
  const tx = new Transaction().add(ix);
  const txSig = await sendAndConfirmSafe(wallet, tx, 'closeMarket');
  return { txSig, cycle };
}

// Manually close a losing (or already claimed) ticket to reclaim rent if not auto-closed
export async function closeTicket(wallet: WalletLike, marketAuthority?: PublicKey) {
  const program = await getProgram(wallet);
  const user = wallet.publicKey!;
  const authority = marketAuthority ?? user;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) throw new Error('No active market');
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, cycle);
  const ticket = getTicketPda(market, user);
  const ix = await program.methods.closeTicket().accounts({ user, market, ticket }).instruction();
  const tx = new Transaction().add(ix);
  const txSig = await sendAndConfirmSafe(wallet, tx, 'closeTicket');
  return { txSig, cycle };
}

// Fetch helpers
export interface ParsedBetMarket {
  authority: string;
  cycle: number;
  poolYes: number;
  poolNo: number;
  resolved: boolean;
  frozen: boolean;
  feeBps: number;
  hostFeeBps: number;
  bump: number;
  winningSide: number; // 255 sentinel
  feesAccrued: number;
  title: string;
  labelYes: string;
  labelNo: string;
}
export interface RawBetTicket {
  user: PublicKey;
  market: PublicKey;
  side: number;
  amount: BN;
  claimed: boolean;
  bump: number;
}
export interface ParsedBetTicket {
  user: string;
  market: string;
  side: number;
  amount: number;
  claimed: boolean;
  bump: number;
}

function bnToNumber(x: BN | undefined): number { return x ? Number(x.toString()) : 0; }
function bytesToStr(arr?: number[] | Uint8Array, trim = true): string {
  if (!arr) return '';
  const u8 = arr instanceof Uint8Array ? arr : Uint8Array.from(arr);
  let s = new TextDecoder().decode(u8);
  if (trim) s = s.replace(/\0+$/g, '').trim();
  return s;
}

// Narrowed account namespace typing for decode helpers
interface AccountNamespace {
  betTicket: { fetch: (pubkey: PublicKey) => Promise<RawBetTicket> };
  authorityMeta?: { fetch: (pubkey: PublicKey) => Promise<RawAuthorityMeta> };
}

interface TicketAccountNamespace {
  betTicket: {
    all: (filters?: Array<{ memcmp: { offset: number; bytes: string } }>) => Promise<Array<{ account: { amount: BN | number | bigint } }>>;
  };
}

const TITLE_MAX_LEN_BYTES = 64;
const LABEL_MAX_LEN_BYTES = 32;
const BET_MARKET_ACCOUNT_LEN_V1 = 8 + 32 + 2 + 8 + 8 + 1 + 2 + 2 + 1 + 1 + 8 + TITLE_MAX_LEN_BYTES + LABEL_MAX_LEN_BYTES + LABEL_MAX_LEN_BYTES;
const BET_MARKET_ACCOUNT_LEN_V2 = BET_MARKET_ACCOUNT_LEN_V1 + 1;

function parseBetMarketAccount(data: Uint8Array): ParsedBetMarket {
  const len = data.length;
  if (len !== BET_MARKET_ACCOUNT_LEN_V1 && len !== BET_MARKET_ACCOUNT_LEN_V2) {
    throw new Error(`Unsupported BetMarket account length ${len}`);
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let offset = 8; // skip discriminator
  const authority = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
  const cycle = view.getUint16(offset, true); offset += 2;
  const poolYes = Number(view.getBigUint64(offset, true)); offset += 8;
  const poolNo = Number(view.getBigUint64(offset, true)); offset += 8;
  const resolved = data[offset] === 1; offset += 1;
  let frozen = false;
  if (len === BET_MARKET_ACCOUNT_LEN_V2) {
    frozen = data[offset] === 1;
    offset += 1;
  }
  const feeBps = view.getUint16(offset, true); offset += 2;
  const hostFeeBps = view.getUint16(offset, true); offset += 2;
  const bump = data[offset]; offset += 1;
  const winningSide = data[offset]; offset += 1;
  const feesAccrued = Number(view.getBigUint64(offset, true)); offset += 8;
  const titleBytes = data.slice(offset, offset + TITLE_MAX_LEN_BYTES); offset += TITLE_MAX_LEN_BYTES;
  const labelYesBytes = data.slice(offset, offset + LABEL_MAX_LEN_BYTES); offset += LABEL_MAX_LEN_BYTES;
  const labelNoBytes = data.slice(offset, offset + LABEL_MAX_LEN_BYTES);
  return {
    authority: authority.toBase58(),
    cycle,
    poolYes,
    poolNo,
    resolved,
    frozen,
    feeBps,
    hostFeeBps,
    bump,
    winningSide,
    feesAccrued,
    title: bytesToStr(titleBytes),
    labelYes: bytesToStr(labelYesBytes),
    labelNo: bytesToStr(labelNoBytes),
  };
}

export async function fetchMarket(wallet: WalletLike, marketAuthority?: PublicKey): Promise<{ pubkey: PublicKey; data: ParsedBetMarket } | null> {
  const program = await getProgram(wallet);
  const authority = marketAuthority ?? wallet.publicKey!;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) return null; // no markets yet
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, cycle);
  try {
    const info = await program.provider.connection.getAccountInfo(market, { commitment: 'processed' });
    if (!info?.data) return null;
    const parsed = parseBetMarketAccount(info.data);
    return { pubkey: market, data: parsed };
  } catch (e) {
    console.warn('[fetchMarket] Failed to decode market account', e);
    return null;
  }
}

// Public (read-only) fetch that does not require a connected wallet (for viewers)
export async function fetchMarketPublic(marketAuthority: PublicKey): Promise<{ pubkey: PublicKey; data: ParsedBetMarket } | null> {
  const program = await getReadonlyProgram();
  // Use authority meta to determine current cycle
  const meta = await fetchAuthorityMeta(program, marketAuthority);
  if (!meta || meta.nextCycle === 0) return null;
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(marketAuthority, cycle);
  try {
    const info = await program.provider.connection.getAccountInfo(market, { commitment: 'processed' });
    if (!info?.data) return null;
    const parsed = parseBetMarketAccount(info.data);
    return { pubkey: market, data: parsed };
  } catch (e) {
    console.warn('[fetchMarketPublic] Failed to decode market account', e);
    return null;
  }
}

export async function fetchMarketTicketCountPublic(marketAuthority: PublicKey): Promise<number> {
  const program = await getReadonlyProgram();
  const meta = await fetchAuthorityMeta(program, marketAuthority);
  if (!meta || meta.nextCycle === 0) return 0;
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(marketAuthority, cycle);
  try {
    const ticketNs = program.account as unknown as TicketAccountNamespace;
    if (!ticketNs?.betTicket?.all) return 0;
    const filters = [{ memcmp: { offset: 8 + 32, bytes: market.toBase58() } }];
    const tickets = await ticketNs.betTicket.all(filters);
    if (!Array.isArray(tickets) || tickets.length === 0) return 0;
    const zero = new BN(0);
    return tickets.reduce((count, entry) => {
      const amt = entry?.account?.amount;
      if (amt instanceof BN) return amt.gt(zero) ? count + 1 : count;
      if (typeof amt === 'bigint') return amt > BigInt(0) ? count + 1 : count;
      const num = typeof amt === 'number' ? amt : Number(amt ?? 0);
      return Number.isFinite(num) && num > 0 ? count + 1 : count;
    }, 0);
  } catch (e) {
    console.warn('[fetchMarketTicketCountPublic] failed for authority', marketAuthority.toBase58?.(), e);
    return 0;
  }
}

export async function fetchTicket(wallet: WalletLike, marketAuthority?: PublicKey): Promise<{ pubkey: PublicKey; data: ParsedBetTicket } | null> {
  const program = await getProgram(wallet);
  const user = wallet.publicKey!;
  const authority = marketAuthority ?? user;
  const meta = await fetchAuthorityMeta(program, authority);
  if (!meta || meta.nextCycle === 0) return null;
  const cycle = meta.nextCycle - 1;
  const market = getMarketPda(authority, cycle);
  const ticket = getTicketPda(market, user);
  try {
    const raw = await (program.account as unknown as AccountNamespace).betTicket.fetch(ticket);
    const parsed: ParsedBetTicket = {
      user: raw.user.toBase58(),
      market: raw.market.toBase58(),
      side: raw.side,
      amount: bnToNumber(raw.amount),
      claimed: raw.claimed,
      bump: raw.bump,
    };
    return { pubkey: ticket, data: parsed };
  } catch {
    return null;
  }
}

export function lamportsToSol(l: number | string | bigint) {
  const n = typeof l === 'bigint' ? Number(l) : Number(l);
  return n / 1_000_000_000;
}
