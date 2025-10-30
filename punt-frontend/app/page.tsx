"use client";
import { useMemo, useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { StreamPreview } from '@/components/stream/StreamPreview';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r=>r.json());

export default function Home() {
  const { data } = useSWR<{ streams: { authority: string; roomName: string; active: boolean; viewerCount: number; lastFetched: number; title?: string | null }[] }>("/api/streams?active=1", fetcher, { refreshInterval: 6000 });
  const live = data?.streams || [];
  const [streamTab, setStreamTab] = useState<'live' | 'upcoming'>('live');
  
  // Default to upcoming if no live streams
  useEffect(() => {
    if (data && live.length === 0) {
      setStreamTab('upcoming');
    }
  }, [data, live.length]);
  
  const upcoming = useMemo<Array<{ id: string; title: string; startsAt: string; imageUrl?: string }>>(() => [
    {
      id: 'punt-beta',
      title: 'Punt Beta',
      startsAt: 'TBA',
      imageUrl: '/og-image.png'
    }
  ], []);

  return (
    <main className="relative w-full flex flex-col gap-10">
      {/* Beta Testing Banner */}
      <section className="w-full px-6 xl:px-10 pt-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative overflow-hidden rounded-xl border border-[var(--accent)]/30 bg-gradient-to-r from-[var(--accent)]/10 via-[var(--accent)]/5 to-transparent p-4 shadow-lg">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎉</span>
                <p className="text-sm sm:text-base font-semibold text-white">
                  Punt Beta Testing Application Open Now!
                </p>
              </div>
              <a
                href="https://docs.google.com/forms/d/1I2bPiRVToZJPVXZB1NcybUzQ5zbN_Bz39hG5jqJSj0Y/edit"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm bg-[var(--accent)] text-[var(--accent-contrast)] hover:brightness-110 transition-all shadow-md whitespace-nowrap"
              >
                Apply Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Header background video */}
  <section className="w-full px-6 xl:px-10 pt-10">
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

      {/* Live / Upcoming */}
      <section className="space-y-3 px-6 xl:px-10 py-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setStreamTab('live')}
                className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] transition rounded-full ${streamTab === 'live' ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_12px_rgba(255,215,0,0.45)]' : 'text-white/60 hover:text-white/80'}`}
              >
                Live Now
              </button>
              <button
                type="button"
                onClick={() => setStreamTab('upcoming')}
                className={`px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] transition rounded-full ${streamTab === 'upcoming' ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_0_12px_rgba(255,215,0,0.45)]' : 'text-white/60 hover:text-white/80'}`}
              >
                Upcoming
              </button>
            </div>
            {/* View all removed per earlier request */}
          </div>

          {streamTab === 'live' ? (
            live.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {live.map((s) => {
                  const short = s.authority.slice(0,4)+'…'+s.authority.slice(-4);
                  const cardGlow = s.active ? 'shadow-[0_0_22px_rgba(255,223,0,0.35)]' : '';
                  const displayTitle = s.title?.trim() || short;
                  return (
                    <Link key={s.authority} href={{ pathname: '/watch', query: { authority: s.authority } }} className="group block focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 transition-transform duration-200 hover:scale-[1.02]">
                      <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-md ${cardGlow}`}>
                        <div className="relative aspect-video">
                          <StreamPreview authority={s.authority} roomName={s.roomName} active={s.active} refreshKey={s.lastFetched} />
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
                        </div>
                        <div className="p-4 flex items-center justify-between text-[12px]">
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-white/95">{displayTitle}</span>
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
            )
          ) : (
            upcoming.length ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {upcoming.map((event) => (
                  <div key={event.id} className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-md">
                    {event.imageUrl && (
                      <div className="relative aspect-video">
                        <img 
                          src={event.imageUrl} 
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent" />
                      </div>
                    )}
                    <div className="p-5 text-[12px]">
                      <p className="text-white/90 font-semibold truncate">{event.title}</p>
                      <p className="text-dim mt-2">Starting {event.startsAt}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="panel p-4 text-[12px] text-dim">No upcoming streams yet. Check back soon!</div>
            )
          )}
        </div>
      </section>

      {/* Directory removed on home page per request */}
    </main>
  );
}
