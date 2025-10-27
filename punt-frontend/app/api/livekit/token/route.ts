import { NextRequest } from "next/server";
import { verifySignature } from "@/lib/server/signature";
import { ensureAuthorityStream, clearManualStop, defaultRoomName, type AuthorityStreamRecord } from "@/lib/server/streamStore";
import { mintAccessToken, websocketUrl } from "@/lib/server/livekit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const authority = typeof body.authority === "string" ? body.authority.trim() : "";
    const identity = typeof body.identity === "string" ? body.identity.trim() : "";
    const role = body.role === "host" ? "host" : "viewer";
    const ts = typeof body.ts === "string" ? body.ts : body.ts?.toString?.();
    const sig = typeof body.sig === "string" ? body.sig : body.sig?.toString?.();

    if (!authority) {
      return Response.json({ error: "authority required" }, { status: 400 });
    }
    if (!identity) {
      return Response.json({ error: "identity required" }, { status: 400 });
    }

    if (role === "host") {
      if (!ts || !sig) {
        return Response.json({ error: "host signature required" }, { status: 400 });
      }
      const age = Math.abs(Date.now() - Number(ts));
      if (!Number.isFinite(age) || age > 60_000) {
        return Response.json({ error: "expired signature" }, { status: 400 });
      }
      const msg = `livekit-host-token:${authority}:${ts}`;
      if (!verifySignature(authority, msg, sig)) {
        console.warn("[livekit] invalid host signature", { authority });
        return Response.json({ error: "invalid signature" }, { status: 401 });
      }
    }

    let record: AuthorityStreamRecord | undefined;
    let recordFromDb = false;
    try {
      record = await ensureAuthorityStream(authority);
      recordFromDb = true;
    } catch (err) {
      console.error("[livekit] ensureAuthorityStream failed", { authority, err });
      record = {
        roomName: defaultRoomName(authority),
        manuallyStopped: false,
      };
    }

    if (role === "host" && recordFromDb && record?.manuallyStopped) {
      try {
        await clearManualStop(authority);
        record = await ensureAuthorityStream(authority);
      } catch (err) {
        console.error("[livekit] clearManualStop failed", { authority, err });
      }
    }

    const token = await mintAccessToken({
      roomName: record.roomName,
      identity,
      role,
      ttlSeconds: 60,
    });

    return Response.json({
      token,
      roomName: record.roomName,
      url: websocketUrl(),
    });
  } catch (err) {
    console.error("[livekit] token route failed", err);
    const message = err instanceof Error ? err.message : "internal error";
    return Response.json({ error: message }, { status: 500 });
  }
}
