"use client";
import useSWR from "swr";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { LiveKitRoom } from "./LiveKitRoom";
import { useToast } from "@/components/ToastProvider";

interface StreamResponse {
  stream: {
    authority: string;
    roomName: string;
    active: boolean;
    viewerCount: number;
    title: string | null;
    manuallyStopped: boolean;
  } | null;
}

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(r => r.json());
const MAX_TITLE_LENGTH = 80;

export function HostStreamPanel() {
  const { publicKey, signMessage } = useWallet();
  const authority = publicKey?.toBase58();
  const canSign = Boolean(signMessage);
  const { addToast } = useToast();
  const getKey = useMemo(() => (authority ? `/api/stream?authority=${authority}` : null), [authority]);
  const { data, mutate, isLoading } = useSWR<StreamResponse>(getKey, fetcher, { refreshInterval: 7000 });
  const stream = data?.stream;

  const normalizedStreamTitle = stream?.title ?? "";
  const [titleInput, setTitleInput] = useState("");
  const [titleDirty, setTitleDirty] = useState(false);
  const [titleSaving, setTitleSaving] = useState(false);
  const [connectionState, setConnectionState] = useState<"idle" | "connecting" | "connected" | "disconnected" | "error">("idle");
  const [sessionSignature, setSessionSignature] = useState<{ ts: string; sig: string } | null>(null);
  const [roomSessionKey, setRoomSessionKey] = useState(0);
  const [loadingAction, setLoadingAction] = useState<"go" | "end" | "refresh" | "mark-offline" | null>(null);

  useEffect(() => {
    if (!titleDirty) {
      setTitleInput(normalizedStreamTitle);
    }
  }, [normalizedStreamTitle, titleDirty]);

  const handleTitleChange = useCallback((value: string) => {
    setTitleInput(value.slice(0, MAX_TITLE_LENGTH));
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
      setTitleDirty(false);
      addToast({ type: "success", message: "Stream title updated" });
      await mutate();
    } catch (err) {
      console.error("[livekit] update title failed", err);
      addToast({ type: "error", message: err instanceof Error ? err.message : "Failed to update title" });
    } finally {
      setTitleSaving(false);
    }
  }, [authority, signMessage, stream, normalizedInput, mutate, addToast]);

  const requestSignature = useCallback(async (payload: string) => {
    if (!authority || !signMessage) throw new Error("Wallet must support signMessage");
    const bytes = new TextEncoder().encode(payload);
    const signature = await signMessage(bytes);
    return bs58.encode(signature);
  }, [authority, signMessage]);

  const refreshStatus = useCallback(async () => {
    if (!authority) return;
    try {
      setLoadingAction("refresh");
      await fetch("/api/stream", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authority, action: "refresh" }),
        cache: "no-store",
      });
      await mutate();
    } catch (err) {
      addToast({ type: "error", message: err instanceof Error ? err.message : "Failed to refresh" });
    } finally {
      setLoadingAction(null);
    }
  }, [authority, mutate, addToast]);

  const markOffline = useCallback(async (opts?: { suppressLoading?: boolean }) => {
    if (!authority) return;
    try {
      if (!opts?.suppressLoading) setLoadingAction("mark-offline");
      const ts = Date.now().toString();
      const sig = await requestSignature(`stop-stream:${authority}:${ts}`);
      await fetch("/api/stream", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authority, ts, sig, action: "mark-offline" }),
        cache: "no-store",
      });
      await mutate();
      setSessionSignature(null);
      setConnectionState("idle");
    } catch (err) {
      addToast({ type: "error", message: err instanceof Error ? err.message : "Failed to end stream" });
    } finally {
      if (!opts?.suppressLoading) setLoadingAction(null);
    }
  }, [authority, requestSignature, mutate, addToast]);

  const goLive = useCallback(async () => {
    if (!authority) return;
    try {
      setLoadingAction("go");
      const ts = Date.now().toString();
      const sig = await requestSignature(`livekit-host-token:${authority}:${ts}`);
      setSessionSignature({ ts, sig });
      setRoomSessionKey(key => key + 1);
      setConnectionState("connecting");
    } catch (err) {
      addToast({ type: "error", message: err instanceof Error ? err.message : "Failed to join LiveKit" });
    } finally {
      setLoadingAction(null);
    }
  }, [authority, requestSignature, addToast]);

  const endLive = useCallback(async () => {
    setLoadingAction("end");
    setSessionSignature(null);
    setRoomSessionKey(key => key + 1);
    setConnectionState("idle");
    try {
      await markOffline({ suppressLoading: true });
    } finally {
      setLoadingAction(null);
    }
  }, [markOffline]);

  const canGoLive = Boolean(authority && canSign && sessionSignature === null);
  const showRoom = Boolean(authority && sessionSignature);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="card-header">Livestream</h2>
        <div className="flex items-center gap-2 text-[10px] text-white/70">
          {authority && (
            <span className={`tag ${connectionState === "connected" || stream?.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/75"}`}>
              {connectionState === "connected" || stream?.active ? "Live" : "Offline"}
            </span>
          )}
          {authority && stream && (
            <span className="rounded border border-white/10 bg-white/5 px-2 py-1 font-mono">Room: {stream.roomName}</span>
          )}
        </div>
      </div>

      {!authority && (
        <p className="text-[11px] text-dim">Connect a wallet to control your stream.</p>
      )}

      {authority && (
        <div className="rounded-md border border-white/10 bg-black/30 p-3 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-white/45">Stream Title</p>
              <p className="text-[10px] text-white/50">Displayed on the watch view and live listings.</p>
            </div>
            {titleDirty && (
              <button type="button" onClick={resetTitleInput} className="text-[10px] text-white/60 hover:text-white/80 underline">
                Reset
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={titleInput}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Pack opening with Ash"
              maxLength={MAX_TITLE_LENGTH}
              disabled={!canSign || titleSaving}
              className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={saveTitle}
              disabled={!hasTitleChanges || !canSign || titleSaving}
              className="btn btn-sm"
            >
              {titleSaving ? "..." : "Save"}
            </button>
          </div>
          <div className="text-[10px] text-white/40 flex items-center justify-between">
            <span>{titleInput.length}/{MAX_TITLE_LENGTH} characters</span>
            <span>{stream?.title ? "" : "Viewers will see this in directories."}</span>
          </div>
        </div>
      )}

      {authority && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goLive}
            disabled={!canGoLive || loadingAction === "go"}
            className="btn btn-sm"
          >
            {loadingAction === "go" ? "Joining..." : "Go Live"}
          </button>
          <button
            type="button"
            onClick={endLive}
            disabled={!sessionSignature || loadingAction === "end"}
            className="btn btn-sm btn-warning"
          >
            {loadingAction === "end" ? "Ending..." : "End Stream"}
          </button>
          <button
            type="button"
            onClick={refreshStatus}
            disabled={!canSign || loadingAction === "refresh"}
            className="btn btn-sm btn-outline"
          >
            {loadingAction === "refresh" ? "Refreshing..." : "Refresh Status"}
          </button>
          <button
            type="button"
            onClick={() => markOffline()}
            disabled={!canSign || loadingAction === "mark-offline"}
            className="btn btn-sm btn-outline"
          >
            {loadingAction === "mark-offline" ? "Marking..." : "Mark Offline"}
          </button>
          <span className="text-[10px] text-white/50">
            Viewers: {stream?.viewerCount ?? 0}
          </span>
        </div>
      )}

      {authority && showRoom && sessionSignature && (
        <LiveKitRoom
          key={roomSessionKey}
          authority={authority}
          identity={authority}
          role="host"
          signature={sessionSignature}
          autoPublish
          onConnectionStateChange={state => {
            setConnectionState(state);
            if (state === "connected") {
              mutate();
            }
            if (state === "disconnected" || state === "error") {
              mutate();
            }
          }}
          onError={err => {
            console.warn("[livekit] room error", err);
            setSessionSignature(null);
            setConnectionState("error");
          }}
        />
      )}

      {authority && !showRoom && (
        <div className="aspect-video w-full rounded-md border border-dashed border-white/15 bg-black/30 text-[11px] text-white/60 flex items-center justify-center">
          Click “Go Live” to join your LiveKit room from the browser.
        </div>
      )}

      {isLoading && <p className="text-[11px] text-dim">Loading stream info...</p>}
      {authority && !canSign && (
        <p className="text-[10px] text-amber-300">Your wallet must support message signing to manage LiveKit tokens.</p>
      )}
    </div>
  );
}
