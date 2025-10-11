"use client";
import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronsUpDown } from "lucide-react";
import {
  bet,
  resolveMarket,
  claimWinnings,
  withdrawFees,
  closeMarket,
  closeTicket,
  fetchMarket,
  fetchTicket,
  fetchMarketPublic,
  fetchMarketTicketCountPublic,
  lamportsToSol,
  ParsedBetMarket,
  ParsedBetTicket,
  getConnection,
} from "@/lib/solana";
import { PublicKey } from "@solana/web3.js";
import { useToast } from "@/components/ToastProvider";
import { StreamPlayer } from "@/components/stream/StreamPlayer";
import { ChatPanel } from "@/components/stream/ChatPanel";
import { PollSummaryBar } from "@/components/PollSummaryBar";
import { PredictionOverlay } from "@/components/stream/PredictionOverlay";

type PredictionOverlayDetail = {
  title?: string;
  yesPct?: number;
  noPct?: number;
  bets?: number;
  labelYes?: string;
  labelNo?: string;
  secondsLeft?: number;
};

export default function WatchPage() {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { addToast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [market, setMarket] = useState<ParsedBetMarket | null>(null);
  const [ticket, setTicket] = useState<ParsedBetTicket | null>(null);
  const [betAmount, setBetAmount] = useState<string>("0.001");
  const [sideChoice, setSideChoice] = useState<0 | 1>(0);
  const [betDrawerOpen, setBetDrawerOpen] = useState(false);
  const [selectedAuthority, setSelectedAuthority] = useState<PublicKey | null>(null);
  const [mounted, setMounted] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (ticket) {
      setSideChoice(ticket.side as 0 | 1);
    } else {
      setSideChoice(0);
    }
  }, [ticket]);

  const refresh = useCallback(async () => {
    try {
      if (!publicKey) {
        if (selectedAuthority) {
          const m = await fetchMarketPublic(selectedAuthority);
          setMarket(m?.data || null);
          setTicket(null);
        } else {
          setMarket(null); setTicket(null);
        }
        return;
      }
      if (selectedAuthority && selectedAuthority.toBase58() !== publicKey.toBase58()) {
        const m = await fetchMarketPublic(selectedAuthority);
        setMarket(m?.data || null);
        if (m?.data) {
          const t = await fetchTicket(wallet, selectedAuthority);
          setTicket(t?.data || null);
        } else {
          setTicket(null);
        }
        return;
      }
      const m = await fetchMarket(wallet, undefined);
      const marketData = m?.data || null;
      setMarket(marketData);
      if (marketData) {
        const t = await fetchTicket(wallet, undefined);
        setTicket(t?.data || null);
      } else {
        setTicket(null);
      }
    } catch (e) { console.error(e); }
  }, [publicKey, wallet, selectedAuthority]);

  useEffect(() => { refresh(); }, [refresh]);

  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setWalletBalance(0);
      return;
    }
    try {
      const conn = await getConnection();
      const lamports = await conn.getBalance(publicKey, { commitment: "processed" });
      setWalletBalance(lamports / 1_000_000_000);
    } catch (err) {
      console.warn('[watch] failed to load wallet balance', err);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  useEffect(() => {
    const handler = () => fetchBalance();
    window.addEventListener('refresh-balance', handler);
    return () => window.removeEventListener('refresh-balance', handler);
  }, [fetchBalance]);

  const maxStake = Number.isFinite(walletBalance) && walletBalance > 0 ? walletBalance : 0;
  const sliderValue = (() => {
    const parsed = parseFloat(betAmount);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.min(parsed, maxStake);
  })();

  // Broadcast overlay updates to the StreamPlayer consumer
  // - Computes YES/NO percentages from the current market pools
  // - Optionally enriches with an approximate bets count by scanning system chat messages
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!market || market.resolved) {
      // Clear overlay when no active market
      window.dispatchEvent(new CustomEvent('prediction-overlay', { detail: null }));
      return;
    }
  const total = (market.poolYes + market.poolNo) || 0;
  const hasVolume = total > 0;
  const yesPct = hasVolume ? (market.poolYes / total) * 100 : 50;
  const noPct = hasVolume ? 100 - yesPct : 50;
    const detail = {
      title: market.title || 'Live Prediction',
      yesPct,
      noPct,
      bets: undefined as number | undefined,
      labelYes: market.labelYes || undefined,
      labelNo: market.labelNo || undefined,
    };
    window.dispatchEvent(new CustomEvent('prediction-overlay', { detail }));
  }, [market]);

  // Poll on-chain ticket accounts to reflect the current number of active bets
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    if (!market || market.resolved) {
      window.dispatchEvent(new CustomEvent('prediction-overlay', { detail: null }));
      return;
    }
    const fallbackAuthority = (!selectedAuthority && !publicKey && market?.authority)
      ? (() => {
          try { return new PublicKey(market.authority); } catch { return null; }
        })()
      : null;
    const authorityCandidate = selectedAuthority ?? publicKey ?? fallbackAuthority;
    if (!authorityCandidate) return;
    const authorityPk = authorityCandidate;
    async function tick() {
      try {
        const count = await fetchMarketTicketCountPublic(authorityPk);
        if (cancelled) return;
        if (!market || market.resolved) {
          window.dispatchEvent(new CustomEvent('prediction-overlay', { detail: null }));
          return;
        }
  const total = (market.poolYes + market.poolNo) || 0;
  const hasVolume = total > 0;
  const yesPct = hasVolume ? (market.poolYes / total) * 100 : 50;
  const noPct = hasVolume ? 100 - yesPct : 50;
        const detail = {
          title: market.title || 'Live Prediction',
          yesPct,
          noPct,
          bets: count,
          labelYes: market.labelYes || undefined,
          labelNo: market.labelNo || undefined,
        };
        window.dispatchEvent(new CustomEvent('prediction-overlay', { detail }));
      } catch (err) {
        if (!cancelled) {
          console.warn('[watch] failed to load bet count', err);
        }
      }
    }
    // Initial tick immediately, then interval
    tick();
    const id = setInterval(tick, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, [selectedAuthority, publicKey, market]);

  type TxResult = { txSig?: string } | void;
  const hasSig = (v: unknown): v is { txSig: string } => !!v && typeof v === 'object' && 'txSig' in v && typeof (v as { txSig: unknown }).txSig === 'string';
  const run = async <T extends TxResult>(label: string, fn: () => Promise<T>): Promise<boolean> => {
    let succeeded = false;
    try {
      if (busyRef.current) return false; // single-flight guard
      busyRef.current = true;
      setError(null);
      setActionLoading(label);
      // Tiny submitting toast for position and poll actions
      if (/^(bet_yes|bet_no|bet_more|claim|close_ticket|resolve_yes|resolve_no|withdraw|close)/.test(label)) {
        addToast({ type: "info", message: "Submitting…" });
      }
      const res = await fn();
      if (hasSig(res)) {
        setLastSignature(res.txSig);
        addToast({ type: "success", message: `${label} tx: ${res.txSig.slice(0,8)}...` });
        try {
          const auth = (selectedAuthority || publicKey) ? (selectedAuthority || publicKey)!.toBase58() : null;
          const sysMsgMap: Record<string,string> = {
            init: '🟢 Poll created by host',
            bet_yes: '✅ Bet placed on YES',
            bet_no: '❌ Bet placed on NO',
            bet_more: '➕ Additional bet added',
            resolve_yes: '🏁 Result set: YES wins',
            resolve_no: '🏁 Result set: NO wins',
            claim: '💰 Winnings claimed',
            withdraw: '📤 Host fees withdrawn',
            close: '📁 Poll archived',
            close_ticket: '🧹 Ticket closed'
          };
          if (auth && sysMsgMap[label]) {
            fetch('/api/chat', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ authority: auth, text: sysMsgMap[label], type: 'system' }) }).catch(()=>{});
          }
        } catch {/* ignore */}
      }
      window.dispatchEvent(new Event("refresh-balance"));
      await new Promise(r => setTimeout(r, 600));
      await refresh();
      if (label.startsWith('claim') || label.startsWith('close')) {
        setTimeout(() => { refresh().catch(()=>{}); }, 2000);
      }
      succeeded = true;
    } catch (e) {
      const err = e as Error;
      console.error(err);
      setError(err.message);
      addToast({ type: "error", message: err.message || `${label} failed` });
    } finally {
      setActionLoading(null);
      busyRef.current = false;
    }
    return succeeded;
  };

  const solToLamports = (s: string) => Math.round(parseFloat(s || "0") * 1_000_000_000);
  const lockPosition = Boolean(actionLoading && /^(bet_yes|bet_no|bet_more|claim|close_ticket)/.test(actionLoading));
  const lockPoll = Boolean(actionLoading && /^(resolve_yes|resolve_no|withdraw|close)/.test(actionLoading));
  const lockAny = lockPoll || lockPosition;
  const userIsAuthority = !!market && market.authority === publicKey?.toBase58();
  const marketResolved = market?.resolved;
  const winningSide = market?.winningSide;
  const noWinner = !!market && market.resolved && (
    (market.winningSide === 0 && market.poolYes === 0) ||
    (market.winningSide === 1 && market.poolNo === 0)
  );
  const userWon = !!ticket && marketResolved && winningSide === ticket.side && !ticket.claimed;
  const userLost = !!ticket && marketResolved && !noWinner && winningSide !== 255 && winningSide !== ticket.side;
  const canManualCloseTicket = !!ticket && marketResolved && (ticket.claimed || userLost);
  const labelOver = market?.labelYes || 'OVER';
  const labelUnder = market?.labelNo || 'UNDER';
  const quickStakePresets = ['0.001', '0.005', '0.01'];
  const betActionLabel = ticket ? 'Add To Position' : `Confirm ${sideChoice === 0 ? labelOver : labelUnder}`;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const auth = params.get('authority');
    if (auth && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(auth)) {
      try { const pk = new PublicKey(auth); setSelectedAuthority(pk); } catch {/* ignore */}
    }
  }, []);

  // Streamer selection via sidebar removed; URL parameter is the only source now.

  const handleBet = (side: 0 | 1) => {
    setSideChoice(side);
    return run(side === 0 ? 'bet_yes' : 'bet_no', () => bet(wallet, { side, amountLamports: solToLamports(betAmount), marketAuthority: selectedAuthority || undefined }));
  };

  const submitBet = async () => {
    if (ticket) {
      await run('bet_more', () =>
        bet(wallet, {
          side: ticket.side as 0 | 1,
          amountLamports: solToLamports(betAmount),
          marketAuthority: selectedAuthority || undefined,
        })
      );
    } else {
      await handleBet(sideChoice);
    }
    setBetDrawerOpen(false);
  };

  useEffect(() => {
    if (marketResolved) {
      setBetDrawerOpen(false);
    }
  }, [marketResolved]);

  if (!mounted) {
    return (
      <main className="p-8 flex flex-col items-center gap-4 max-w-lg mx-auto text-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className={`relative w-full py-6 px-6 xl:px-10 flex flex-col gap-8 max-w-7xl mx-auto`}>
      {/* Streamer selection and PUNT header removed; this page relies on /watch?authority=... */}
      {!selectedAuthority && (
        <div className="panel p-5 text-sm text-dim">No stream selected. Go to the home page and choose a stream.</div>
      )}

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-4">
          {selectedAuthority && (
            <div className="panel p-3 sm:p-4">
              <ViewerStream authority={selectedAuthority.toBase58()} />
            </div>
          )}
          <div>
            <ChatPanel authority={(selectedAuthority || publicKey || undefined)?.toBase58?.() || (publicKey?.toBase58?.() || 'self')} />
          </div>
        </div>
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-4">
          <section className={`panel p-5 space-y-5 relative ${lockAny ? 'opacity-60' : ''}`}>
            {lockAny && (
              <div className="absolute inset-0 z-10 rounded-[inherit] bg-black/30 backdrop-blur-[2px] flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <div className="flex items-center justify-between">
              <h2 className="card-header">Live Poll</h2>
              {market && !market.resolved && <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">Live</span>}
            </div>
            {market ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    {market.title || 'Untitled Market'}
                  </p>
                  <PollSummaryBar poolYes={market.poolYes} poolNo={market.poolNo} labelYes={market.labelYes} labelNo={market.labelNo} variant="viewer" />
                  {market.resolved && (
                    <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-[11px] text-white/80">
                      Outcome: <span className="font-semibold">{market.winningSide === 0 ? (market.labelYes || 'YES') : (market.labelNo || 'NO')}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {userIsAuthority && !market.resolved && (
                    <>
                      <button type="button" disabled={!!actionLoading} onClick={() => run('resolve_yes', () => resolveMarket(wallet, 0))} className="btn btn-sm bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white border-transparent">
                        {actionLoading ? '...' : `Set: ${market.labelYes || 'YES'}`}
                      </button>
                      <button type="button" disabled={!!actionLoading} onClick={() => run('resolve_no', () => resolveMarket(wallet, 1))} className="btn btn-sm bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white border-transparent">
                        {actionLoading ? '...' : `Set: ${market.labelNo || 'NO'}`}
                      </button>
                    </>
                  )}
                  {userIsAuthority && market.feesAccrued > 0 && (
                    <button type="button" disabled={!!actionLoading} onClick={() => run('withdraw', () => withdrawFees(wallet))} className="btn btn-sm bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white border-transparent">
                      {actionLoading ? '...' : 'Collect Host Fees'}
                    </button>
                  )}
                  {userIsAuthority && market.resolved && market.feesAccrued === 0 && (
                    <button type="button" disabled={!!actionLoading} onClick={() => run('close', () => closeMarket(wallet))} className="btn btn-sm border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10">
                      {actionLoading ? '...' : 'Archive Poll'}
                    </button>
                  )}
                </div>

                {ticket && (
                  <div className="space-y-2 rounded-md border border-white/10 bg-black/25 p-4 text-xs text-white/75">
                    <div className="flex items-center justify-between">
                      <span className="uppercase tracking-[0.2em] text-white/50">Side</span>
                      <span className="text-sm font-semibold text-white">{ticket.side === 0 ? labelOver : labelUnder}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="uppercase tracking-[0.2em] text-white/50">Amount</span>
                      <span className="text-sm font-semibold text-white">{lamportsToSol(ticket.amount)} SOL</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="uppercase tracking-[0.2em] text-white/50">Status</span>
                      <span className="text-sm font-semibold text-white">{ticket.claimed ? 'Claimed' : (marketResolved ? 'Awaiting Claim' : 'Live')}</span>
                    </div>
                  </div>
                )}

                {!userIsAuthority && !market.resolved && (
                  <div className="space-y-4 border-t border-white/5 pt-4">
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1].map(option => {
                        const chosen = sideChoice === option;
                        const disabled = !!actionLoading || (!!ticket && ticket.side !== option);
                        const label = option === 0 ? labelOver : labelUnder;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSideChoice(option as 0 | 1)}
                            disabled={disabled}
                            className={`rounded-md border border-white/10 px-3 py-2 text-sm font-semibold transition ${
                              chosen ? 'bg-[var(--accent)] text-white' : 'bg-white/5 text-white/70 hover:bg-white/10'
                            } ${disabled && !chosen ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBetDrawerOpen(open => !open)}
                      disabled={!!actionLoading}
                      className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:opacity-60"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <span>{betDrawerOpen ? 'Hide Bet Options' : 'Place Bet'}</span>
                        <ChevronsUpDown className={`w-4 h-4 ${betDrawerOpen ? 'rotate-180' : ''} transition-transform duration-200 animate-bounce`} />
                      </span>
                    </button>
                    {betDrawerOpen && (
                      <div className="space-y-3 rounded-md border border-white/10 bg-black/30 p-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.25em] text-white/45">
                            <span>Stake</span>
                            <span className="text-white/60">
                              {connected ? `${maxStake.toFixed(3)} SOL max` : 'Connect wallet'}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={maxStake || 0}
                            step={0.001}
                            value={sliderValue}
                            onChange={e => {
                              const next = parseFloat(e.target.value);
                              if (!Number.isFinite(next)) return;
                              setBetAmount(next.toFixed(3));
                            }}
                            disabled={!connected || maxStake === 0 || !!actionLoading}
                            className="w-full accent-[var(--accent)] disabled:opacity-40"
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="relative flex-1">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.001"
                              placeholder="0.001"
                              value={betAmount}
                              onChange={e => setBetAmount(e.target.value)}
                              disabled={!!actionLoading}
                              className="w-full rounded-md border border-white/10 bg-black/40 px-3 pr-12 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 disabled:opacity-60"
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs uppercase tracking-[0.25em] text-white/50">SOL</span>
                          </div>
                        </div>
                        <div className="flex gap-2 overflow-x-auto">
                          {quickStakePresets.map(preset => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => {
                                const next = parseFloat(preset);
                                if (!Number.isFinite(next)) return;
                                const clamped = Math.min(next, maxStake || next);
                                setBetAmount(clamped.toFixed(3));
                              }}
                              disabled={!!actionLoading}
                              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-50 whitespace-nowrap"
                            >
                              {preset} SOL
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={!!actionLoading}
                          onClick={submitBet}
                          className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:opacity-60"
                        >
                          {actionLoading ? '...' : betActionLabel}
                        </button>
                      </div>
                    )}
                    {ticket && ticket.side !== sideChoice && (
                      <p className="text-[11px] text-amber-400">Existing tickets are locked to {ticket.side === 0 ? labelOver : labelUnder}.</p>
                    )}
                  </div>
                )}

                {userWon && !noWinner && (
                  <button
                    disabled={actionLoading === 'claim'}
                    onClick={() => run('claim', () => claimWinnings(wallet, selectedAuthority || undefined))}
                    className="btn w-full btn-sm bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white border-transparent"
                  >
                    {actionLoading === 'claim' ? '...' : 'Claim Payout'}
                  </button>
                )}
                {canManualCloseTicket && !noWinner && (
                  <button
                    disabled={actionLoading === 'close_ticket'}
                    onClick={() => run('close_ticket', () => closeTicket(wallet, selectedAuthority || undefined))}
                    className="btn w-full btn-sm border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10"
                  >
                    {actionLoading === 'close_ticket' ? '...' : 'Clear Position'}
                  </button>
                )}
                {ticket && marketResolved && noWinner && (
                  <p className="text-[11px] text-amber-400">Nobody backed the winner — entire pot becomes fees.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-dim">
                  {userIsAuthority
                    ? 'No active poll yet. Open the Streamer Studio to launch one.'
                    : 'No active poll yet for this host.'}
                </p>
                {userIsAuthority && (
                  <Link
                    href="/studio"
                    className="inline-flex items-center justify-center rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    Go to Streamer Studio
                  </Link>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="space-y-2 text-[10px]">
        {!connected && (<p className="text-yellow-400">Connect a wallet to host or join a poll.</p>)}
        {lastSignature && (<p className="break-all text-emerald-400">Last tx: {lastSignature}</p>)}
  {error && <p className="break-all text-[color:var(--accent)]">Error: {error}</p>}
      </div>
    </main>
  );
}

function ViewerStream({ authority }: { authority: string }) {
  const [playback, setPlayback] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/stream?authority=${authority}`);
        if (!res.ok) return;
        const j = await res.json();
        if (active) {
          if (j.stream?.playbackUrl) setPlayback(j.stream.playbackUrl);
        }
      } finally { /* no-op */ }
    }
    load();
    const id = setInterval(load, 6000);
    return () => { active = false; clearInterval(id); };
  }, [authority]);

  const [overlay, setOverlay] = useState<{
    title: string;
    yesPct: number;
    noPct: number;
    bets?: number;
    labelYes?: string;
    labelNo?: string;
    secondsLeft?: number;
  } | null>(null);
  useEffect(() => {
    const onOverlay = (event: Event) => {
      const { detail } = event as CustomEvent<PredictionOverlayDetail | null>;
      if (!detail) { setOverlay(null); return; }
      setOverlay({
        title: typeof detail.title === 'string' ? detail.title : 'Live Prediction',
        yesPct: typeof detail.yesPct === 'number' ? detail.yesPct : 0,
        noPct: typeof detail.noPct === 'number' ? detail.noPct : 0,
        bets: typeof detail.bets === 'number' ? detail.bets : undefined,
        labelYes: typeof detail.labelYes === 'string' && detail.labelYes.trim() ? detail.labelYes : undefined,
        labelNo: typeof detail.labelNo === 'string' && detail.labelNo.trim() ? detail.labelNo : undefined,
        secondsLeft: typeof detail.secondsLeft === 'number' ? detail.secondsLeft : undefined,
      });
    };
    window.addEventListener('prediction-overlay', onOverlay as EventListener);
    return () => window.removeEventListener('prediction-overlay', onOverlay as EventListener);
  }, []);

  return (
    <div className="relative group">
      <StreamPlayer playbackUrl={playback || undefined}>
        {overlay && (
          <PredictionOverlay
            title={overlay.title}
            yesPct={overlay.yesPct}
            noPct={overlay.noPct}
            betsCount={overlay.bets}
            labelYes={overlay.labelYes}
            labelNo={overlay.labelNo}
            secondsLeft={overlay.secondsLeft}
          />
        )}
      </StreamPlayer>
    </div>
  );
}