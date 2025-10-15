"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";

type Market = {
  id: string;
  product: string;
  question: string;
  targetUsd: number;
  deadline: string;
  currentFloor: number;
  yesPool: number;
  noPool: number;
  packType: string;
  media: {
    src: string;
    alt: string;
  };
};

const demoMarkets: Market[] = [
  {
    id: "151-booster-box",
    product: "Scarlet & Violet 151 Booster Box",
    question: "Will a sealed SV151 booster box clear $260 by January 15, 2026?",
    packType: "Booster Box",
    targetUsd: 260,
    deadline: "Jan 15, 2026",
    currentFloor: 212,
    yesPool: 4820,
    noPool: 3380,
    media: {
      src: "/media/markets/sv151-booster.svg",
      alt: "Scarlet & Violet 151 Booster Box illustration",
    },
  },
  {
    id: "crown-zenith-etb",
    product: "Crown Zenith Elite Trainer Box",
    question: "Will the ETB floor price tag $140 or higher by December 31, 2025?",
    packType: "Elite Trainer Box",
    targetUsd: 140,
    deadline: "Dec 31, 2025",
    currentFloor: 118,
    yesPool: 3260,
    noPool: 4015,
    media: {
      src: "/media/markets/crown-zenith-etb.svg",
      alt: "Crown Zenith Elite Trainer Box illustration",
    },
  },
  {
    id: "charizard-upc",
    product: "Charizard Ultra Premium Collection",
    question: "Will a sealed UPC secure a $220 valuation before Worlds 2025?",
    packType: "Premium Collection",
    targetUsd: 220,
    deadline: "Aug 14, 2025",
    currentFloor: 187,
    yesPool: 5610,
    noPool: 2910,
    media: {
      src: "/media/markets/charizard-upc.svg",
      alt: "Charizard Ultra Premium Collection illustration",
    },
  },
];

const formatUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatUsdDetailed = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export default function LiveMarketPage() {
  const [markets, setMarkets] = useState<Market[]>(demoMarkets);
  const [selectedId, setSelectedId] = useState<string>(demoMarkets[0]?.id ?? "");
  const [betSide, setBetSide] = useState<"yes" | "no">("yes");
  const [stakeAmount, setStakeAmount] = useState<string>("25");
  const [message, setMessage] = useState<string | null>(null);

  const selectedMarket = useMemo(
    () => markets.find((m) => m.id === selectedId) ?? markets[0],
    [markets, selectedId],
  );

  const totalPool = useMemo(() => {
    if (!selectedMarket) return 0;
    return selectedMarket.yesPool + selectedMarket.noPool;
  }, [selectedMarket]);

  const yesPct = totalPool ? Math.round((selectedMarket!.yesPool / totalPool) * 100) : 50;
  const noPct = totalPool ? 100 - yesPct : 50;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMarket) return;

    const parsed = parseFloat(stakeAmount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setMessage("Enter a valid USD amount to stake.");
      return;
    }

    setMarkets((prev) =>
      prev.map((market) => {
        if (market.id !== selectedMarket.id) return market;
        return {
          ...market,
          yesPool: betSide === "yes" ? market.yesPool + parsed : market.yesPool,
          noPool: betSide === "no" ? market.noPool + parsed : market.noPool,
        };
      }),
    );

    setStakeAmount("");
    setMessage(
      `${formatUsdDetailed.format(parsed)} added to the ${betSide === "yes" ? "YES" : "NO"} side for ${selectedMarket.product}.`,
    );
  };

  return (
    <main className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 xl:px-10 py-10 space-y-10">
      <section className="panel overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(110%_110%_at_0%_0%,rgba(255,223,0,0.15),transparent_55%)]" />
        <div className="relative p-6 sm:p-10 flex flex-col gap-6 sm:flex-row sm:justify-between sm:items-center">
          <div className="space-y-4 max-w-2xl">
            <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-[#b91c1c] animate-pulse" />
              Live Market
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              Predict the future value of Pokémon heat
            </h1>
            <p className="text-sm sm:text-base text-white/70 leading-relaxed">
              Back your read on sealed product, chase cards, and premium collections. Stake on whether these headline
              items will break their target price by the stated deadline and watch the odds update instantly as the
              community weighs in.
            </p>
          </div>
          <div className="self-stretch sm:self-auto">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-6 py-5 w-full sm:min-w-[240px] space-y-3">
              <h2 className="text-sm font-semibold text-white">How this demo works</h2>
              <p className="text-[12px] text-white/65 leading-relaxed">
                Choose a market, pick YES or NO, and enter a stake. We simulate pool updates locally so you can iterate on
                product ideas and UX before wiring on-chain logic.
              </p>
              <p className="text-[12px] text-white/45 border-t border-white/10 pt-3">
                Real Solana integration can reuse this layout with Anchor instructions and Pyth price feeds once ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <h2 className="card-header">Featured Drops</h2>
          <div className="space-y-3">
            {markets.map((market) => {
              const isActive = market.id === selectedMarket?.id;
              const localTotal = market.yesPool + market.noPool;
              const localYesPct = localTotal ? Math.round((market.yesPool / localTotal) * 100) : 50;

              return (
                <button
                  key={market.id}
                  onClick={() => {
                    setSelectedId(market.id);
                    setBetSide("yes");
                    setMessage(null);
                  }}
                  className={`w-full text-left panel relative border transition-colors ${
                    isActive ? "border-[var(--accent)]/60 shadow-[0_0_18px_rgba(255,223,0,0.15)]" : "border-white/10 hover:border-[var(--accent)]/30"
                  }`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(140%_140%_at_0%_0%,rgba(255,223,0,0.1),transparent_60%)] opacity-0 transition-opacity duration-300 pointer-events-none" style={{ opacity: isActive ? 1 : 0 }} />
                  <div className="relative p-4 space-y-3">
                    <div className="relative overflow-hidden rounded-lg border border-white/10 bg-black/30">
                      <div className="relative aspect-[5/3]">
                        <Image
                          src={market.media.src}
                          alt={market.media.alt}
                          fill
                          sizes="(min-width: 1024px) 260px, (min-width: 768px) 220px, 100vw"
                          className="object-cover"
                          priority={market.id === demoMarkets[0].id}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-white/45">{market.packType}</p>
                      <p className="mt-1 text-sm font-semibold text-white/90">{market.product}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="progress-track sm h-1.5">
                        <div
                          className="progress-segment"
                          style={{
                            width: `${localYesPct}%`,
                            background: "linear-gradient(90deg,rgba(34,197,94,0.9),rgba(52,211,153,0.5))",
                          }}
                        />
                        <div
                          className="progress-segment"
                          style={{
                            width: `${Math.max(0, 100 - localYesPct)}%`,
                            background: "linear-gradient(90deg,rgba(185,28,28,0.9),rgba(248,113,113,0.55))",
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[11px] text-white/55">
                        <span>YES {formatUsd.format(market.yesPool)}</span>
                        <span>NO {formatUsd.format(market.noPool)}</span>
                      </div>
                    </div>
                    <p className="text-[11px] text-white/50">Target {formatUsd.format(market.targetUsd)} • Deadline {market.deadline}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-6">
          {selectedMarket && (
            <div className="panel border border-white/10 p-6 space-y-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,320px)]">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold text-white">{selectedMarket.question}</h2>
                    <p className="text-sm text-white/60 max-w-2xl">
                      Current verified floor {formatUsdDetailed.format(selectedMarket.currentFloor)} • Target price {formatUsdDetailed.format(selectedMarket.targetUsd)} by {selectedMarket.deadline}.
                    </p>
                  </div>
                  <div className="rounded-lg bg-black/30 border border-white/10 px-4 py-3 text-sm text-white/80 w-full max-w-xs">
                    <p className="uppercase tracking-[0.24em] text-white/45 text-[10px]">Pool value</p>
                    <p className="text-xl font-semibold text-white">
                      {formatUsdDetailed.format(totalPool)}
                    </p>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
                  <div className="relative aspect-[5/4]">
                    <Image
                      src={selectedMarket.media.src}
                      alt={selectedMarket.media.alt}
                      fill
                      sizes="(min-width: 1024px) 320px, (min-width: 768px) 280px, 90vw"
                      className="object-cover"
                      priority
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="progress-track h-3">
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
                      width: `${noPct}%`,
                      background: "linear-gradient(90deg,rgba(185,28,28,0.95),rgba(248,113,113,0.55))",
                    }}
                  />
                </div>
                <div className="flex justify-between text-[12px] text-white/60">
                  <span>YES • {yesPct}% ({formatUsdDetailed.format(selectedMarket.yesPool)})</span>
                  <span>NO • {noPct}% ({formatUsdDetailed.format(selectedMarket.noPool)})</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <fieldset className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/25 p-4">
                  <legend className="text-[11px] uppercase tracking-[0.3em] text-white/50">Choose your side</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setBetSide("yes")}
                      className={`rounded-md border px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                        betSide === "yes"
                          ? "border-emerald-500 bg-emerald-500 text-gray-900 shadow-[0_0_15px_rgba(16,185,129,0.45)]"
                          : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
                      }`}
                    >
                      YES
                    </button>
                    <button
                      type="button"
                      onClick={() => setBetSide("no")}
                      className={`rounded-md border px-3 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                        betSide === "no"
                          ? "border-[#b91c1c] bg-[#b91c1c] text-white shadow-[0_0_18px_rgba(185,28,28,0.45)]"
                          : "border-[#b91c1c]/50 bg-[#7f1d1d]/40 text-[#fecaca] hover:bg-[#991b1b]/50"
                      }`}
                    >
                      NO
                    </button>
                  </div>
                  <p className="text-[12px] text-white/50">
                    Odds update as both pools grow. Use this to prototype how on-chain liquidity could surface implied probabilities.
                  </p>
                </fieldset>

                <div className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-3">
                  <label className="flex flex-col gap-2 text-sm text-white/70">
                    Stake (USD equivalent)
                    <div className="relative">
                      <input
                        value={stakeAmount}
                        onChange={(event) => setStakeAmount(event.target.value)}
                        type="number"
                        min="1"
                        step="1"
                        className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
                        placeholder="50"
                      />
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[11px] uppercase tracking-wide text-white/40">
                        USD
                      </span>
                    </div>
                  </label>
                  <button
                    type="submit"
                    className={`w-full rounded-md px-3 py-2 text-sm font-semibold transition border focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20 ${
                      betSide === "yes"
                        ? "border-emerald-500 bg-emerald-500 text-gray-900 hover:bg-emerald-400"
                        : "border-[#b91c1c] bg-[#b91c1c] text-white hover:bg-[#dc2626]"
                    }`}
                  >
                    Simulate {betSide === "yes" ? "YES" : "NO"} Stake
                  </button>
                  <p className="text-[11px] text-white/45">
                    This prototype response updates local state only. Swap in RPC calls to write actual stakes to your program.
                  </p>
                </div>
              </form>

              {message && (
                <div className="rounded-md border border-white/10 bg-white/5 px-4 py-2 text-[12px] text-white/75">
                  {message}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="panel p-4 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Idea backlog</p>
              <p className="text-lg font-semibold text-white">Add PSA 10 singles</p>
              <p className="text-[12px] text-white/60">Model high-grade Charizard & Pikachu cards with separate odds oracles.</p>
            </div>
            <div className="panel p-4 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Analytics</p>
              <p className="text-lg font-semibold text-white">Link to Pyth + TCGplayer</p>
              <p className="text-[12px] text-white/60">Pipe real market feeds into the implied probability calc for live odds.</p>
            </div>
            <div className="panel p-4 space-y-1">
              <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">Next step</p>
              <p className="text-lg font-semibold text-white">Wire to Anchor</p>
              <p className="text-[12px] text-white/60">Swap the local state demo for instructions that escrow USDC on-chain.</p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
