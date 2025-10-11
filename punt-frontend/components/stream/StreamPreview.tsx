"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Hls from "hls.js";

interface StreamPreviewProps {
  playbackUrl?: string | null;
  fallbackSrc: string;
}

export function StreamPreview({ playbackUrl, fallbackSrc }: StreamPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [readyToLoad, setReadyToLoad] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);

  useEffect(() => {
    const observeEl = containerRef.current;
    if (!observeEl) return;
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setReadyToLoad(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(observeEl);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSnapshot(null);
  }, [playbackUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!readyToLoad || !playbackUrl || !video) return;

    let cancelled = false;

    const captureFrame = () => {
      if (!video.videoWidth || !video.videoHeight) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.8);
        if (!cancelled) setSnapshot(data);
      } catch {
        // ignore canvas errors; stay on fallback image
      }
    };

    const handleCanPlay = () => {
      captureFrame();
      cleanupPlayback();
    };

    const cleanupPlayback = () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };

    const attach = async () => {
      try {
        video.addEventListener("canplay", handleCanPlay, { once: true });
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = playbackUrl;
        } else if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true });
          hls.loadSource(playbackUrl);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event: string, payload: unknown) => {
            const data = payload as { fatal?: boolean } | undefined;
            if (data?.fatal) {
              hls.destroy();
              hlsRef.current = null;
            }
          });
          hlsRef.current = hls;
        }
        await video.play().catch(() => {});
      } catch {
        video.removeEventListener("canplay", handleCanPlay);
      }
    };

    attach();

    return () => {
      cancelled = true;
      video.removeEventListener("canplay", handleCanPlay);
      cleanupPlayback();
    };
  }, [readyToLoad, playbackUrl]);

  return (
    <div ref={containerRef} className="relative aspect-video bg-black/70 overflow-hidden">
      <Image
        src={snapshot || fallbackSrc}
        alt="Stream preview"
        fill
        priority={false}
        sizes="(max-width: 768px) 100vw, 33vw"
        className="object-cover"
      />
      <video ref={videoRef} className="hidden" muted playsInline preload="auto" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
    </div>
  );
}

export default StreamPreview;
