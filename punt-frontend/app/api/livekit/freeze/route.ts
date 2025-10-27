import { NextRequest } from "next/server";
import { verifySignature } from "@/lib/server/signature";
import { verifyAuthorityTransaction } from "@/lib/server/solana";
import { ensureAuthorityStream, defaultRoomName } from "@/lib/server/streamStore";
import { getRoomServiceClient } from "@/lib/server/livekit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface FreezeRequestBody {
  authority?: string;
  ts?: string | number;
  sig?: string;
  txSig?: string;
}

const FREEZE_TOPIC = process.env.LIVEKIT_FREEZE_TOPIC ?? "punt.freeze";
const FREEZE_MESSAGE = process.env.FREEZE_CHAT_MESSAGE ?? "🧊 Poll frozen by host";
const PROGRAM_IDENTITY = process.env.LIVEKIT_PROGRAM_IDENTITY ?? "";

export async function POST(req: NextRequest) {
  if (!PROGRAM_IDENTITY) {
    return Response.json({ error: "LIVEKIT_PROGRAM_IDENTITY not configured" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as FreezeRequestBody;
  const authority = typeof body.authority === "string" ? body.authority.trim() : "";
  const tsValue = body.ts;
  const tsRaw = typeof tsValue === "string" ? tsValue.trim() : typeof tsValue === "number" ? tsValue.toString() : "";
  const sig = typeof body.sig === "string" ? body.sig : "";
  const txSig = typeof body.txSig === "string" ? body.txSig.trim() : "";

  if (!authority) {
    return Response.json({ error: "authority required" }, { status: 400 });
  }
  if (!txSig) {
    if (!tsRaw) {
      return Response.json({ error: "timestamp required" }, { status: 400 });
    }
    if (!sig) {
      return Response.json({ error: "signature required" }, { status: 400 });
    }

    const tsNumber = Number(tsRaw);
    const age = Math.abs(Date.now() - tsNumber);
    if (!Number.isFinite(age) || age > 60_000) {
      return Response.json({ error: "expired signature" }, { status: 400 });
    }

    const message = `freeze-market:${authority}:${tsRaw}`;
    if (!verifySignature(authority, message, sig)) {
      return Response.json({ error: "invalid signature" }, { status: 401 });
    }
  } else {
    const ok = await verifyAuthorityTransaction(txSig, authority, { expectedLog: "Instruction: FreezeMarket" });
    if (!ok) {
      return Response.json({ error: "invalid txSig" }, { status: 401 });
    }
  }

  let roomName: string | undefined;
  let currentMarket: string | null | undefined;
  let currentMarketCycle: number | null | undefined;
  try {
    const record = await ensureAuthorityStream(authority);
    roomName = record?.roomName;
    currentMarket = record?.currentMarketPubkey ?? null;
    currentMarketCycle = typeof record?.currentMarketCycle === "number" ? record.currentMarketCycle : null;
  } catch (err) {
    console.warn("[livekit] ensureAuthorityStream failed, falling back to default room", err);
  }

  roomName ||= defaultRoomName(authority);

  try {
    const client = getRoomServiceClient();
    const payloadObj = {
      type: "freeze",
      identity: PROGRAM_IDENTITY,
      authority,
      message: FREEZE_MESSAGE,
      topic: FREEZE_TOPIC,
      market: currentMarket ?? null,
      marketCycle: currentMarketCycle,
      ts: Date.now(),
      txSig: txSig || undefined,
    };
    const payload = new TextEncoder().encode(JSON.stringify(payloadObj));

    await client.sendData(roomName, payload, 0, {
      topic: FREEZE_TOPIC,
    });

    console.info("[livekit] freeze broadcast sent", { authority, roomName, topic: FREEZE_TOPIC });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("[livekit] freeze publish failed", err);
    const message = err instanceof Error ? err.message : "internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
