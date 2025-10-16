"use client";
import Link from "next/link";
import { useEffect, useState, useCallback, useRef, useMemo, useLayoutEffect, type Dispatch, type SetStateAction } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ChevronsUpDown } from "lucide-react";
import {
  bet,
  freezeMarket,
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

const PYTH_PRICE_FEEDS = {
  SOL_USD: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  EUR_USD: "a995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
  GBP_USD: "84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1",
  AUD_USD: "67a6f93030420c1c9e3fe37c1ab6b77966af82f995944a9fefce357a22854a80",
  USD_JPY: "ef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52",
  USD_CAD: "3112b03a41c910ed446852aacf67118cb1bec67b2cd0b9a214c58cc0eaa2ecca",
} as const;

const CURRENCY_CONFIG = [
  { code: "USD", label: "USD", locale: "en-US", currency: "USD", maximumFractionDigits: 2 },
  { code: "EUR", label: "EUR", locale: "en-GB", currency: "EUR", maximumFractionDigits: 2 },
  { code: "GBP", label: "GBP", locale: "en-GB", currency: "GBP", maximumFractionDigits: 2 },
  { code: "AUD", label: "AUD", locale: "en-AU", currency: "AUD", maximumFractionDigits: 2 },
  { code: "CAD", label: "CAD", locale: "en-CA", currency: "CAD", maximumFractionDigits: 2 },
  { code: "JPY", label: "JPY", locale: "ja-JP", currency: "JPY", maximumFractionDigits: 0 },
] as const;

type SupportedCurrency = (typeof CURRENCY_CONFIG)[number]["code"];

type FeedPrice = {
  price: number;
  publishTime: number | null;
};

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
  const [pythPrices, setPythPrices] = useState<Record<string, FeedPrice>>({});
  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>("USD");
  const [streamMeta, setStreamMeta] = useState<{ active: boolean; viewerCount: number; title: string | null } | null>(null);
  const [betCount, setBetCount] = useState<number | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const selectedAuthorityBase58 = selectedAuthority?.toBase58() || null;
  const scrollToTop = useCallback(() => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, behavior: "auto" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (ticket) {
      setSideChoice(ticket.side as 0 | 1);
    } else {
      setSideChoice(0);
    }
  }, [ticket]);

  const refresh = useCallback(async () => {
    let nextMarket: ParsedBetMarket | null = null;
    let nextTicket: ParsedBetTicket | null = null;
    try {
      if (!publicKey) {
        if (selectedAuthority) {
          const m = await fetchMarketPublic(selectedAuthority);
          nextMarket = m?.data || null;
        }
      } else if (selectedAuthority && selectedAuthority.toBase58() !== publicKey.toBase58()) {
        const m = await fetchMarketPublic(selectedAuthority);
        nextMarket = m?.data || null;
        if (nextMarket) {
          const t = await fetchTicket(wallet, selectedAuthority);
          nextTicket = t?.data || null;
        }
      } else {
        const m = await fetchMarket(wallet, undefined);
        nextMarket = m?.data || null;
        if (nextMarket) {
          const t = await fetchTicket(wallet, undefined);
          nextTicket = t?.data || null;
        }
      }
    } catch (e) {
      console.error(e);
    }
    setMarket(nextMarket);
    setTicket(nextTicket);
    return { market: nextMarket, ticket: nextTicket };
  }, [publicKey, wallet, selectedAuthority]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await refresh();
      if (!cancelled) setIsInitialLoad(false);
    })();
    return () => { cancelled = true; };
  }, [refresh]);

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

  useLayoutEffect(() => {
    scrollToTop();
  }, [scrollToTop, selectedAuthorityBase58]);

  useEffect(() => {
    const id = setTimeout(scrollToTop, 75);
    return () => clearTimeout(id);
  }, [scrollToTop, selectedAuthorityBase58]);

  useEffect(() => {
    let cancelled = false;
    const feedIds = [
      PYTH_PRICE_FEEDS.SOL_USD,
      PYTH_PRICE_FEEDS.EUR_USD,
      PYTH_PRICE_FEEDS.GBP_USD,
      PYTH_PRICE_FEEDS.AUD_USD,
      PYTH_PRICE_FEEDS.USD_JPY,
      PYTH_PRICE_FEEDS.USD_CAD,
    ];

    const buildUrl = () => {
      const params = new URLSearchParams();
      feedIds.forEach(id => params.append('ids[]', id));
      params.set('parsed', 'true');
      params.set('ignore_invalid_price_ids', 'true');
      return `https://hermes.pyth.network/v2/updates/price/latest?${params.toString()}`;
    };

    const load = async () => {
      try {
        const res = await fetch(buildUrl(), { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const parsed = Array.isArray(json?.parsed) ? json.parsed : [];
        const next: Record<string, FeedPrice> = {};
        for (const entry of parsed) {
          const id = typeof entry?.id === 'string' ? entry.id : null;
          const priceObj = entry?.price;
          if (!id || !priceObj) continue;
          const mantissa = Number(priceObj.price);
          const expo = typeof priceObj.expo === 'number' ? priceObj.expo : null;
          if (!Number.isFinite(mantissa) || expo === null) continue;
          const value = mantissa * Math.pow(10, expo);
          if (!Number.isFinite(value)) continue;
          const publishTime = typeof priceObj.publish_time === 'number' ? priceObj.publish_time : null;
          next[id] = { price: value, publishTime };
        }
        if (next[PYTH_PRICE_FEEDS.SOL_USD] && !cancelled && Object.keys(next).length > 0) {
          setPythPrices(prev => ({ ...prev, ...next }));
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[watch] failed to load Pyth prices', err);
        }
      }
    };

    load();
    const id = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const handler = () => fetchBalance();
    window.addEventListener('refresh-balance', handler);
    return () => window.removeEventListener('refresh-balance', handler);
  }, [fetchBalance]);

  const maxStake = Number.isFinite(walletBalance) && walletBalance > 0 ? walletBalance : 0;
  const sliderValue = useMemo(() => {
    const parsed = parseFloat(betAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    const usableMax = Math.max(maxStake, 0.01);
    const rangeMin = 0.001;
    const clamp = Math.min(Math.max(parsed, rangeMin), usableMax);
    const ratio = usableMax === rangeMin ? 1 : Math.log10(clamp / rangeMin) / Math.log10(usableMax / rangeMin);
    return Math.round(ratio * 1000);
  }, [betAmount, maxStake]);

  // Broadcast overlay updates to the StreamPlayer consumer
  // - Computes YES/NO percentages from the current market pools
  // - Optionally enriches with an approximate bets count by scanning system chat messages
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!market || market.resolved) {
      // Clear overlay when no active market
      setBetCount(null);
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
      setBetCount(null);
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
          setBetCount(null);
          window.dispatchEvent(new CustomEvent('prediction-overlay', { detail: null }));
          return;
        }
  const total = (market.poolYes + market.poolNo) || 0;
  const hasVolume = total > 0;
  const yesPct = hasVolume ? (market.poolYes / total) * 100 : 50;
  const noPct = hasVolume ? 100 - yesPct : 50;
        setBetCount(count);
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
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  const fingerprintMarket = (m: ParsedBetMarket | null) => {
    if (!m) return 'market:none';
    return [m.cycle, m.poolYes, m.poolNo, Number(m.frozen), Number(m.resolved), m.winningSide, m.feesAccrued].join(':');
  };
  const fingerprintTicket = (t: ParsedBetTicket | null) => {
    if (!t) return 'ticket:none';
    return [t.side, t.amount, Number(t.claimed)].join(':');
  };
  const snapshotState = (m: ParsedBetMarket | null, t: ParsedBetTicket | null) => `${fingerprintMarket(m)}|${fingerprintTicket(t)}`;
  const run = async <T extends TxResult>(label: string, fn: () => Promise<T>): Promise<boolean> => {
    let succeeded = false;
    const beforeSnapshot = snapshotState(market, ticket);
    try {
      if (busyRef.current) return false; // single-flight guard
      busyRef.current = true;
      setError(null);
      setActionLoading(label);
      // Tiny submitting toast for position and poll actions
  if (/^(bet_yes|bet_no|bet_more|claim|close_ticket|resolve_yes|resolve_no|withdraw|close|freeze)/.test(label)) {
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
            freeze: '🧊 Poll frozen by host',
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
      const maxAttempts = 10;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const latest = await refresh();
        const nextSnapshot = snapshotState(latest?.market ?? null, latest?.ticket ?? null);
        if (nextSnapshot !== beforeSnapshot) break;
        await sleep(400 + attempt * 200);
      }
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
  const lockPoll = Boolean(actionLoading && /^(resolve_yes|resolve_no|withdraw|close|freeze)/.test(actionLoading));
  const lockAny = lockPoll || lockPosition;
  const marketResolved = market?.resolved;
  const marketFrozen = market?.frozen;
  const freezeLoading = actionLoading === 'freeze';
  const userIsAuthority = !!market && market.authority === publicKey?.toBase58();
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
  const yesIdleClasses = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20 hover:border-emerald-400/60';
  const yesActiveClasses = 'border-transparent bg-emerald-500 text-gray-900 shadow-[0_0_15px_rgba(34,197,94,0.4)]';
  const noIdleClasses = 'border-[#b91c1c]/50 bg-[#7f1d1d]/40 text-[#fecaca] hover:bg-[#991b1b]/50 hover:border-[#dc2626]/60';
  const noActiveClasses = 'border-transparent bg-[#b91c1c] text-white shadow-[0_0_18px_rgba(185,28,28,0.45)]';
  const betActionLabel = ticket ? 'Add To Position' : `Confirm ${sideChoice === 0 ? labelOver : labelUnder}`;
  const betAmountNumber = parseFloat(betAmount || '0');
  const currencyFormatters = useMemo(() => {
    const result = {} as Record<SupportedCurrency, Intl.NumberFormat>;
    CURRENCY_CONFIG.forEach(cfg => {
      result[cfg.code] = new Intl.NumberFormat(cfg.locale, {
        style: 'currency',
        currency: cfg.currency,
        maximumFractionDigits: cfg.maximumFractionDigits ?? 2,
      });
    });
    return result;
  }, []);

  const solUsdPrice = pythPrices[PYTH_PRICE_FEEDS.SOL_USD]?.price ?? null;
  const currencyRates = useMemo(() => {
    const base: Record<SupportedCurrency, number | null> = {
      USD: null,
      EUR: null,
      GBP: null,
      AUD: null,
      CAD: null,
      JPY: null,
    };

    if (solUsdPrice === null || !Number.isFinite(solUsdPrice)) {
      return base;
    }

    base.USD = solUsdPrice;

    const eurUsd = pythPrices[PYTH_PRICE_FEEDS.EUR_USD]?.price ?? null;
    if (eurUsd && Number.isFinite(eurUsd)) {
      base.EUR = solUsdPrice / eurUsd;
    }

    const gbpUsd = pythPrices[PYTH_PRICE_FEEDS.GBP_USD]?.price ?? null;
    if (gbpUsd && Number.isFinite(gbpUsd)) {
      base.GBP = solUsdPrice / gbpUsd;
    }

    const audUsd = pythPrices[PYTH_PRICE_FEEDS.AUD_USD]?.price ?? null;
    if (audUsd && Number.isFinite(audUsd)) {
      base.AUD = solUsdPrice / audUsd;
    }

    const usdJpy = pythPrices[PYTH_PRICE_FEEDS.USD_JPY]?.price ?? null;
    if (usdJpy && Number.isFinite(usdJpy)) {
      base.JPY = solUsdPrice * usdJpy;
    }

    const usdCad = pythPrices[PYTH_PRICE_FEEDS.USD_CAD]?.price ?? null;
    if (usdCad && Number.isFinite(usdCad)) {
      base.CAD = solUsdPrice * usdCad;
    }

    return base;
  }, [solUsdPrice, pythPrices]);

  const selectedCurrencyRate = currencyRates[selectedCurrency];
  const betEstimate = selectedCurrencyRate !== null && Number.isFinite(betAmountNumber)
    ? Math.max(0, betAmountNumber) * selectedCurrencyRate
    : null;
  const formattedEstimate = betEstimate !== null
    ? currencyFormatters[selectedCurrency].format(betEstimate)
    : null;
  const poolYesLamports = market?.poolYes ?? 0;
  const poolNoLamports = market?.poolNo ?? 0;
  const ticketSideLabel = ticket ? (ticket.side === 0 ? labelOver : labelUnder) : null;
  const ticketAmountSol = ticket ? lamportsToSol(ticket.amount) : 0;
  const ticketSidePoolLamports = ticket ? (ticket.side === 0 ? poolYesLamports : poolNoLamports) : 0;
  const totalPoolLamports = ticket ? poolYesLamports + poolNoLamports : 0;
  const ticketSharePct = ticket && ticketSidePoolLamports > 0
    ? (ticket.amount / ticketSidePoolLamports) * 100
    : 0;
  const projectedPayoutLamports = ticket && ticketSidePoolLamports > 0
    ? Math.floor((ticket.amount / ticketSidePoolLamports) * totalPoolLamports)
    : 0;
  const projectedPayoutSol = projectedPayoutLamports > 0 ? lamportsToSol(projectedPayoutLamports) : 0;
  const authorityBase58 = selectedAuthorityBase58 || publicKey?.toBase58() || null;
  const hostShort = authorityBase58 ? `${authorityBase58.slice(0, 4)}…${authorityBase58.slice(-4)}` : 'No stream selected';
  const streamTitle = streamMeta?.title?.trim() || null;
  const streamTitleDisplay = streamTitle || hostShort;
  const totalPoolSol = market ? lamportsToSol(poolYesLamports + poolNoLamports) : 0;
  const yesShare = market ? ((poolYesLamports + poolNoLamports) > 0 ? (poolYesLamports / (poolYesLamports + poolNoLamports)) * 100 : 0) : 0;
  const noShare = market ? 100 - yesShare : 0;
  const viewerFormatter = useMemo(() => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }), []);
  const formattedViewers = streamMeta ? viewerFormatter.format(streamMeta.viewerCount || 0) : '—';
  const statusBadge = streamMeta?.active
    ? { label: 'Live', className: 'bg-emerald-500/15 text-emerald-300' }
    : { label: 'Offline', className: 'bg-white/10 text-white/70' };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const auth = params.get('authority');
    if (auth && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(auth)) {
      try { const pk = new PublicKey(auth); setSelectedAuthority(pk); } catch {/* ignore */}
    }
  }, []);

  // Streamer selection via sidebar removed; URL parameter is the only source now.

  const handleBet = async (side: 0 | 1) => {
    if (market?.frozen) {
      addToast({ type: "error", message: "Poll frozen – no new bets allowed." });
      return false;
    }
    setSideChoice(side);
    return run(side === 0 ? 'bet_yes' : 'bet_no', () => bet(wallet, { side, amountLamports: solToLamports(betAmount), marketAuthority: selectedAuthority || undefined }));
  };

  const submitBet = async () => {
    if (ticket) {
      if (market?.frozen) {
        addToast({ type: "error", message: "Poll frozen – no new bets allowed." });
        return;
      }
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

  useEffect(() => {
    if (marketFrozen) {
      setBetDrawerOpen(false);
    }
  }, [marketFrozen]);

  if (!mounted) {
    return (
      <main className="p-8 flex flex-col items-center gap-4 max-w-lg mx-auto text-center">
        <p className="text-sm text-gray-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className={`relative w-full py-6 px-4 sm:px-6 xl:px-8 flex flex-col gap-6 max-w-[1500px] mx-auto`}>

      {!selectedAuthority && (
        <div className="panel p-5 text-sm text-dim">No stream selected. Go to the home page and choose a stream.</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,1.05fr)] gap-4 items-start">
  <div className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start lg:h-fit">
          {selectedAuthority && (
            <div className="panel p-0 overflow-hidden lg:shadow-2xl">
              <div className="relative w-full bg-black aspect-video lg:min-h-[460px]">
                <ViewerStream authority={selectedAuthority.toBase58()} onMeta={setStreamMeta} />
              </div>
              <div className="border-t border-white/10 px-4 py-3 space-y-2">
                <div className="space-y-1">
                  <p className="text-sm sm:text-base font-semibold text-white break-words">{streamTitleDisplay}</p>
                  {authorityBase58 && (
                    <p className="text-[10px] text-white/45 font-mono">Host {authorityBase58}</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium border border-white/10 ${statusBadge.className}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${streamMeta?.active ? 'bg-emerald-300 animate-pulse' : 'bg-white/40'}`} />
                    {statusBadge.label}
                  </span>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1">
                    <span className="text-white/50 uppercase tracking-[0.25em]">Viewers</span>
                    <span className="font-semibold text-white">{formattedViewers}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1">
                    <span className="text-white/50 uppercase tracking-[0.25em]">Volume</span>
                    <span className="font-semibold text-white">{totalPoolSol > 0 ? `${totalPoolSol.toFixed(2)} SOL` : '—'}</span>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1">
                    <span className="text-white/50 uppercase tracking-[0.25em]">Bets</span>
                    <span className="font-semibold text-white">{betCount !== null ? betCount : '—'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
  </div>
  <div className="flex flex-col gap-4">
          <section className={`panel p-5 space-y-5 relative ${lockAny ? 'opacity-60' : ''}`}>
            {lockAny && (
              <div className="absolute inset-0 z-10 rounded-[inherit] bg-black/30 backdrop-blur-[2px] flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              </div>
            )}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/45">Live Poll</p>
                <h2 className="mt-1 text-lg font-semibold leading-tight text-white">{market?.title || 'Untitled Market'}</h2>
              </div>
              {market && (
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wide border ${market.resolved ? 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10' : market.frozen ? 'border-amber-400/40 text-amber-200 bg-amber-500/10' : 'border-emerald-400/30 text-emerald-300 bg-emerald-500/10'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${market.resolved ? 'bg-emerald-300' : market.frozen ? 'bg-amber-200' : 'bg-emerald-300 animate-pulse'}`} />
                  {market.resolved ? 'Resolved' : market.frozen ? 'Frozen' : 'Live'}
                </span>
              )}
            </div>
            {isInitialLoad ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-4 rounded bg-white/10" />
                <div className="h-24 rounded-md bg-white/5" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 rounded-md bg-white/5" />
                  <div className="h-16 rounded-md bg-white/5" />
                </div>
                <div className="h-9 rounded-md bg-white/5" />
                <div className="h-9 rounded-md bg-white/5" />
              </div>
            ) : market ? (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3" style={{ minWidth: 0 }}>
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>Total Pot</span>
                      <span className="font-semibold text-white">{totalPoolSol > 0 ? `${totalPoolSol.toFixed(2)} SOL` : '—'}</span>
                    </div>
                    <PollSummaryBar poolYes={market.poolYes} poolNo={market.poolNo} labelYes={market.labelYes} labelNo={market.labelNo} variant="viewer" />
                    <div className="grid grid-cols-2 gap-2 text-[11px] text-white/70">
                      <div className="rounded-md border border-white/5 bg-white/5 px-3 py-2">
                        <p className="uppercase tracking-[0.25em] text-white/40">{market.labelYes || 'YES'}</p>
                        <p className="text-sm font-semibold text-white mt-1">{yesShare > 0 ? `${yesShare.toFixed(yesShare >= 10 ? 1 : 2)}%` : '—'}</p>
                      </div>
                      <div className="rounded-md border border-white/5 bg-white/5 px-3 py-2">
                        <p className="uppercase tracking-[0.25em] text-white/40">{market.labelNo || 'NO'}</p>
                        <p className="text-sm font-semibold text-white mt-1">{noShare > 0 ? `${noShare.toFixed(noShare >= 10 ? 1 : 2)}%` : '—'}</p>
                      </div>
                    </div>
                    {betCount !== null && (
                      <div className="flex items-center justify-between text-[11px] text-white/60 pt-1">
                        <span>Bets placed</span>
                        <span className="font-medium text-white">{betCount}</span>
                      </div>
                    )}
                  </div>
                  {market.resolved && (
                    <div className="rounded-md bg-white/5 border border-white/10 px-3 py-2 text-[11px] text-white/80">
                      Outcome: <span className="font-semibold">{market.winningSide === 0 ? (market.labelYes || 'YES') : (market.labelNo || 'NO')}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {userIsAuthority && !market.resolved && (
                    <>
                      <button
                        type="button"
                        disabled={market.frozen || !!actionLoading}
                        onClick={() => run('freeze', () => freezeMarket(wallet))}
                        className="btn btn-sm border border-amber-300 text-amber-200 hover:bg-amber-300/10"
                      >
                        {freezeLoading ? '...' : 'Freeze Poll'}
                      </button>
                      {!market.frozen && (
                        <div className="w-full text-[11px] text-white/70 bg-white/5 border border-white/10 rounded-md px-3 py-2">
                          Freeze the poll before choosing the winning option.
                        </div>
                      )}
                      {market.frozen && (
                        <div className="w-full text-[11px] text-emerald-300/90 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-3 py-2">
                          Poll frozen. Select the winning side below.
                        </div>
                      )}
                      <button type="button" disabled={!market.frozen || !!actionLoading} onClick={() => run('resolve_yes', () => resolveMarket(wallet, 0))} className="btn btn-sm bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-contrast)] border-transparent">
                        {actionLoading === 'resolve_yes' ? '...' : `Set: ${market.labelYes || 'YES'}`}
                      </button>
                      <button type="button" disabled={!market.frozen || !!actionLoading} onClick={() => run('resolve_no', () => resolveMarket(wallet, 1))} className="btn btn-sm bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-contrast)] border-transparent">
                        {actionLoading === 'resolve_no' ? '...' : `Set: ${market.labelNo || 'NO'}`}
                      </button>
                    </>
                  )}
                  {userIsAuthority && market.feesAccrued > 0 && (
                    <button type="button" disabled={!!actionLoading} onClick={() => run('withdraw', () => withdrawFees(wallet))} className="btn btn-sm bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-contrast)] border-transparent">
                      {actionLoading ? '...' : 'Collect Host Fees'}
                    </button>
                  )}
                  {userIsAuthority && market.resolved && market.feesAccrued === 0 && (
                    <button type="button" disabled={!!actionLoading} onClick={() => run('close', () => closeMarket(wallet))} className="btn btn-sm border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10">
                      {actionLoading ? '...' : 'Archive Poll'}
                    </button>
                  )}
                </div>

                {ticket && !market?.frozen && (
                  <div className="space-y-2 rounded-md border border-white/10 bg-black/25 p-4 text-xs text-white/75">
                    <div className="flex items-center justify-between">
                      <span className="uppercase tracking-[0.2em] text-white/50">Side</span>
                      <span className="text-sm font-semibold text-white">{ticketSideLabel}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="uppercase tracking-[0.2em] text-white/50">Amount</span>
                      <span className="text-sm font-semibold text-white">{ticketAmountSol.toFixed(3)} SOL</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="uppercase tracking-[0.2em] text-white/50">Status</span>
                      <span className="text-sm font-semibold text-white">{ticket.claimed ? 'Claimed' : (marketResolved ? 'Awaiting Claim' : (market?.frozen ? 'Frozen' : 'Live'))}</span>
                    </div>
                  </div>
                )}

                {ticket && market?.frozen && !marketResolved && (
                  <div className="space-y-1 rounded-md border border-emerald-300/40 bg-emerald-500/10 p-4 text-xs text-emerald-100">
                    <p className="text-sm font-semibold text-emerald-50">
                      Position locked: {ticketAmountSol.toFixed(3)} SOL on {ticketSideLabel}
                    </p>
                    <p className="text-emerald-200/80">
                      Share of pool: {ticketSharePct > 0 ? `${ticketSharePct.toFixed(ticketSharePct >= 10 ? 1 : 2)}%` : '—'}
                    </p>
                    {projectedPayoutSol > 0 && (
                      <p className="text-emerald-200/80">
                        Potential payout if {ticketSideLabel} wins: {projectedPayoutSol.toFixed(3)} SOL
                      </p>
                    )}
                  </div>
                )}

                {!userIsAuthority && !market.resolved && (
                  <div className="space-y-3 border-t border-white/10 pt-3">
                    {market.frozen && (
                      <div className="rounded-md border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                        Poll frozen. Betting is closed.
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {[0, 1].map(option => {
                        const chosen = sideChoice === option;
                        const disabled = !!actionLoading || market.frozen || (!!ticket && ticket.side !== option);
                        const label = option === 0 ? labelOver : labelUnder;
                        const palette = option === 0
                          ? (chosen ? yesActiveClasses : yesIdleClasses)
                          : (chosen ? noActiveClasses : noIdleClasses);
                        const baseChoiceClasses = 'rounded-md px-3 py-2 text-sm font-semibold transition border focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20';
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => setSideChoice(option as 0 | 1)}
                            disabled={disabled}
                            className={`${baseChoiceClasses} ${palette} ${disabled && !chosen ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setBetDrawerOpen(open => !open)}
                      disabled={!!actionLoading || market.frozen}
                      className={`w-full rounded-md px-3 py-2 text-sm font-semibold transition border focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed ${
                        sideChoice === 0
                          ? 'border-emerald-500 bg-emerald-500 text-gray-900 hover:bg-emerald-400'
                          : 'border-[#b91c1c] bg-[#b91c1c] text-white hover:bg-[#dc2626]'
                      }`}
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <span>{market.frozen ? 'Betting Frozen' : betDrawerOpen ? 'Hide Bet Options' : 'Place Bet'}</span>
                        <ChevronsUpDown className={`w-4 h-4 ${betDrawerOpen ? 'rotate-180' : ''} transition-transform duration-200 ${market.frozen ? '' : 'animate-bounce'}`} />
                      </span>
                    </button>
                    {betDrawerOpen && (
                      <div className="space-y-3 rounded-md border border-white/10 bg-black/30 p-4 w-full">
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
                            max={1000}
                            step={1}
                            value={sliderValue}
                            onChange={e => {
                              const raw = parseFloat(e.target.value);
                              if (!Number.isFinite(raw)) return;
                              const usableMax = Math.max(maxStake, 0.01);
                              const rangeMin = 0.001;
                              const progress = Math.min(Math.max(raw / 1000, 0), 1);
                              const nextAmount = rangeMin * Math.pow(usableMax / rangeMin, progress);
                              const clamped = Math.min(nextAmount, usableMax);
                              setBetAmount(clamped.toFixed(3));
                            }}
                            disabled={!connected || maxStake === 0 || !!actionLoading || market.frozen}
                            className="w-full accent-[var(--accent)] disabled:opacity-40"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
                          <div className="relative flex-[1_1_160px] min-w-[140px]">
                            <input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              step="0.001"
                              placeholder="0.001"
                              value={betAmount}
                              onChange={e => setBetAmount(e.target.value)}
                              disabled={!!actionLoading || market.frozen}
                              className="w-full rounded-md border border-white/10 bg-black/40 pl-3 pr-10 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 disabled:opacity-60"
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm text-white">SOL</span>
                          </div>
                          <div className="flex items-center gap-1 flex-1 min-w-[150px]">
                            <div className="relative flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white h-[38px]">
                              <span className="whitespace-nowrap">{formattedEstimate ? `~ ${formattedEstimate}` : '~ —'}</span>
                              <select
                                value={selectedCurrency}
                                onChange={e => setSelectedCurrency(e.target.value as SupportedCurrency)}
                                className="bg-transparent text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 border-none appearance-none pr-6"
                              >
                                {CURRENCY_CONFIG.map(option => (
                                  <option key={option.code} value={option.code} className="bg-black text-white">
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-white/70">▾</span>
                            </div>
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
                              disabled={!!actionLoading || market.frozen}
                              className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 transition hover:bg-white/10 disabled:opacity-50 whitespace-nowrap"
                            >
                              {preset} SOL
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={!!actionLoading || market.frozen}
                          onClick={submitBet}
                          className={`w-full rounded-md px-3 py-2 text-sm font-semibold transition border focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:opacity-60 disabled:cursor-not-allowed ${
                            sideChoice === 0
                              ? 'border-emerald-500 bg-emerald-500 text-gray-900 hover:bg-emerald-400'
                              : 'border-[#b91c1c] bg-[#b91c1c] text-white hover:bg-[#dc2626]'
                          }`}
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
                  <div className="space-y-2">
                    <div className="rounded-md border border-emerald-400/50 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                      You won! Confirm to pull out your winnings.
                    </div>
                    <button
                      disabled={actionLoading === 'claim'}
                      onClick={() => run('claim', () => claimWinnings(wallet, selectedAuthority || undefined))}
                      className="btn w-full btn-sm bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-[var(--accent-contrast)] border-transparent"
                    >
                      {actionLoading === 'claim' ? '...' : 'Claim Payout'}
                    </button>
                  </div>
                )}
                {canManualCloseTicket && !noWinner && (
                  <div className="space-y-2">
                    <div className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/70">
                      You lost this round. Clearing will release your ticket rent.
                    </div>
                    <button
                      disabled={actionLoading === 'close_ticket'}
                      onClick={() => run('close_ticket', () => closeTicket(wallet, selectedAuthority || undefined))}
                      className="btn w-full btn-sm border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10"
                    >
                      {actionLoading === 'close_ticket' ? '...' : 'Clear Position'}
                    </button>
                  </div>
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
          <ChatPanel authority={(selectedAuthority || publicKey || undefined)?.toBase58?.() || (publicKey?.toBase58?.() || 'self')} />
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

function ViewerStream({ authority, onMeta }: { authority: string; onMeta?: Dispatch<SetStateAction<{ active: boolean; viewerCount: number; title: string | null } | null>> }) {
  const [playback, setPlayback] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch(`/api/stream?authority=${authority}`);
        if (!res.ok) return;
        const j = await res.json();
        if (active) {
          const stream = j.stream || null;
          if (stream?.playbackUrl) {
            setPlayback(stream.playbackUrl);
          } else {
            setPlayback(null);
          }
          if (onMeta) {
            onMeta(stream ? {
              active: !!stream.active,
              viewerCount: stream.viewerCount ?? 0,
              title: typeof stream.title === 'string' ? stream.title : null,
            } : null);
          }
        }
      } finally { /* no-op */ }
    }
    load();
    const id = setInterval(load, 6000);
    return () => {
      active = false;
      clearInterval(id);
  if (onMeta) onMeta(null);
    };
  }, [authority, onMeta]);

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