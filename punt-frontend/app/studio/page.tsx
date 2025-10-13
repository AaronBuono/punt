"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useToast } from "@/components/ToastProvider";
import {
  initializeMarket,
  freezeMarket,
  resolveMarket,
  withdrawFees,
  closeMarket,
  fetchMarket,
  ParsedBetMarket,
} from "@/lib/solana";
import { HostStreamPanel } from "@/components/stream/HostStreamPanel";
import { ChatPanel } from "@/components/stream/ChatPanel";
import { PollSummaryBar } from "@/components/PollSummaryBar";
import { PollStatCards } from "@/components/PollStatCards";
import { ChevronDown } from "lucide-react";

export default function StudioPage() {
  const wallet = useWallet();
  const { publicKey, connected } = wallet;
  const { addToast } = useToast();

  const [market, setMarket] = useState<ParsedBetMarket | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastSignature, setLastSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [title, setTitle] = useState("");
  const [labelYes, setLabelYes] = useState("");
  const [labelNo, setLabelNo] = useState("");
  const [feeBpsInput, setFeeBpsInput] = useState("20");
  const [quickPollBuyIn, setQuickPollBuyIn] = useState<number>(25);
  const [quickPollBuyInInput, setQuickPollBuyInInput] = useState<string>("25");
  const [customFormOpen, setCustomFormOpen] = useState(false);
  const feeBpsNumber = () => {
    const n = parseInt(feeBpsInput.trim(), 10);
    return isNaN(n) ? undefined : n;
  };

  const refresh = useCallback(async () => {
    try {
      if (!publicKey) { setMarket(null); return null; }
      const m = await fetchMarket(wallet, undefined);
      const next = m?.data || null;
      setMarket(next);
      return next;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [publicKey, wallet]);

  useEffect(() => { refresh(); }, [refresh]);

  type TxResult = { txSig?: string } | void;
  const hasSig = (v: unknown): v is { txSig: string } => !!v && typeof v === 'object' && 'txSig' in v && typeof (v as { txSig: unknown }).txSig === 'string';
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const fingerprint = (m: ParsedBetMarket | null) => {
    if (!m) return 'null';
    return [m.cycle, m.poolYes, m.poolNo, Number(m.resolved), Number(m.frozen), m.feesAccrued, m.winningSide].join(':');
  };

  const run = async <T extends TxResult>(label: string, fn: () => Promise<T>) => {
    let succeeded = false;
    const beforeFinger = fingerprint(market);
    try {
      setError(null);
      setActionLoading(label);
      const res = await fn();
      if (hasSig(res)) {
        setLastSignature(res.txSig);
        addToast({ type: "success", message: `${label} tx: ${res.txSig.slice(0,8)}...` });
        try {
          if (publicKey) {
            const auth = publicKey.toBase58();
            const sysMsgMap: Record<string,string> = {
              init: '🟢 Poll created by host',
              freeze: '🧊 Poll frozen by host',
              resolve_yes: '🏁 Result set: YES wins',
              resolve_no: '🏁 Result set: NO wins',
              withdraw: '📤 Host fees withdrawn',
              close: '📁 Poll archived',
            };
            if (sysMsgMap[label]) {
              fetch('/api/chat', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ authority: auth, text: sysMsgMap[label], type: 'system' }) }).catch(()=>{});
            }
          }
        } catch {/* ignore */}
      }
      succeeded = true;
    } catch (e) {
      const err = e as Error;
      setError(err.message);
      addToast({ type: "error", message: err.message || `${label} failed` });
    } finally {
      setActionLoading(null);
    }

    if (succeeded) {
      const maxAttempts = 8;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const current = await refresh();
        if (fingerprint(current ?? null) !== beforeFinger) break;
        await sleep(400 + attempt * 150);
      }
    }

    return succeeded;
  };
 

  const shareUrl = useMemo(() => {
    if (!publicKey) return "";
    const auth = publicKey.toBase58();
    if (typeof window === 'undefined') return `/?authority=${auth}`;
    const u = new URL(window.location.origin);
    u.searchParams.set('authority', auth);
    return u.toString();
  }, [publicKey]);

  const initMarket = () => run('init', () => initializeMarket(wallet, { title, labelYes, labelNo, feeBps: feeBpsNumber() }));

  const clampBuyIn = (value: number) => {
    if (!Number.isFinite(value)) return 1;
    return Math.min(1000, Math.max(1, Math.round(value)));
  };

  const updateQuickPollBuyIn = (value: number) => {
    const clamped = clampBuyIn(value);
    setQuickPollBuyIn(clamped);
    setQuickPollBuyInInput(String(clamped));
    return clamped;
  };

  const handleQuickPollSlider = (value: number) => {
    updateQuickPollBuyIn(value);
  };

  const handleQuickPollInputChange = (value: string) => {
    const sanitized = value.replace(/[^0-9]/g, "");
    setQuickPollBuyInInput(sanitized);
    if (!sanitized) return;
    const parsed = parseInt(sanitized, 10);
    if (!Number.isNaN(parsed)) {
      updateQuickPollBuyIn(parsed);
    }
  };

  const handleQuickPollInputBlur = () => {
    if (!quickPollBuyInInput) {
      updateQuickPollBuyIn(quickPollBuyIn);
      return;
    }
    const parsed = parseInt(quickPollBuyInInput, 10);
    if (Number.isNaN(parsed)) {
      updateQuickPollBuyIn(quickPollBuyIn);
      return;
    }
    updateQuickPollBuyIn(parsed);
  };

  const formatBuyIn = (value: number) => `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

  const launchQuickPoll = async () => {
    if (!connected) return;
    const buyIn = clampBuyIn(quickPollBuyIn);
    const question = `Will this pack be over or under ${formatBuyIn(buyIn)}?`;
    const defaultYes = "OVER";
    const defaultNo = "UNDER";
    const ok = await run('init', () => initializeMarket(wallet, { title: question, labelYes: defaultYes, labelNo: defaultNo, feeBps: 20 }));
    if (ok && publicKey) {
      const auth = publicKey.toBase58();
      fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authority: auth,
          text: `🎯 Quick poll launched: ${formatBuyIn(buyIn)} entry • ${defaultYes} vs ${defaultNo}.`,
          type: 'system',
        }),
      }).catch(() => {});
    }
  };

  return (
    <main className="relative w-full py-8 px-6 xl:px-10 flex flex-col gap-8 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight gradient-text">Streamer Studio</h1>
          <p className="text-sm text-dim">Go live, manage your stream, and control your live poll.</p>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-wide text-dim">
          {market && !market.resolved && <span className="tag" style={{background:"linear-gradient(90deg,#7f1d1d,#b91c1c,#dc2626)"}}>Live</span>}
          {market && market.resolved && <span className="tag" style={{background:"linear-gradient(90deg,#27272a,#3f3f46)"}}>Closed</span>}
          {publicKey && (
            <Link href={shareUrl || '/'} className="btn btn-sm" target="_blank">Viewer Link</Link>
          )}
        </div>
      </header>

      {!connected && (
        <div className="panel p-4 text-[12px]">
          Connect a wallet to manage your stream and poll.
        </div>
      )}

      {/* Layout: Left stream tools, right poll tools */}
      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-4">
          <div className="panel p-4">
            <h2 className="card-header mb-3">Livestream</h2>
            <HostStreamPanel />
          </div>
          <div className="panel p-4">
            <h2 className="card-header mb-3">Chat</h2>
            <ChatPanel authority={publicKey?.toBase58?.() || 'self'} />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">
          <section className="panel p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="card-header">Live Poll</h2>
              {market && !market.resolved && (
                <span className={`text-[10px] font-semibold ${market.frozen ? 'text-amber-300' : 'text-emerald-400'}`}>
                  {market.frozen ? 'FROZEN' : 'LIVE'}
                </span>
              )}
            </div>
            {market ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold tracking-tight mb-1 flex items-center gap-2">
                    {market.title || 'Untitled Market'}
                  </p>
                  <p className="text-[11px] text-dim">Host: {market.authority}</p>
                </div>
                <div className="space-y-3">
                  <PollSummaryBar poolYes={market.poolYes} poolNo={market.poolNo} labelYes={market.labelYes} labelNo={market.labelNo} />
                </div>
                <PollStatCards market={market} />

                <div className="flex flex-wrap gap-2 pt-2">
                  {!market.resolved && (
                    <>
                      {!market.frozen && (
                        <p className="w-full text-[11px] text-white/70 bg-white/5 border border-white/10 rounded-md px-3 py-2">
                          Freeze the poll to lock in wagers before selecting a result.
                        </p>
                      )}
                      {market.frozen && (
                        <p className="w-full text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/40 rounded-md px-3 py-2">
                          Poll frozen. Set the winning option when ready.
                        </p>
                      )}
                      <button
                        disabled={market.frozen || actionLoading==='freeze'}
                        onClick={() => run('freeze', () => freezeMarket(wallet))}
                        className="btn btn-sm btn-warning"
                      >
                        {actionLoading==='freeze' ? '...' : 'Freeze Poll'}
                      </button>
                      <button disabled={!market.frozen || !!actionLoading} onClick={() => run('resolve_yes', () => resolveMarket(wallet, 0))} className="btn btn-sm btn-success">{actionLoading==='resolve_yes'?"...":`Set: ${market.labelYes || 'YES'}`}</button>
                      <button disabled={!market.frozen || !!actionLoading} onClick={() => run('resolve_no', () => resolveMarket(wallet, 1))} className="btn btn-sm btn-danger">{actionLoading==='resolve_no'?"...":`Set: ${market.labelNo || 'NO'}`}</button>
                    </>
                  )}
                  {market.feesAccrued > 0 && (
                    <button disabled={actionLoading==='withdraw'} onClick={() => run('withdraw', () => withdrawFees(wallet))} className="btn btn-sm btn-warning">{actionLoading==='withdraw'?'...':'Collect Host Fees'}</button>
                  )}
                  {market.resolved && market.feesAccrued === 0 && (
                    <button disabled={actionLoading==='close'} onClick={() => run('close', () => closeMarket(wallet))} className="btn btn-sm btn-outline">{actionLoading==='close'?'...':'Archive Poll'}</button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-dim">No active poll yet. Launch a quick default poll or craft a custom one below.</p>
                <div className="space-y-4 rounded-md border border-white/10 bg-black/25 p-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">Quick Over/Under Poll</h3>
                    <p className="text-[11px] text-white/60">Default question and labels are prefilled. Adjust the buy-in and launch instantly.</p>
                    <div className="rounded-md border border-white/5 bg-black/30 px-3 py-2 text-[11px] text-white/70">
                      <p className="font-semibold text-white">{`Will this pack be over or under ${formatBuyIn(quickPollBuyIn)}?`}</p>
                      <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
                        <span>Option 1: OVER</span>
                        <span>Option 2: UNDER</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={1}
                      max={1000}
                      step={1}
                      value={quickPollBuyIn}
                      onChange={e => handleQuickPollSlider(parseInt(e.target.value, 10))}
                      disabled={!!actionLoading || !connected}
                      className="w-full accent-[var(--accent)] disabled:opacity-40"
                    />
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={1000}
                        step={1}
                        value={quickPollBuyInInput}
                        onChange={e => handleQuickPollInputChange(e.target.value)}
                        onBlur={handleQuickPollInputBlur}
                        disabled={!!actionLoading || !connected}
                        className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 disabled:opacity-60"
                      />
                      <span className="text-xs uppercase tracking-[0.25em] text-white/50">USD</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={launchQuickPoll}
                    disabled={!!actionLoading || !connected}
                    className="w-full rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent)]/90 disabled:opacity-60"
                  >
                    {actionLoading === 'init' ? '...' : 'Launch Quick Poll'}
                  </button>
                </div>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setCustomFormOpen(open => !open)}
                    className="flex w-full items-center justify-between rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                    aria-expanded={customFormOpen}
                  >
                    <span>Custom Poll</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${customFormOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {customFormOpen && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <label className="flex flex-col gap-1 col-span-2">
                          <span className="text-dim">Poll Question</span>
                          <input value={title} onChange={e=>setTitle(e.target.value)} className="bg-white/5 border border-white/10 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50" maxLength={64} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-dim">Label 1</span>
                          <input value={labelYes} onChange={e=>setLabelYes(e.target.value)} className="bg-white/5 border border-white/10 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50" maxLength={32} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-dim">Label 2</span>
                          <input value={labelNo} onChange={e=>setLabelNo(e.target.value)} className="bg-white/5 border border-white/10 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50" maxLength={32} />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="text-dim">Your Fee (bps)</span>
                          <input value={feeBpsInput} onChange={e=>setFeeBpsInput(e.target.value)} className="bg-white/5 border border-white/10 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/50" placeholder="20" />
                        </label>
                      </div>
                      <button disabled={!connected || actionLoading==='init'} onClick={initMarket} className="btn w-full btn-sm">{actionLoading==='init'?'...':'Launch Poll'}</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="space-y-2 text-[10px]">
        {!connected && (
          <p className="text-yellow-400">Connect a wallet to host and manage your poll.</p>
        )}
        {lastSignature && (
          <p className="break-all text-emerald-400">Last tx: {lastSignature}</p>
        )}
  {error && <p className="break-all text-[color:var(--accent)]">Error: {error}</p>}
      </div>
    </main>
  );
}
