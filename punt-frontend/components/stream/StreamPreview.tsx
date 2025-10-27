"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { RemoteVideoTrack, Room, RoomEvent, Track, type RoomConnectOptions } from "livekit-client";

interface StreamPreviewProps {
  authority: string;
  roomName: string;
  active: boolean;
  className?: string;
  refreshKey?: number | string | null;
}

interface PreviewState {
  status: "idle" | "loading" | "ready" | "failed";
  url: string | null;
}

export function StreamPreview({ authority, roomName, active, className, refreshKey }: StreamPreviewProps) {
  const [preview, setPreview] = useState<PreviewState>({ status: "idle", url: null });
  const identityRef = useRef<string | null>(null);
  const attemptRef = useRef(0);
  const previewReadyRef = useRef(false);

  const identity = useMemo(() => {
    if (identityRef.current) return identityRef.current;
    const seed = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `id-${Math.random().toString(36).slice(2)}`;
    identityRef.current = `preview-${seed}`;
    return identityRef.current;
  }, []);

  useEffect(() => {
    previewReadyRef.current = preview.status === "ready" && !!preview.url;
  }, [preview]);

  useEffect(() => {
    if (!active) {
      setPreview({ status: "idle", url: null });
      previewReadyRef.current = false;
      return;
    }

    if (previewReadyRef.current) {
      return;
    }

    attemptRef.current = 0;
    let cancelled = false;
    let room: Room | null = null;
    let detachTrack: (() => void) | null = null;
    let timeoutId: number | null = null;
    const maxAttempts = 2;
    let captured = false;

    const cleanup = () => {
      if (timeoutId !== null && typeof window !== "undefined") {
        window.clearTimeout(timeoutId);
      }
      timeoutId = null;
      if (detachTrack) {
        try {
          detachTrack();
        } catch {/* ignore */}
        detachTrack = null;
      }
      if (room) {
        try {
          room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
          room.disconnect();
        } catch {/* ignore */}
      }
      room = null;
    };

    const captureFrame = (track: RemoteVideoTrack) => {
      if (cancelled) return;
      const videoEl = document.createElement("video");
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.autoplay = true;
      videoEl.crossOrigin = "anonymous";
      const handleLoaded = () => {
        if (!videoEl.videoWidth || !videoEl.videoHeight) {
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
          setPreview({ status: "ready", url: dataUrl });
          captured = true;
        } catch {
          setPreview(prev => ({ ...prev, status: "failed" }));
        } finally {
          cleanup();
        }
      };

      detachTrack = () => {
        track.detach(videoEl);
        videoEl.removeEventListener("loadeddata", handleLoaded);
      };

      videoEl.addEventListener("loadeddata", handleLoaded, { once: true });
      track.attach(videoEl);
    };

    const handleTrackSubscribed = (_track: Track, publication: unknown, participant: unknown) => {
      if (cancelled) return;
      if (_track.kind !== Track.Kind.Video) return;
      const track = _track as RemoteVideoTrack;
      captureFrame(track);
    };

    const connect = async () => {
      setPreview(prev => (prev.url ? prev : { status: "loading", url: prev.url }));
      try {
        const resp = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ authority, identity, role: "viewer" }),
        });
        if (!resp.ok) {
          throw new Error(`token request failed (${resp.status})`);
        }
        const data = await resp.json() as { token: string; url: string };
        if (cancelled) return;
        room = new Room();
        const options: RoomConnectOptions = { autoSubscribe: true };
        await room.connect(data.url, data.token, options);
        if (cancelled) return;

  room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);

        // Handle already subscribed tracks
        room.remoteParticipants.forEach(participant => {
          participant.trackPublications.forEach(pub => {
            const track = pub.track;
            if (track && track.kind === Track.Kind.Video) {
              captureFrame(track as RemoteVideoTrack);
            }
          });
        });

        timeoutId = typeof window !== "undefined"
          ? window.setTimeout(() => {
              if (!cancelled && !captured) {
                cleanup();
                setPreview(prev => ({ ...prev, status: "failed" }));
              }
            }, 7000)
          : null;
      } catch (err) {
        cleanup();
        if (attemptRef.current < maxAttempts) {
          attemptRef.current += 1;
          if (!cancelled) connect();
          return;
        }
        console.warn("[stream-preview] failed to load preview", err);
        setPreview(prev => ({ ...prev, status: "failed" }));
      }
    };

    connect();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [active, authority, identity, refreshKey, roomName]);

  const { status, url } = preview;
  const showFallback = status !== "ready" || !url;

  return (
    <div className={`absolute inset-0 ${className ?? ""}`}>
      {showFallback ? (
        <div className="flex h-full w-full items-center justify-center bg-black/70 text-[11px] uppercase tracking-[0.25em] text-white/60">
          {status === "failed" ? "Preview unavailable" : "Loading preview"}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={`Live preview for ${roomName}`}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}
