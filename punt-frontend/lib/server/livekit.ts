import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import type { VideoGrant } from "livekit-server-sdk";

const API_KEY = process.env.LIVEKIT_API_KEY;
const API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export type LiveKitRole = "host" | "viewer";

export function assertLiveKitConfigured() {
  if (!API_KEY || !API_SECRET || !LIVEKIT_URL) {
    throw new Error("LiveKit env vars (LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL) must be set");
  }
}

export function websocketUrl() {
  assertLiveKitConfigured();
  return LIVEKIT_URL as string;
}

export function apiBaseUrl() {
  assertLiveKitConfigured();
  if (!LIVEKIT_URL) return "";
  if (LIVEKIT_URL.startsWith("wss://")) return `https://${LIVEKIT_URL.slice(6)}`;
  if (LIVEKIT_URL.startsWith("ws://")) return `http://${LIVEKIT_URL.slice(5)}`;
  return LIVEKIT_URL;
}

let cachedRoomClient: RoomServiceClient | null = null;

export function getRoomServiceClient() {
  assertLiveKitConfigured();
  if (cachedRoomClient) return cachedRoomClient;
  cachedRoomClient = new RoomServiceClient(apiBaseUrl(), API_KEY!, API_SECRET!);
  return cachedRoomClient;
}

export async function mintAccessToken(opts: {
  roomName: string;
  identity: string;
  role: LiveKitRole;
  ttlSeconds?: number;
  metadata?: string;
}) {
  assertLiveKitConfigured();
  const { roomName, identity, role, ttlSeconds = 60, metadata } = opts;
  const token = new AccessToken(API_KEY!, API_SECRET!, { identity, ttl: ttlSeconds, metadata });
  const grant: VideoGrant = {
    room: roomName,
    canSubscribe: true,
    roomJoin: true,
  };
  if (role === "host") {
    grant.canPublish = true;
    grant.canPublishData = true;
    grant.roomCreate = true;
  } else {
    grant.canPublish = false;
    grant.canPublishData = false;
  }
  token.addGrant(grant);
  return token.toJwt();
}

export async function fetchRoomStatus(roomName: string) {
  try {
    const client = getRoomServiceClient();
  const rooms = await client.listRooms([roomName]);
    const room = rooms[0];
    if (!room) return { isActive: false, participantCount: 0 };
    const participants = await client.listParticipants(roomName);
    return {
      isActive: participants.length > 0,
      participantCount: participants.length,
    };
  } catch (err) {
    console.warn("[livekit] room status fetch failed", err);
    return null;
  }
}
