/**
 * Dashboard: My Bets
 * 
 * Displays encrypted bet history retrieved from Arcium MXE
 */

'use client';

import { useEffect, useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import type { BetRecord } from '../api/get-bets/route';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export default function MyBetsPage() {
  const { publicKey, connected } = useWallet();
  const [bets, setBets] = useState<BetRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected && publicKey) {
      fetchBets();
      // Auto-refresh every 10 seconds
      const interval = setInterval(fetchBets, 10000);
      return () => clearInterval(interval);
    } else {
      setBets([]);
    }
  }, [connected, publicKey]);

  const fetchBets = async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/get-bets?wallet=${publicKey.toBase58()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch bets');
      }

      const data = await response.json();
      setBets(data.bets || []);
    } catch (err) {
      console.error('Error fetching bets:', err);
      setError(err instanceof Error ? err.message : 'Failed to load bets');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const formatBetData = (betData: Record<string, unknown>) => {
    // Extract bet fields
    const side = betData.side as number | undefined;
    const labelYes = (betData.labelYes as string) || 'YES';
    const labelNo = (betData.labelNo as string) || 'NO';
    const prediction = side === 0 ? labelYes : side === 1 ? labelNo : (betData.prediction || betData.choice || 'N/A');
    const amount = betData.amount || betData.wager || 0;
    const outcome = betData.outcome || betData.result || 'Pending';
    
    return { prediction, amount, outcome };
  };

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalBets = bets.length;
    const totalWagered = bets.reduce((sum, bet) => {
      const { amount } = formatBetData(bet.betData);
      return sum + Number(amount);
    }, 0);

    const wins = bets.filter(bet => {
      const { outcome } = formatBetData(bet.betData);
      return outcome === 'Win';
    }).length;

    const losses = bets.filter(bet => {
      const { outcome } = formatBetData(bet.betData);
      return outcome === 'Loss';
    }).length;

    // Calculate PnL (simplified: win = 2x back, loss = lose stake)
    const totalPnl = bets.reduce((sum, bet) => {
      const { amount, outcome } = formatBetData(bet.betData);
      const amt = Number(amount);
      if (outcome === 'Win') {
        return sum + amt; // Profit = amount won (we get back 2x, so profit is 1x)
      } else if (outcome === 'Loss') {
        return sum - amt; // Lost the amount wagered
      }
      return sum; // Pending bets don't affect PnL yet
    }, 0);

    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;

    return {
      totalBets,
      totalWagered,
      totalPnl,
      wins,
      losses,
      winRate,
    };
  }, [bets]);

  return (
    <main className="relative w-full py-10 px-6 xl:px-10 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight gradient-text">My Bets</h1>
          {connected && (
            <button
              onClick={() => fetchBets()}
              disabled={loading}
              className="btn btn-sm border border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)]/10"
            >
              {loading ? '...' : '🔄 Refresh'}
            </button>
          )}
        </div>
        <p className="text-sm text-dim">
          Encrypted bet history powered by Arcium MXE • Auto-refreshes every 10s
        </p>
      </header>

      {/* Summary Statistics */}
      {connected && !loading && !error && bets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Wagered */}
          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-dim">Total Wagered</p>
                <p className="text-2xl font-bold text-white mt-1 tabular-nums">
                  {stats.totalWagered.toFixed(2)} <span className="text-sm text-dim">SOL</span>
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total P&L */}
          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-dim">Total P&L</p>
                <p className={`text-2xl font-bold mt-1 tabular-nums ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {stats.totalPnl >= 0 ? '+' : ''}{stats.totalPnl.toFixed(2)} <span className="text-sm text-dim">SOL</span>
                </p>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${stats.totalPnl >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <svg className={`h-6 w-6 ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {stats.totalPnl >= 0 ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                  )}
                </svg>
              </div>
            </div>
          </div>

          {/* Win Rate */}
          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-dim">Win Rate</p>
                <p className="text-2xl font-bold text-white mt-1 tabular-nums">
                  {stats.winRate.toFixed(1)}<span className="text-sm text-dim">%</span>
                </p>
                <p className="text-[10px] text-dim mt-0.5">{stats.wins}W / {stats.losses}L</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Total Bets */}
          <div className="panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-dim">Total Bets</p>
                <p className="text-2xl font-bold text-white mt-1 tabular-nums">
                  {stats.totalBets}
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <svg className="h-6 w-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Connection State */}
      {!connected ? (
        <div className="panel p-8 text-center">
          <div className="max-w-md mx-auto">
            <svg
              className="mx-auto h-12 w-12 text-white/40"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-white/90">
              Connect Your Wallet
            </h3>
            <p className="mt-2 text-sm text-dim">
              Connect your Solana wallet to view your encrypted bet history.
            </p>
            <div className="mt-6">
              <WalletMultiButton />
            </div>
          </div>
        </div>
        ) : (
          <>
            {/* Loading State */}
            {loading && (
              <div className="panel p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--accent)] mx-auto"></div>
                <p className="mt-4 text-sm text-dim">Loading your bets...</p>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="panel p-4 border-red-500/20 bg-red-500/10">
                <div className="flex items-start gap-3">
                  <svg
                    className="h-5 w-5 text-red-400 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-300">Error</h3>
                    <p className="mt-1 text-sm text-red-200">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Bets Table */}
            {!loading && !error && (
              <div className="panel overflow-hidden">
                {bets.length === 0 ? (
                  <div className="text-center py-12">
                    <svg
                      className="mx-auto h-12 w-12 text-white/40"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <h3 className="mt-4 text-lg font-medium text-white/90">
                      No bets found
                    </h3>
                    <p className="mt-2 text-sm text-dim">
                      Your encrypted bet history will appear here.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-12 text-xs uppercase tracking-wide text-[#adadb8] px-4 py-3 border-b border-white/10 bg-white/5">
                      <div className="col-span-2">Date</div>
                      <div className="col-span-3">Poll</div>
                      <div className="col-span-2">Prediction</div>
                      <div className="col-span-2 text-right">Amount</div>
                      <div className="col-span-3 text-right">Result</div>
                    </div>
                    <ul className="divide-y divide-white/10">
                      {bets.map((bet) => {
                        const { prediction, amount, outcome } = formatBetData(bet.betData);
                        const betTitle = (bet.betData.title as string) || 'Prediction Market';
                        const dateStr = formatDate(bet.storedAt);
                        
                        return (
                          <li key={bet.betId} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-white/5 transition-colors">
                            <div className="col-span-2 text-xs text-white/70">
                              <div className="font-medium text-white/90">{dateStr.split(' ')[0]}</div>
                              <div className="text-[10px] text-white/50">{dateStr.split(' ')[1]}</div>
                            </div>
                            <div className="col-span-3 text-sm">
                              <div className="font-medium text-white/90 truncate">{betTitle}</div>
                              <div className="text-[10px] text-dim font-mono truncate">{bet.pollId.slice(0, 16)}...</div>
                            </div>
                            <div className="col-span-2 text-sm">
                              <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded border border-white/10 bg-white/5 text-white/90">
                                {String(prediction)}
                              </span>
                            </div>
                            <div className="col-span-2 text-right">
                              <div className="text-sm font-semibold text-white/90 tabular-nums">
                                {Number(amount).toFixed(2)}
                              </div>
                              <div className="text-[10px] text-dim">SOL</div>
                            </div>
                            <div className="col-span-3 text-right">
                              <span
                                className={`inline-flex px-3 py-1 text-xs font-bold rounded-md border ${
                                  outcome === 'Win'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : outcome === 'Loss'
                                    ? 'bg-red-500/20 text-red-300 border-red-500/40'
                                    : outcome === 'Frozen'
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                    : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                                }`}
                              >
                                {outcome === 'Win' && '🏆 Won'}
                                {outcome === 'Loss' && '❌ Lost'}
                                {outcome === 'Frozen' && '🧊 Frozen'}
                                {outcome === 'Pending' && '⏳ Pending'}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            )}

            {/* Summary */}
            {!loading && !error && bets.length > 0 && (
              <div className="text-center text-sm text-dim">
                Showing {bets.length} bet{bets.length !== 1 ? 's' : ''} • Encrypted with Arcium MXE
              </div>
            )}
          </>
        )}
      </main>
    );
}
