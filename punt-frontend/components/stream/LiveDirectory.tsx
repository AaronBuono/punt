"use client";
import useSWR from 'swr';
import { useCallback } from 'react';

interface DirectoryStream {
  authority: string;
  id: string;
  active: boolean;
  viewerCount: number;
  playbackUrl: string;
  lastFetched: number;
  title?: string | null;
}
interface DirectoryResponse { streams: DirectoryStream[] }

const fetcher = (url: string) => fetch(url).then(r=>r.json());

export function LiveDirectory({ onSelect }: { onSelect: (authority: string) => void }) {
  const { data, isLoading } = useSWR<DirectoryResponse>('/api/streams?active=1', fetcher, { refreshInterval: 6000 });
  const streams = data?.streams || [];

  const handleSelect = useCallback((auth: string) => {
    onSelect(auth);
  }, [onSelect]);

  if (isLoading && !streams.length) {
    return (
      <div className="panel p-4 space-y-2">
        <h2 className="card-header">Live Streams</h2>
        <p className="text-[11px] text-dim">Loading directory…</p>
      </div>
    );
  }

  return (
    <div className="panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="card-header">Live Streams</h2>
        <span className="text-[10px] text-dim">{streams.length} live</span>
      </div>
      {streams.length ? (
        <div className="grid md:grid-cols-3 sm:grid-cols-2 grid-cols-1 gap-3">
          {streams.map(s => {
            const short = s.authority.slice(0,4)+'…'+s.authority.slice(-4);
            const displayTitle = s.title?.trim() || short;
            return (
              <button key={s.authority} onClick={() => handleSelect(s.authority)} className="group relative overflow-hidden rounded-md border border-white/10 bg-white/5 hover:bg-white/10 transition p-3 flex flex-col items-start gap-2">
                <div className="flex items-center gap-2 text-[10px] font-semibold">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent)]/80 text-[var(--accent-contrast)] text-[9px] uppercase tracking-wide"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>Live</span>
                  <span className="text-white/80 truncate max-w-[120px]">{displayTitle}</span>
                </div>
                <div className="flex flex-col gap-1 text-[10px] text-dim">
                  <span className="text-white/50">{s.viewerCount} viewers</span>
                  <span className="text-white/40 uppercase tracking-[0.25em]">{short}</span>
                </div>
                <span className="absolute inset-0 ring-0 focus-visible:ring-2 focus-visible:ring-purple-500/60 rounded-md" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-[11px] text-dim italic">No streams live yet. Be the first to go live!</div>
      )}
      <p className="text-[10px] text-dim">Click a streamer to load their poll & chat.</p>
    </div>
  );
}
