import { NextRequest } from "next/server";
import { ensureAuthorityStream, defaultRoomName } from "@/lib/server/streamStore";
import { getRoomServiceClient } from "@/lib/server/livekit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface TriggerRequestBody {
  authority?: string;
}

const AI_SCAN_TOPIC = process.env.LIVEKIT_AI_SCAN_TOPIC ?? "punt.ai.scan";
const PROGRAM_IDENTITY = process.env.LIVEKIT_PROGRAM_IDENTITY ?? "";

export async function POST(req: NextRequest) {
  if (!PROGRAM_IDENTITY) {
    return Response.json({ error: "LIVEKIT_PROGRAM_IDENTITY not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as TriggerRequestBody;
  const authority = typeof body.authority === "string" ? body.authority.trim() : "";

  if (!authority) {
    return Response.json({ error: "authority required" }, { status: 400 });
  }

  let roomName: string | undefined;
  let currentMarket: string | null | undefined;
  try {
    const record = await ensureAuthorityStream(authority);
    roomName = record?.roomName;
    currentMarket = record?.currentMarketPubkey ?? null;
  } catch (err) {
    console.warn("[ai-agent] ensureAuthorityStream failed, falling back to default room", err);
  }

  roomName ||= defaultRoomName(authority);

  try {
    const client = getRoomServiceClient();
    const payloadObj = {
      type: "ai-scan-trigger",
      identity: PROGRAM_IDENTITY,
      authority,
      message: "🤖 Triggering AI card scan",
      topic: AI_SCAN_TOPIC,
      market: currentMarket ?? null,
      ts: Date.now(),
    };
    const payload = new TextEncoder().encode(JSON.stringify(payloadObj));

    await client.sendData(roomName, payload, 0, {
      topic: AI_SCAN_TOPIC,
    });

    console.info("[ai-agent] scan trigger sent", { authority, roomName, topic: AI_SCAN_TOPIC });
    return Response.json({ ok: true, message: "AI scan triggered", cardsScanned: 0 });
  } catch (err) {
    console.error("[ai-agent] trigger failed", err);
    const message = err instanceof Error ? err.message : "internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
