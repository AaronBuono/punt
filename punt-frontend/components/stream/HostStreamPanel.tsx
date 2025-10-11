"use client";
import useSWR from "swr";
import { useState, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { StreamPlayer } from "./StreamPlayer";

interface StreamResponse { stream: { id: string; playbackUrl: string; streamKey: string; active: boolean; viewerCount?: number } | null }

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json());

export function HostStreamPanel() {
  const { publicKey, signMessage } = useWallet();
  const canSign = Boolean(signMessage);
  const authority = publicKey?.toBase58();
  const getKey = useMemo(() => (authority ? `/api/stream?authority=${authority}` : null), [authority]);
  const { data, mutate, isLoading } = useSWR<StreamResponse>(getKey, fetcher, { refreshInterval: 5000 });
  const [creating, setCreating] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stream = data?.stream;

  const createStream = async () => {
    setCreating(true);
    try {
      if (!authority || !signMessage) throw new Error("Wallet must support signMessage");
      const ts = Date.now().toString();
      const msg = `provision-stream:${authority}:${ts}`;
      const sig = bs58.encode(await signMessage(new TextEncoder().encode(msg)));
      await fetch("/api/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authority, ts, sig }) });
      await mutate();
    } finally {
      setCreating(false);
    }
  };

  const refreshStatus = async () => {
    if (!authority || !signMessage) throw new Error("Wallet must support signMessage");
    const ts = Date.now().toString();
    const msg = `refresh-stream:${authority}:${ts}`;
    const sig = bs58.encode(await signMessage(new TextEncoder().encode(msg)));
    await fetch("/api/stream", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authority, ts, sig }),
      cache: 'no-store',
    });
    await mutate();
  };

  const stopStream = async () => {
    setStopping(true);
    try {
      if (!authority || !signMessage) throw new Error("Wallet must support signMessage");
      const ts = Date.now().toString();
      const msg = `stop-stream:${authority}:${ts}`;
      const sig = bs58.encode(await signMessage(new TextEncoder().encode(msg)));
      await fetch("/api/stream", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authority, ts, sig }), cache: 'no-store' });
      await mutate();
    } finally {
      setStopping(false);
    }
  };

  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="card-header">Livestream</h2>
        <div className="flex items-center gap-2">
          {!authority && <span className="text-[10px] text-dim">Connect wallet to manage stream</span>}
          {authority && stream && (
            <span className={`tag ${stream.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-white/80'}`}>{stream.active ? "You're Live" : "Provisioned • Offline"}</span>
          )}
          {authority && !stream && (
            <button disabled={creating || !canSign} onClick={createStream} className="btn btn-sm">{creating ? "..." : "Create Stream"}</button>
          )}
          {authority && stream && (
            <>
              <button disabled={!canSign} onClick={refreshStatus} className="btn btn-sm btn-outline disabled:opacity-50">Refresh</button>
              <button disabled={stopping || !canSign} onClick={stopStream} className="btn btn-sm btn-warning">{stopping? '...' : 'Stop Stream'}</button>
            </>
          )}
        </div>
      </div>
      {isLoading && <p className="text-[11px] text-dim">Loading stream info...</p>}
      {authority && stream && (
        <>
          <div className="relative">
            <StreamPlayer playbackUrl={stream.playbackUrl} />
            <div className="absolute top-2 right-2 flex items-center gap-2 text-[10px] bg-black/55 backdrop-blur px-2 py-1 rounded border border-white/10">
              <span className={`w-2 h-2 rounded-full ${stream.active ? 'bg-[var(--accent)] animate-pulse' : 'bg-gray-500'}`} />
              <span className="font-semibold">{stream.active ? 'LIVE' : 'OFFLINE'}</span>
              <span className="text-white/60">•</span>
              <span className="font-medium">{stream.viewerCount ?? 0} viewers</span>
            </div>
          </div>
          <div className="text-[10px] grid gap-1">
            <div><span className="text-dim">Stream ID:</span> {stream.id}</div>
            <div><span className="text-dim">Status:</span> {stream.active ? <span className="text-green-500 font-semibold">Live</span> : <span className="text-dim">Offline</span>}</div>
            <div><span className="text-dim">Viewers:</span> {stream.viewerCount ?? 0}</div>
            <div className="mt-1 pt-2 border-t border-white/10">
              <span className="text-dim">RTMP Stream Key:</span>
              <div className="mt-1 p-2 rounded bg-black/40 font-mono text-[10px] break-all select-all">{stream.streamKey}</div>
              {!stream.active && (
                <>
                  <p className="text-[10px] text-dim mt-1">Use OBS / ffmpeg: <code>rtmp://your-ingest.example/live</code></p>
                  <p className="text-[10px] text-dim mt-1">Viewer link: share <code className="select-all">/watch?authority=<span className="text-white">{authority}</span></code></p>
                </>
              )}
            </div>
          </div>
        </>
      )}
      {authority && !canSign && (
        <p className="text-[10px] text-amber-300">Your wallet doesn’t support message signing. Use a wallet/app that supports signMessage to create/stop streams.</p>
      )}
      {authority && !stream && !isLoading && (
        <p className="text-[11px] text-dim">No stream provisioned yet. Create one to generate a key.</p>
      )}
    </div>
  );
}
