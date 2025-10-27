import Image from "next/image";
import Link from "next/link";

import { demoMarkets, formatSol, formatSolDetailed, formatUsd } from "./markets";

export default function MarketsLandingPage() {
  const totalDemoVolume = demoMarkets.reduce((sum, market) => sum + market.yesPool + market.noPool, 0);

  return (
    <main className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 xl:px-10 py-10 space-y-10">
      <section className="panel overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_0%_30%,rgba(255,223,0,0.14),transparent_65%)]" />
        <div className="relative flex flex-col gap-4 p-6 sm:p-8 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3 max-w-2xl">
            <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              Live Markets
            </p>
            <h1 className="text-3xl sm:text-[2.6rem] font-extrabold leading-tight text-white">
              Back the cards you believe in
            </h1>
            <p className="text-sm sm:text-[15px] text-white/70 leading-relaxed">
              Pick a card, choose a side, and stake your SOL. Odds adjust instantly as YES and NO pools move. Tap any
              listing to open the full market view with trend charts and staking controls.
            </p>
          </div>
          <dl className="grid w-full gap-4 rounded-xl border border-white/10 bg-black/30 px-5 py-4 text-sm text-white/65 sm:grid-cols-2 md:w-auto md:min-w-[280px]">
            <div>
              <dt className="text-[11px] uppercase tracking-[0.28em] text-white/35">Active pools</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{demoMarkets.length}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-[0.28em] text-white/35">Demo volume</dt>
              <dd className="mt-1 text-lg font-semibold text-white">{formatSolDetailed(totalDemoVolume)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="space-y-5">
        <header className="flex flex-col gap-2">
          <h2 className="card-header">Featured Drops</h2>
          <p className="text-sm text-white/55">Three high-conviction markets the community is watching right now.</p>
        </header>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {demoMarkets.map((market) => {
            const totalPool = market.yesPool + market.noPool;
            const yesPct = totalPool ? Math.round((market.yesPool / totalPool) * 100) : 50;
            const finalYes = market.oddsHistory.at(-1)?.yes ?? yesPct;

            return (
              <Link
                key={market.id}
                href={`/buy/${market.id}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/35 transition hover:border-[var(--accent)]/35 hover:shadow-[0_0_22px_rgba(255,223,0,0.18)]"
              >
                <div className="px-5 pt-5">
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-white/12 bg-black/70 shadow-[inset_0_0_24px_rgba(0,0,0,0.45)]">
                    <Image
                      src={market.media.src}
                      alt={market.media.alt}
                      fill
                      sizes="(min-width: 1280px) 300px, (min-width: 768px) 260px, 70vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                    <div className="absolute inset-x-4 bottom-4">
                      <p className="text-base font-semibold text-white/95">{market.product}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-4">
                  <p className="text-sm text-white/65 leading-relaxed line-clamp-2">
                    {market.question}
                  </p>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-white/40">
                    Current price {formatUsd(market.currentPriceUsd)}
                  </p>
                  <div className="space-y-2">
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
                    <div className="flex items-center justify-between text-[11px] text-white/60">
                      <span>YES {formatSol(market.yesPool)}</span>
                      <span>NO {formatSol(market.noPool)}</span>
                    </div>
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-3 text-xs text-white/55">
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                      <p className="uppercase tracking-[0.24em] text-[10px] text-white/40">Target</p>
                      <p className="mt-1 font-semibold text-white">{formatUsd(market.targetUsd)}</p>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                      <p className="uppercase tracking-[0.24em] text-[10px] text-white/40">Implied yes</p>
                      <p className="mt-1 font-semibold text-white">{finalYes}%</p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
