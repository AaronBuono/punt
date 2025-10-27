"use client";
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then(r=>r.json());

export default function LivePage() {
  const { data, isLoading } = useSWR<{ streams: { authority: string; roomName: string; active: boolean; viewerCount: number; lastFetched: number; title?: string | null }[] }>("/api/streams?active=1", fetcher, { refreshInterval: 6000 });
  const streams = data?.streams || [];

  return (
    <main className="relative w-full py-10 px-6 xl:px-10 flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight gradient-text">Live Streams</h1>
        <Link href="/watch" className="btn btn-outline">Open Watch View</Link>
      </div>

      {isLoading && !streams.length && (
        <div className="panel p-4 text-[12px] text-dim">Loading live streams…</div>
      )}

      {streams.length ? (
        <div className="grid lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-4">
          {streams.map(s => {
            const short = s.authority.slice(0,4)+'…'+s.authority.slice(-4);
            const displayTitle = s.title?.trim() || short;
            return (
              <div key={s.authority} className="relative group overflow-hidden rounded-md border border-white/10 bg-white/5">
                <div className="aspect-video bg-black/50 flex items-center justify-center text-[11px] text-dim">Preview</div>
                <div className="p-3 flex items-center justify-between text-[11px]">
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-white/90">{displayTitle}</span>
                    <span className="text-dim">Host {short} · {s.viewerCount} viewers</span>
                  </div>
                  <Link href={{ pathname: '/watch', query: { authority: s.authority } }} className="btn btn-sm">Watch</Link>
                </div>
                <span className="absolute top-2 left-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent)]/80 text-[var(--accent-contrast)] text-[9px] uppercase tracking-wide"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>Live</span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="panel p-4 text-[12px] text-dim">No one is live right now.</div>
      )}
    </main>
  );
}
