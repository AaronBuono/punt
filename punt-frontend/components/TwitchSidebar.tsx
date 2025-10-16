"use client";
import useSWR from "swr";
import { useCallback } from "react";
import { Sparkles } from "lucide-react";

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

export function TwitchSidebar({ onSelect }: { onSelect: (authority: string) => void }) {
  const { data } = useSWR<DirectoryResponse>('/api/streams?active=1', fetcher, { refreshInterval: 6000 });
  const streams = data?.streams || [];

  const handleSelect = useCallback((auth: string) => { onSelect(auth); }, [onSelect]);

  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-white/10 bg-black/30 backdrop-blur-xl">
      <div className="px-4 py-3 text-[10px] tracking-wide font-semibold text-dim uppercase flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-[color:var(--accent)]"/>
        Live Hosts
        <span className="ml-auto tag">{streams.length}</span>
      </div>
  <ul className="flex-1 text-sm overflow-y-auto">
        {streams.length === 0 && (
          <li className="px-4 py-3 text-[11px] text-dim">No one is live yet.</li>
        )}
        {streams.map((s) => {
          const short = s.authority.slice(0,4)+'…'+s.authority.slice(-4);
          const displayTitle = s.title?.trim() || short;
          return (
            <li key={s.id}>
              <button onClick={() => handleSelect(s.authority)} className="w-full text-left px-4 py-2 flex items-center justify-between hover:bg-white/5 transition">
                <div className="flex flex-col min-w-0">
                  <span className="truncate text-white/90">{displayTitle}</span>
                  <span className="text-[10px] text-white/50">Host {short}</span>
                  <span className="text-[10px] text-dim">{s.viewerCount} viewers</span>
                </div>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--accent)]/80 text-[var(--accent-contrast)] text-[9px] uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>Live
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="p-4 text-[11px] text-dim border-t border-white/10">Click a host to load their stream and poll.</div>
    </aside>
  );
}

export default TwitchSidebar;
