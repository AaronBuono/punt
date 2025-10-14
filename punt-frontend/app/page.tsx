"use client";
import useSWR from 'swr';
import Link from 'next/link';
import { StreamPreview } from "@/components/stream/StreamPreview";

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r=>r.json());

export default function Home() {
  const { data } = useSWR<{ streams: { authority: string; id: string; active: boolean; viewerCount: number; playbackUrl: string; lastFetched: number }[] }>("/api/streams?active=1", fetcher, { refreshInterval: 6000 });
  const live = data?.streams || [];

  return (
    <main className="relative w-full flex flex-col gap-10">
      {/* Header background video */}
      <section className="w-full px-6 xl:px-10">
        <div className="max-w-7xl mx-auto">
          <div className="relative w-full aspect-[16/6] sm:aspect-[16/4] md:aspect-[16/3.25] lg:aspect-[16/2.75] xl:aspect-[16/2.2] overflow-hidden rounded-3xl border border-white/10 shadow-xl">
            <video
              className="absolute inset-0 h-full w-full object-cover"
              src="/media/background-header.mov"
              autoPlay
              loop
              muted
              playsInline
              aria-label="Background showcase"
            />
            {/* Dark gradient overlay for readability */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            {/* Subtle side vignette */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/20 via-transparent to-black/20" />
            {/* Overlay text */}
            <div className="absolute inset-0 z-10 flex items-center">
              <div className="px-6 md:px-10 w-full">
                <h1 className={`text-white font-semibold text-3xl sm:text-4xl md:text-5xl lg:text-6xl drop-shadow`}>Gotta Predict &lsquo;Em All!</h1>
                <p className="mt-3 text-white/90 text-xs sm:text-sm md:text-base max-w-3xl">
                  Bet the moment. Watch your favourite packs opened live, place on-chain predictions in real time and win!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Now */}
  <section className="space-y-3 px-6 xl:px-10 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <h2 className="card-header">Live Now</h2>
            {/* View all removed per request */}
          </div>
          {live.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {live.map((s) => {
              const short = s.authority.slice(0,4)+'…'+s.authority.slice(-4);
              const fallbackSrc = "/media/stream-fallback.svg";
              const cardGlow = s.active ? 'shadow-[0_0_22px_rgba(255,223,0,0.35)]' : '';
              return (
                <Link key={s.id} href={{ pathname: '/watch', query: { authority: s.authority } }} className="group block focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-transform duration-200 hover:scale-[1.02]">
                  <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-md ${cardGlow}`}>
                    <div className="relative aspect-video bg-black/50">
                      <StreamPreview playbackUrl={s.playbackUrl} fallbackSrc={fallbackSrc} />
                      {s.active && (
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_50%,rgba(255,223,0,0.12),transparent_60%)]" />
                      )}
                    </div>
                    <div className="p-4 flex items-center justify-between text-[12px]">
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-white/95">{short}</span>
                        <span className="text-dim">{s.viewerCount} viewers</span>
                      </div>
                      <span className="btn btn-sm">Watch</span>
                    </div>
                    <span className="absolute top-2 left-2 inline-flex items-center px-2.5 py-1 rounded bg-black/60 text-[var(--accent)] text-[11px] font-extrabold uppercase tracking-[0.32em]">Live</span>
                  </div>
                </Link>
              );
            })}
            </div>
          ) : (
            <div className="panel p-4 text-[12px] text-dim">No one is live right now.</div>
          )}
        </div>
      </section>

      {/* Directory removed on home page per request */}
    </main>
  );
}
