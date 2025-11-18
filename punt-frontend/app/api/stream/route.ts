import { NextRequest } from "next/server";
import {
  getAuthorityStream,
  setAuthorityStream,
  stopAuthorityStream,
  clearManualStop,
  ensureAuthorityStream,
} from "@/lib/server/streamStore";
import { fetchRoomStatus } from "@/lib/server/livekit";
import { verifySignature } from "@/lib/server/signature";
import { verifyAuthorityTransaction } from "@/lib/server/solana";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function responsePayload(authority: string, rec: Awaited<ReturnType<typeof getAuthorityStream>> | undefined) {
  if (!rec) {
    return { stream: null };
  }
  return {
    stream: {
      authority,
      roomName: rec.roomName,
      active: !!rec.isActive && !rec.manuallyStopped,
      viewerCount: rec.viewerCount ?? 0,
      title: rec.title ?? null,
      manuallyStopped: !!rec.manuallyStopped,
      currentMarket: rec.currentMarketPubkey ?? null,
      currentMarketCycle: typeof rec.currentMarketCycle === "number" ? rec.currentMarketCycle : null,
      currentMarketUpdatedAt: rec.currentMarketUpdatedAt ?? null,
    },
  };
}

export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get("authority")?.trim();
  if (!authority) return new Response(JSON.stringify({ error: "authority required" }), { status: 400 });

  let rec = await ensureAuthorityStream(authority);
  const status = await fetchRoomStatus(rec.roomName);
  if (status) {
    rec = {
      ...rec,
      isActive: status.isActive,
      viewerCount: status.participantCount,
      lastFetched: Date.now(),
      lastMetricsFetched: Date.now(),
    };
    await setAuthorityStream(authority, rec);
  }

  return Response.json(responsePayload(authority, rec), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const authority: string | undefined = body.authority?.trim();
  const ts: string | undefined = body.ts?.toString();
  const sig: string | undefined = body.sig?.toString();
  if (!authority) return new Response(JSON.stringify({ error: "authority required" }), { status: 400 });
  if (!ts || !sig) return new Response(JSON.stringify({ error: "ts and sig required" }), { status: 400 });
  const age = Math.abs(Date.now() - Number(ts));
  if (!Number.isFinite(age) || age > 5 * 60_000) {
    return new Response(JSON.stringify({ error: "expired signature" }), { status: 400 });
  }
  const msg = `provision-stream:${authority}:${ts}`;
  if (!verifySignature(authority, msg, sig)) {
    console.warn("[stream] POST invalid signature", { authority });
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
  }
  await clearManualStop(authority);
  const rec = await ensureAuthorityStream(authority);
  return Response.json(responsePayload(authority, rec), { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const authority: string | undefined = body.authority?.trim();
  if (!authority) return new Response(JSON.stringify({ error: "authority required" }), { status: 400 });
  const ts: string | undefined = body.ts?.toString() || req.nextUrl.searchParams.get("ts") || undefined;
  const sig: string | undefined = body.sig?.toString() || req.nextUrl.searchParams.get("sig") || undefined;
  const txSig: string | undefined = typeof body.txSig === "string" ? body.txSig.trim() : undefined;
  if (!txSig) {
    if (!ts || !sig) {
      console.warn("[stream] PATCH missing signature", { authority });
      return new Response(JSON.stringify({ error: "ts and sig required" }), { status: 400 });
    }
    const age = Math.abs(Date.now() - Number(ts));
    if (!Number.isFinite(age) || age > 5 * 60_000) {
      console.warn("[stream] PATCH expired signature", { authority });
      return new Response(JSON.stringify({ error: "expired signature" }), { status: 400 });
    }
  }
  const actionRaw = typeof body.action === "string" ? body.action.toLowerCase() : undefined;
  const action = actionRaw === "update-title"
    ? "update-title"
    : actionRaw === "mark-offline"
      ? "mark-offline"
      : actionRaw === "update-market"
        ? "update-market"
        : actionRaw === "clear-market"
          ? "clear-market"
          : "refresh";

  const marketPubkeyRaw = typeof body.marketPubkey === "string" ? body.marketPubkey.trim() : undefined;
  const cycleRaw = body.cycle;
  const parsedCycle = typeof cycleRaw === "string" ? Number.parseInt(cycleRaw, 10) : typeof cycleRaw === "number" ? cycleRaw : undefined;
  const normalizedCycle = Number.isFinite(parsedCycle ?? NaN) ? Number(parsedCycle) : null;
  const cyclePart = normalizedCycle === null ? "na" : normalizedCycle.toString();

  if (action === "update-market" && !marketPubkeyRaw) {
    return new Response(JSON.stringify({ error: "marketPubkey required" }), { status: 400 });
  }

  // No authentication needed for refresh action (read-only)
  if (action === "refresh") {
    const rec = await ensureAuthorityStream(authority);
    return new Response(JSON.stringify({ stream: rec }), { status: 200 });
  }

  let authenticated = false;
  if (txSig && (action === "update-market" || action === "clear-market")) {
    const expectedLog = action === "update-market" ? "Instruction: InitializeMarket" : "Instruction: CloseMarket";
    // InitializeMarket can take longer to confirm, so give it more time
    const maxWaitMs = action === "update-market" ? 10000 : 5000;
    console.log("[stream] PATCH verifying txSig", { txSig, authority, action, expectedLog, maxWaitMs });
    authenticated = await verifyAuthorityTransaction(txSig, authority, { expectedLog, maxWaitMs });
    console.log("[stream] PATCH txSig verification result", { authenticated, txSig: txSig.slice(0, 8) });
    if (!authenticated) {
      console.warn("[stream] PATCH txSig verification failed", { authority, action, txSig: txSig.slice(0, 8) });
    }
  }

  if (!authenticated) {
    if (!ts || !sig) {
      console.warn("[stream] PATCH missing signature", { authority, action });
      return new Response(JSON.stringify({ error: "ts and sig required" }), { status: 400 });
    }
    const expectedMsg = action === "update-title"
      ? `update-stream:${authority}:${ts}`
      : action === "mark-offline"
        ? `stop-stream:${authority}:${ts}`
        : action === "update-market"
          ? `update-market:${authority}:${marketPubkeyRaw ?? ""}:${cyclePart}:${ts}`
          : action === "clear-market"
            ? `clear-market:${authority}:${ts}`
            : `refresh-stream:${authority}:${ts}`;
    if (!verifySignature(authority, expectedMsg, sig)) {
      console.warn("[stream] PATCH invalid signature", { authority, action });
      return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
    }
  }

  let rec = await ensureAuthorityStream(authority);
  if (action === "update-title") {
    const provided = typeof body.title === "string" ? body.title : "";
    const normalized = provided.replace(/\s+/g, " ").trim();
    const truncated = normalized.slice(0, 80);
    rec = {
      ...rec,
      title: truncated.length ? truncated : null,
    };
    await setAuthorityStream(authority, rec);
  } else if (action === "mark-offline") {
    await stopAuthorityStream(authority);
    rec = await ensureAuthorityStream(authority);
  } else if (action === "update-market") {
    rec = {
      ...rec,
      currentMarketPubkey: marketPubkeyRaw,
      currentMarketCycle: normalizedCycle,
      currentMarketUpdatedAt: Date.now(),
    };
    await setAuthorityStream(authority, rec);
  } else if (action === "clear-market") {
    rec = {
      ...rec,
      currentMarketPubkey: null,
      currentMarketCycle: null,
      currentMarketUpdatedAt: null,
    };
    await setAuthorityStream(authority, rec);
  } else {
    const status = await fetchRoomStatus(rec.roomName);
    if (status) {
      rec = {
        ...rec,
        isActive: status.isActive,
        viewerCount: status.participantCount,
        lastFetched: Date.now(),
        lastMetricsFetched: Date.now(),
      };
      await setAuthorityStream(authority, rec);
    }
  }

  return Response.json(responsePayload(authority, rec), { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  let authority: string | undefined = (body.authority || "").trim();
  let ts: string | undefined = body.ts?.toString();
  let sig: string | undefined = body.sig?.toString();
  if (!authority) authority = req.nextUrl.searchParams.get("authority") || undefined;
  if (!ts) ts = req.nextUrl.searchParams.get("ts") || undefined;
  if (!sig) sig = req.nextUrl.searchParams.get("sig") || undefined;
  if (!authority) return new Response(JSON.stringify({ error: "authority required" }), { status: 400 });
  if (!ts || !sig) return new Response(JSON.stringify({ error: "ts and sig required" }), { status: 400 });
  const age = Math.abs(Date.now() - Number(ts));
  if (!Number.isFinite(age) || age > 5 * 60_000) {
    return new Response(JSON.stringify({ error: "expired signature" }), { status: 400 });
  }
  const msg = `stop-stream:${authority}:${ts}`;
  if (!verifySignature(authority, msg, sig)) {
    console.warn("[stream] DELETE invalid signature", { authority });
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
  }
  const ok = await stopAuthorityStream(authority);
  const rec = await ensureAuthorityStream(authority);
  return Response.json({ ...responsePayload(authority, rec), ok }, { headers: { "Cache-Control": "no-store" } });
}

