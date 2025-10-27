"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createLocalTracks,
  LocalAudioTrack,
  LocalTrack,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteVideoTrack,
  Room,
  RoomEvent,
  Track,
  TrackPublication,
  VideoPresets,
  type RoomConnectOptions,
} from "livekit-client";
import { setLogLevel, LogLevel } from "livekit-client";

export type LiveKitRole = "host" | "viewer";

interface LiveKitRoomProps {
  authority: string;
  identity: string;
  role: LiveKitRole;
  signature?: { ts: string; sig: string } | null;
  className?: string;
  autoPublish?: boolean;
  onConnectionStateChange?: (state: "connecting" | "connected" | "disconnected" | "error") => void;
  onError?: (error: unknown) => void;
  overlay?: React.ReactNode;
}

interface TokenResponse {
  token: string;
  url: string;
  roomName: string;
}

export function LiveKitRoom({
  authority,
  identity,
  role,
  signature,
  className,
  autoPublish = false,
  onConnectionStateChange,
  onError,
  overlay,
}: LiveKitRoomProps) {
  setLogLevel(LogLevel.debug);
  const roomRef = useRef<Room | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  type RemoteTile = { publication: RemoteTrackPublication; participant: RemoteParticipant };
  const [remoteEntries, setRemoteEntries] = useState<RemoteTile[]>([]);
  const [localVideoTracks, setLocalVideoTracks] = useState<LocalVideoTrack[]>([]);
  const [localAudioTracks, setLocalAudioTracks] = useState<LocalAudioTrack[]>([]);

  const connectionHandlerRef = useRef<typeof onConnectionStateChange>(onConnectionStateChange);
  useEffect(() => { connectionHandlerRef.current = onConnectionStateChange; }, [onConnectionStateChange]);

  const errorHandlerRef = useRef<typeof onError>(onError);
  useEffect(() => { errorHandlerRef.current = onError; }, [onError]);

  const localAudioTracksRef = useRef<LocalAudioTrack[]>([]);
  const localVideoTracksRef = useRef<LocalVideoTrack[]>([]);

  useEffect(() => {
    let cancelled = false;

    const updateRemoteEntries = () => {
      const room = roomRef.current;
      if (!room) return;
      const tiles: RemoteTile[] = [];
      room.remoteParticipants.forEach((participant: RemoteParticipant) => {
        participant.trackPublications.forEach((pub: TrackPublication) => {
          if (pub.kind === Track.Kind.Video && pub.isSubscribed) {
            tiles.push({ publication: pub as RemoteTrackPublication, participant });
          }
        });
      });
      setRemoteEntries(tiles);
    };

    const stopLocalTracks = () => {
      localAudioTracksRef.current.forEach((track: LocalAudioTrack) => {
        try {
          track.stop();
        } catch {/* ignore */}
      });
      localVideoTracksRef.current.forEach((track: LocalVideoTrack) => {
        try {
          track.stop();
        } catch {/* ignore */}
      });
      localAudioTracksRef.current = [];
      localVideoTracksRef.current = [];
      setLocalAudioTracks([]);
      setLocalVideoTracks([]);
    };

    const detachRemoteMedia = () => {
      roomRef.current?.remoteParticipants.forEach((participant: RemoteParticipant) => {
        participant.trackPublications.forEach((pub: TrackPublication) => {
          if (pub.kind === Track.Kind.Video) {
            pub.videoTrack?.detach();
          }
          if (pub.kind === Track.Kind.Audio) {
            pub.audioTrack?.detach();
          }
        });
      });
    };

    async function start() {
      setConnecting(true);
      setConnected(false);
      setErrorMessage(null);
      connectionHandlerRef.current?.("connecting");
      try {
        const resp = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            authority,
            identity,
            role,
            ts: signature?.ts,
            sig: signature?.sig,
          }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || "LiveKit token request failed");
        }
        const { token, url }: TokenResponse = await resp.json();
        if (cancelled) return;

        const room = new Room();
        const connectOptions: RoomConnectOptions = { autoSubscribe: true };
        await room.connect(url, token, connectOptions);
        if (cancelled) {
          room.disconnect();
          return;
        }

        roomRef.current = room;
        setConnecting(false);
        setConnected(true);
        connectionHandlerRef.current?.("connected");
        updateRemoteEntries();

        const handleTrackChange = () => updateRemoteEntries();
        const handleDisconnect = () => {
          setConnected(false);
          connectionHandlerRef.current?.("disconnected");
        };

        room.on(RoomEvent.TrackSubscribed, handleTrackChange);
        room.on(RoomEvent.TrackUnsubscribed, handleTrackChange);
        room.on(RoomEvent.ParticipantDisconnected, handleTrackChange);
        room.on(RoomEvent.ParticipantConnected, handleTrackChange);
        room.on(RoomEvent.Disconnected, handleDisconnect);

        if (role === "host" && autoPublish) {
          try {
            const tracks = await createLocalTracks({
              audio: true,
              video: { resolution: VideoPresets.h720.resolution },
            });
            if (cancelled) {
              tracks.forEach((track: LocalTrack) => track.stop());
              return;
            }
            const audio: LocalAudioTrack[] = [];
            const video: LocalVideoTrack[] = [];
            for (const track of tracks) {
              if (track.kind === Track.Kind.Audio) {
                audio.push(track as LocalAudioTrack);
              } else if (track.kind === Track.Kind.Video) {
                video.push(track as LocalVideoTrack);
              }
              await room.localParticipant.publishTrack(track, { simulcast: true }).catch((err: unknown) => {
                console.warn("[livekit] publishTrack failed", err);
              });
            }
            localAudioTracksRef.current = audio;
            localVideoTracksRef.current = video;
            setLocalAudioTracks(audio);
            setLocalVideoTracks(video);
          } catch (err) {
            console.warn("[livekit] failed to publish local tracks", err);
          }
        }

        room.once(RoomEvent.Disconnected, () => {
          room.off(RoomEvent.TrackSubscribed, handleTrackChange);
          room.off(RoomEvent.TrackUnsubscribed, handleTrackChange);
          room.off(RoomEvent.ParticipantDisconnected, handleTrackChange);
          room.off(RoomEvent.ParticipantConnected, handleTrackChange);
          room.off(RoomEvent.Disconnected, handleDisconnect);
          stopLocalTracks();
          detachRemoteMedia();
          setRemoteEntries([]);
        });
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unable to join stream";
        setErrorMessage(message);
        setConnecting(false);
        setConnected(false);
        connectionHandlerRef.current?.("error");
        errorHandlerRef.current?.(err);
      }
    }

    start();

    return () => {
      cancelled = true;
      const room = roomRef.current;
      roomRef.current = null;
      if (room) {
        room.disconnect();
      }
      stopLocalTracks();
      detachRemoteMedia();
      setRemoteEntries([]);
      connectionHandlerRef.current?.("disconnected");
    };
  }, [authority, identity, role, signature?.ts, signature?.sig, autoPublish]);

  const localTiles = useMemo(() => localVideoTracks.map(track => (
    <VideoTile key={track.sid} track={track} isLocal />
  )), [localVideoTracks]);

  const remoteVideoTiles = useMemo(() => remoteEntries.map(tile => (
    <VideoTile
      key={tile.publication.trackSid}
      track={tile.publication.videoTrack ?? null}
      participant={tile.participant}
    />
  )), [remoteEntries]);

  return (
    <div className={`relative w-full aspect-video overflow-hidden rounded-md border border-white/10 bg-black ${className || ""}`}>
      <div className="absolute inset-0 grid h-full w-full grid-cols-1 gap-2 bg-black">
        {remoteVideoTiles.length ? remoteVideoTiles : localTiles.length ? localTiles : (
          <div className="flex h-full w-full items-center justify-center text-[11px] text-white/60">
            {connecting && "Connecting to LiveKit..."}
            {!connecting && !connected && !errorMessage && "Waiting for host"}
            {errorMessage && "Stream unavailable"}
          </div>
        )}
      </div>
      {overlay}
    </div>
  );
}

function VideoTile({ track, participant, isLocal }: { track: LocalVideoTrack | RemoteVideoTrack | null; participant?: RemoteParticipant | null; isLocal?: boolean; }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachedTrackRef = useRef<Track | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    const nextTrack = track ?? null;
    if (!video || !nextTrack) {
      if (attachedTrackRef.current) {
        attachedTrackRef.current.detach();
        attachedTrackRef.current = null;
      }
      return;
    }
    if (attachedTrackRef.current !== nextTrack) {
      if (attachedTrackRef.current) {
        attachedTrackRef.current.detach(video);
      }
      nextTrack.attach(video);
      attachedTrackRef.current = nextTrack;
    }
    return () => {
      if (attachedTrackRef.current) {
        attachedTrackRef.current.detach();
        attachedTrackRef.current = null;
      }
    };
  }, [track]);

  const label = useMemo(() => {
    if (isLocal) return "You";
    if (!participant) return "";
    return participant.identity || participant.sid;
  }, [participant, isLocal]);

  return (
    <div className="relative h-full w-full">
      <video ref={videoRef} className="h-full w-full object-cover" autoPlay playsInline muted={isLocal} />
      {label && (
        <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] font-semibold text-white">
          {label}
        </div>
      )}
    </div>
  );
}
