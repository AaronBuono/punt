import Link from "next/link";

const bundles = [
  {
    name: "Starter Pack",
    description: "Perfect for first-time viewers who want to test-drive Punt picks without breaking the bank.",
    price: "25 USDC",
    perks: ["1,000 Punt Credits", "Early access to weekly drops", "Starter badge in chat"],
    accent: "from-emerald-500/60 to-emerald-400/30",
  },
  {
    name: "Grinder Pack",
    description: "Level up your roll with enough firepower to stay in every poll all weekend long.",
    price: "75 USDC",
    perks: ["3,500 Punt Credits", "Boosted multiplier on streaks", "Exclusive Discord role"],
    accent: "from-purple-500/60 to-fuchsia-400/30",
  },
  {
    name: "Whale Pack",
    description: "You run the lobbies. Stack credits for headline moments and premium host access.",
    price: "150 USDC",
    perks: ["7,500 Punt Credits", "VIP alerts when hosts go live", "Monthly strategy AMA"],
    accent: "from-amber-500/70 to-orange-400/30",
  },
];

const steps = [
  {
    title: "Connect your Solana wallet",
    detail: "We support Phantom, Backpack, Glow, and any Wallet Adapter compatible option.",
  },
  {
    title: "Choose a bundle",
    detail: "Pick the credit pack that matches your watch habits. You can always top up later.",
  },
  {
    title: "Confirm the purchase",
    detail: "Approve the USDC transfer in-wallet. Credits land in seconds and are ready to spend.",
  },
];

export default function BuyPage() {
  return (
    <main className="relative w-full py-10 px-4 sm:px-6 xl:px-10 max-w-6xl mx-auto space-y-10">
      <section className="panel overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_65%)]" />
        <div className="relative p-6 sm:p-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-4 max-w-2xl">
            <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] text-white/60">
              <span className="h-1 w-1 rounded-full bg-[var(--accent)] animate-pulse" />
              Top up credits
            </p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
              Buy Punt credits and stay in every moment
            </h1>
            <p className="text-sm sm:text-base text-white/70 leading-relaxed">
              Credits power wagers, hype moments, and premium interactions on Punt streams. Grab a bundle, roll into chat, and start calling plays with the community.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-white/70">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Instant delivery
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-sky-400" />
                Powered by USDC
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <span className="w-2 h-2 rounded-full bg-purple-400" />
                Low Solana fees
              </div>
            </div>
          </div>
          <div className="self-stretch sm:self-auto">
            <div className="rounded-2xl border border-white/10 bg-black/30 px-6 py-5 w-full sm:min-w-[240px]">
              <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Need help?</p>
              <p className="mt-2 text-white font-semibold">Talk with a Punt concierge</p>
              <p className="mt-1 text-sm text-white/60">We can guide wallet setup or bulk credit purchases for events.</p>
              <Link
                href="mailto:support@punt.app"
                className="mt-4 inline-flex items-center justify-center rounded-md bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent)]/90 transition"
              >
                Email support
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {bundles.map((bundle) => (
          <div key={bundle.name} className="panel relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${bundle.accent} opacity-40`} />
            <div className="relative p-6 space-y-4">
              <header className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/55">{bundle.name}</p>
                <p className="text-2xl font-bold text-white">{bundle.price}</p>
              </header>
              <p className="text-sm text-white/75 leading-relaxed">{bundle.description}</p>
              <ul className="space-y-2 text-sm text-white/70">
                {bundle.perks.map((perk) => (
                  <li key={perk} className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
              <button className="w-full rounded-md bg-white/90 text-black font-semibold text-sm py-2 mt-2 hover:bg-white transition">
                Purchase
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="panel p-6 sm:p-8 space-y-6">
        <header className="space-y-2">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-semibold text-white">Three easy steps to load up</h2>
          <p className="text-sm text-white/65 max-w-2xl">
            Punt runs entirely on Solana. That means sub-second settlement, minimal fees, and credits that show up immediately once your transaction clears.
          </p>
        </header>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent)]/20 text-[var(--accent)] font-semibold text-sm">
                {index + 1}
              </span>
              <p className="text-base font-semibold text-white">{step.title}</p>
              <p className="text-sm text-white/65 leading-relaxed">{step.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
