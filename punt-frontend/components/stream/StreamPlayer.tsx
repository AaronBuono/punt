"use client";
import { ReactNode, useEffect, useRef, useState } from "react";
import Hls, { ErrorData } from "hls.js";

interface StreamPlayerProps {
  playbackUrl?: string | null;
  poster?: string;
  autoPlay?: boolean;
  children?: ReactNode; // optional overlay content
}

export function StreamPlayer({ playbackUrl, poster, autoPlay = true, children }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playbackUrl) return;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = playbackUrl;
      if (autoPlay) video.play().catch(() => {});
    } else if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_evt: string, data: ErrorData) => {
        if (data?.fatal) {
          setSupported(false);
          hls.destroy();
        }
      });
      if (autoPlay) video.play().catch(() => {});
      return () => hls.destroy();
    } else {
      setSupported(false);
    }
  }, [playbackUrl, autoPlay]);

  // Helper to snap playback to the live edge on demand
  const goLive = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const seekable = video.seekable;
      if (seekable && seekable.length > 0) {
        const liveEdge = seekable.end(seekable.length - 1);
        // Seek to just behind the edge to ensure we have buffer
        const target = Math.max(0, liveEdge - 0.5);
        video.currentTime = target;
        // Ensure normal rate and play
        video.playbackRate = 1.0;
        video.play().catch(() => {});
      }
    } catch {/* ignore */}
  };

  if (!playbackUrl) {
    return (
      <div className="aspect-video w-full flex items-center justify-center bg-white/5 rounded-md text-[11px] text-dim">No stream</div>
    );
  }

  if (!supported) {
    return <div className="aspect-video w-full flex items-center justify-center bg-white/5 rounded-md text-xs">HLS not supported</div>;
  }

  return (
    <div className="relative w-full aspect-video rounded-md overflow-hidden bg-black border border-white/10">
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        poster={poster}
        playsInline
        controls
        muted
      />
      {children}
      <button
        type="button"
        onClick={goLive}
        className={"absolute top-1.5 left-2 px-2 py-1 text-[10px] font-semibold rounded uppercase tracking-wide flex items-center gap-1 transition-colors bg-[var(--accent)]/80 hover:bg-[var(--accent)]/90 text-white"}
        title="Live"
        aria-label="Live"
      >
        <span className="inline-block w-2 h-2 rounded-full bg-white" />
        Live
      </button>
    </div>
  );
}
