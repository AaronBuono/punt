/**
 * Dashboard: My Bets
 * 
 * Displays encrypted bet history retrieved from Arcium MXE
 */

'use client';

import { useEffect, useState } from 'react';
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
                    <div className="grid grid-cols-12 text-xs uppercase tracking-wide text-[#adadb8] px-4 py-2 border-b border-white/10">
                      <div className="col-span-3">Date</div>
                      <div className="col-span-2">Poll ID</div>
                      <div className="col-span-3">Prediction</div>
                      <div className="col-span-2 text-right">Amount</div>
                      <div className="col-span-2 text-right">Outcome</div>
                    </div>
                    <ul className="divide-y divide-white/10">
                      {bets.map((bet) => {
                        const { prediction, amount, outcome } = formatBetData(bet.betData);
                        return (
                          <li key={bet.betId} className="grid grid-cols-12 items-center px-4 py-3 hover:bg-white/5">
                            <div className="col-span-3 text-sm text-white/90">
                              {formatDate(bet.storedAt)}
                            </div>
                            <div className="col-span-2 text-sm text-dim font-mono truncate">
                              {bet.pollId.slice(0, 8)}...
                            </div>
                            <div className="col-span-3 text-sm text-white/90">
                              {String(prediction)}
                            </div>
                            <div className="col-span-2 text-right text-sm text-white/90 tabular-nums">
                              {Number(amount).toFixed(2)} SOL
                            </div>
                            <div className="col-span-2 text-right">
                              <span
                                className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-md border ${
                                  outcome === 'Win'
                                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                                    : outcome === 'Loss'
                                    ? 'bg-red-500/10 text-red-300 border-red-500/20'
                                    : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
                                }`}
                              >
                                {String(outcome)}
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
