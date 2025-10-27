import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { demoMarkets, formatSol, formatSolDetailed, formatUsd } from "../markets";

const chartHeight = 160;
const chartWidth = 420;

function MarketOddsChart({
  oddsHistory,
}: {
  oddsHistory: Array<{ timestamp: string; yes: number; no: number }>;
}) {
  if (!oddsHistory.length) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-xl border border-white/10 bg-black/20 text-sm text-white/40">
        Odds history unavailable
      </div>
    );
  }

  const maxPoints = oddsHistory.length - 1 || 1;
  const yesPoints = oddsHistory
    .map((point, index) => {
      const x = maxPoints === 0 ? chartWidth : (index / maxPoints) * chartWidth;
      const y = chartHeight - (point.yes / 100) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const noPoints = oddsHistory
    .map((point, index) => {
      const x = maxPoints === 0 ? chartWidth : (index / maxPoints) * chartWidth;
      const y = chartHeight - (point.no / 100) * chartHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <header className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Implied odds over time</h3>
        <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">Last 6 checkpoints</p>
      </header>
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        width="100%"
        height={chartHeight}
        className="text-white/80"
      >
        <defs>
          <linearGradient id="yesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(34,197,94,0.55)" />
            <stop offset="100%" stopColor="rgba(34,197,94,0.05)" />
          </linearGradient>
          <linearGradient id="noGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(248,113,113,0.55)" />
            <stop offset="100%" stopColor="rgba(248,113,113,0.05)" />
          </linearGradient>
        </defs>

        <g fill="none" strokeWidth={2}>
          <polyline points={yesPoints} stroke="rgba(34,197,94,0.85)" />
          <polyline points={noPoints} stroke="rgba(248,113,113,0.85)" />
        </g>

        <g fill="currentColor" fontSize="11" className="text-white/35">
          {oddsHistory.map((point, index) => {
            const x = maxPoints === 0 ? chartWidth : (index / maxPoints) * chartWidth;
            return (
              <text key={point.timestamp} x={x} y={chartHeight + 14} textAnchor="middle">
                {point.timestamp}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export function generateStaticParams() {
  return demoMarkets.map((market) => ({ marketId: market.id }));
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  const market = demoMarkets.find((item) => item.id === marketId);

  if (!market) {
    notFound();
  }

  const totalPool = market.yesPool + market.noPool;
  const yesPct = totalPool ? Math.round((market.yesPool / totalPool) * 100) : 50;
  const noPct = totalPool ? 100 - yesPct : 50;

  return (
    <main className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 xl:px-10 py-8 space-y-6">
      <Link
        href="/buy"
        className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/45 transition hover:text-white/80"
      >
        ← Featured Drops
      </Link>

      <article className="panel p-6 sm:p-8 space-y-8 md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-8 md:space-y-0">
        <div className="space-y-8">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <div className="relative mx-auto aspect-[3/4] w-full max-w-[360px] overflow-hidden rounded-2xl border border-white/12 bg-black/70 shadow-[inset_0_0_28px_rgba(0,0,0,0.45)]">
              <Image
                src={market.media.src}
                alt={market.media.alt}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 360px, 85vw"
              />
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                {market.packType ? (
                  <p className="text-[11px] uppercase tracking-[0.28em] text-white/40">{market.packType}</p>
                ) : null}
                <h1 className="mt-1 text-2xl font-semibold text-white">{market.product}</h1>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-xs text-white/60 sm:text-sm">
                <div>
                  <dt className=" uppercase tracking-[0.24em] text-[10px] text-white/40">Target</dt>
                  <dd className="mt-1 text-white">{formatUsd(market.targetUsd)}</dd>
                </div>
                <div>
                  <dt className=" uppercase tracking-[0.24em] text-[10px] text-white/40">Deadline</dt>
                  <dd className="mt-1 text-white/90">{market.deadline}</dd>
                </div>
                <div>
                  <dt className=" uppercase tracking-[0.24em] text-[10px] text-white/40">Current price</dt>
                  <dd className="mt-1 text-white/90">{formatUsd(market.currentPriceUsd)}</dd>
                </div>
                <div>
                  <dt className=" uppercase tracking-[0.24em] text-[10px] text-white/40">Total pool</dt>
                  <dd className="mt-1 text-white/90">{formatSolDetailed(totalPool)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <aside className="space-y-8">
          <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <header className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/45">Market outlook</h2>
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span className="flex items-center gap-2">
                  <span className="h-2 w-4 rounded-full bg-[rgba(34,197,94,0.85)]" /> YES
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-4 rounded-full bg-[rgba(248,113,113,0.85)]" /> NO
                </span>
              </div>
            </header>
            <Suspense fallback={<div className="h-[180px] animate-pulse rounded-xl bg-white/5" />}>
              <MarketOddsChart oddsHistory={market.oddsHistory} />
            </Suspense>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/45">Stake</h2>
            <p className="mt-3 text-sm text-white/65">
              Set your position against the YES or NO pools. Payouts track the collective conviction of bettors.
            </p>
            <div className="mt-6 space-y-4">
              <form className="space-y-4">
                <fieldset className="flex flex-col gap-2">
                  <label htmlFor="stake" className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                    Stake amount
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                    <input
                      id="stake"
                      name="stake"
                      type="number"
                      step="0.1"
                      placeholder="0.50"
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 focus:outline-none"
                    />
                    <span className="text-xs text-white/45">SOL</span>
                  </div>
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    className="rounded-xl bg-[rgba(34,197,94,0.15)] px-4 py-3 text-sm font-semibold text-[rgba(34,197,94,0.95)] transition hover:bg-[rgba(34,197,94,0.25)]"
                  >
                    Back YES @ {yesPct}%
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-[rgba(248,113,113,0.15)] px-4 py-3 text-sm font-semibold text-[rgba(248,113,113,0.95)] transition hover:bg-[rgba(248,113,113,0.25)]"
                  >
                    Back NO @ {noPct}%
                  </button>
                </div>
              </form>

              <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-xs text-white/60">
                <p className="font-semibold text-white/75">How this works</p>
                <p className="mt-2 leading-relaxed">
                  Stakes are simulated in this demo. Final odds are settled by the SOL share of each pool at resolution
                  time. Stake responsibly.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-white/45">Pool snapshot</h3>
            <div className="mt-4 space-y-3 text-sm text-white/70">
              <div className="flex items-center justify-between">
                <span>YES pool</span>
                <span className="font-semibold text-white">{formatSolDetailed(market.yesPool)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>NO pool</span>
                <span className="font-semibold text-white">{formatSolDetailed(market.noPool)}</span>
              </div>
              <div className="progress-track h-2">
                <div
                  className="progress-segment"
                  style={{
                    width: `${yesPct}%`,
                    background: "linear-gradient(90deg,rgba(34,197,94,0.95),rgba(16,185,129,0.5))",
                  }}
                />
                <div
                  className="progress-segment"
                  style={{
                    width: `${Math.max(0, 100 - yesPct)}%`,
                    background: "linear-gradient(90deg,rgba(185,28,28,0.95),rgba(248,113,113,0.55))",
                  }}
                />
              </div>
            </div>
          </section>
        </aside>
      </article>
    </main>
  );
}
