"use client";
import useSWR from "swr";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { StreamPlayer } from "./StreamPlayer";
import { useToast } from "@/components/ToastProvider";

interface StreamResponse { stream: { id: string; playbackUrl: string; streamKey: string; active: boolean; viewerCount?: number; title?: string | null } | null }

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json());
const MAX_TITLE_LENGTH = 80;

export function HostStreamPanel() {
  const { publicKey, signMessage } = useWallet();
  const canSign = Boolean(signMessage);
  const authority = publicKey?.toBase58();
  const getKey = useMemo(() => (authority ? `/api/stream?authority=${authority}` : null), [authority]);
  const { data, mutate, isLoading } = useSWR<StreamResponse>(getKey, fetcher, { refreshInterval: 5000 });
  const [creating, setCreating] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [titleDirty, setTitleDirty] = useState(false);
  const [titleSaving, setTitleSaving] = useState(false);
  const stream = data?.stream;
  const { addToast } = useToast();

  const normalizedStreamTitle = stream?.title ?? "";

  useEffect(() => {
    if (!titleDirty) {
      setTitleInput(normalizedStreamTitle);
    }
  }, [normalizedStreamTitle, titleDirty]);

  const handleTitleChange = useCallback((value: string) => {
    const limited = value.slice(0, MAX_TITLE_LENGTH);
    setTitleInput(limited);
    setTitleDirty(true);
  }, []);

  const resetTitleInput = useCallback(() => {
    setTitleInput(normalizedStreamTitle);
    setTitleDirty(false);
  }, [normalizedStreamTitle]);

  const normalizedInput = useMemo(() => titleInput.replace(/\s+/g, " ").trim(), [titleInput]);
  const normalizedServer = useMemo(() => normalizedStreamTitle.replace(/\s+/g, " ").trim(), [normalizedStreamTitle]);
  const hasTitleChanges = normalizedInput !== normalizedServer;

  const saveTitle = useCallback(async () => {
    if (!authority || !signMessage || !stream) return;
    const payload = normalizedInput;
    setTitleSaving(true);
    try {
      const ts = Date.now().toString();
      const msg = `update-stream:${authority}:${ts}`;
      const sig = bs58.encode(await signMessage(new TextEncoder().encode(msg)));
      const res = await fetch("/api/stream", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authority, ts, sig, action: "update-title", title: payload }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update title" }));
        const message = typeof err?.error === "string" ? err.error : "Failed to update title";
        throw new Error(message);
      }
  setTitleInput(payload);
      addToast({ type: "success", message: "Stream title updated" });
  await mutate();
  setTitleDirty(false);
    } catch (err) {
      console.error("[stream] failed to update title", err);
      const message = err instanceof Error ? err.message : "Failed to update title";
      addToast({ type: "error", message });
    } finally {
      setTitleSaving(false);
    }
  }, [authority, signMessage, stream, normalizedInput, mutate, addToast]);

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
      {authority && (
        <div className="rounded-md border border-white/10 bg-black/30 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">Stream Title</p>
              <p className="text-[10px] text-white/50">Displayed on the watch view and live listings.</p>
            </div>
            {titleDirty && (
              <button
                type="button"
                onClick={resetTitleInput}
                className="text-[10px] text-white/60 hover:text-white/80 underline"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <input
              value={titleInput}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Pack opening with Ash"
              maxLength={MAX_TITLE_LENGTH}
              disabled={!stream || !canSign || titleSaving}
              className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={saveTitle}
              disabled={!stream || !canSign || titleSaving || !hasTitleChanges}
              className="btn btn-sm"
            >
              {titleSaving ? "..." : "Save"}
            </button>
          </div>
          <div className="text-[10px] text-white/40 flex items-center justify-between">
            <span>{titleInput.length}/{MAX_TITLE_LENGTH} characters</span>
            {!stream && <span>Provision a stream to enable editing.</span>}
          </div>
        </div>
      )}
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
            <div><span className="text-dim">Title:</span> {stream.title?.trim() || 'Not set'}</div>
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
