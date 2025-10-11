import { NextRequest } from "next/server";
import {
  getAuthorityStream,
  setAuthorityStream,
  toPlaybackUrl,
  stopAuthorityStream,
  clearManualStop,
} from "@/lib/server/streamStore";
import { verifySignature } from "@/lib/server/signature";

/**
 * Livepeer integration (basic, ephemeral)
 * IMPORTANT: This uses an in-memory map that will reset on server restart / re-deploy.
 * For production: persist to a database (e.g., Postgres) keyed by authority public key.
 *
 * Env vars required:
 *   LIVEPEER_API_KEY = <your_livepeer_studio_key>
 */

// Opt out of caching for this route
export const dynamic = "force-dynamic";
export const revalidate = 0;

const LIVEPEER_API = "https://livepeer.studio/api";
const API_KEY = process.env.LIVEPEER_API_KEY;

function missingKeyResponse() {
  return new Response(JSON.stringify({ error: "LIVEPEER_API_KEY not configured" }), { status: 500 });
}

async function fetchLivepeerStream(id: string) {
  if (!API_KEY) return null;
  const res = await fetch(`${LIVEPEER_API}/stream/${id}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchViewerCount(id: string): Promise<number | undefined> {
  if (!API_KEY) return undefined;
  // Try sessions endpoint first
  try {
    const sessRes = await fetch(`${LIVEPEER_API}/stream/${id}/sessions`, { headers: { Authorization: `Bearer ${API_KEY}` }, cache: 'no-store' });
    if (sessRes.ok) {
      const sessions = await sessRes.json();
      if (Array.isArray(sessions)) {
        // Count sessions that are currently active.
      type Session = { record?: { status?: string }; sourceSegmentsDuration?: unknown; status?: string };
      const active = (sessions as Session[]).filter((s) => s?.record?.status === 'recording' || s?.sourceSegmentsDuration || s?.status === 'active');
        return active.length || sessions.length;
      }
    }
  } catch { /* ignore */ }
  // Fallback: some stream objects include a recentSessions array or metrics
  try {
    const live = await fetchLivepeerStream(id);
    if (live?.recentSessions && Array.isArray(live.recentSessions)) return live.recentSessions.length;
    if (typeof live?.viewerCount === 'number') return live.viewerCount;
  } catch { /* ignore */ }
  return undefined;
}

// (playback URL helper moved to shared store)

// GET /api/stream?authority=<pubkey>
export async function GET(req: NextRequest) {
  const authority = req.nextUrl.searchParams.get("authority")?.trim();
  if (!authority) return new Response(JSON.stringify({ error: "authority required" }), { status: 400 });
  const rec = await getAuthorityStream(authority);
  if (!rec) return Response.json({ stream: null });

  // Refresh isActive if stale (>5s)
  const now = Date.now();
  if (!rec.manuallyStopped && rec.id && (!rec.lastFetched || now - rec.lastFetched > 5000)) {
    const live = await fetchLivepeerStream(rec.id).catch(() => null);
    if (live) {
      rec.isActive = !!live.isActive;
      rec.lastFetched = now;
    }
  }
  if (!rec.manuallyStopped && rec.id && (!rec.lastMetricsFetched || now - rec.lastMetricsFetched > 8000)) {
    const viewers = await fetchViewerCount(rec.id).catch(()=>undefined);
    if (viewers !== undefined) {
      rec.viewerCount = viewers;
      rec.lastMetricsFetched = now;
    }
  }
  await setAuthorityStream(authority, rec);

  return Response.json({
    stream: {
      id: rec.id,
      playbackUrl: toPlaybackUrl(rec.playbackId),
      streamKey: rec.streamKey,
      active: !!rec.isActive,
      viewerCount: rec.viewerCount ?? 0,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

// POST /api/stream  { authority: <pubkey> }
// Creates a Livepeer stream if one doesn't already exist for the authority.
export async function POST(req: NextRequest) {
  if (!API_KEY) return missingKeyResponse();
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

  let rec = await getAuthorityStream(authority);
  if (!rec) {
    // Create stream on Livepeer
    const createRes = await fetch(`${LIVEPEER_API}/stream`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `punt-${authority.slice(0, 8)}`,
        profiles: [
          { name: "720p", bitrate: 2000000, fps: 30, width: 1280, height: 720 },
          { name: "480p", bitrate: 1000000, fps: 30, width: 854, height: 480 },
          { name: "360p", bitrate: 600000, fps: 30, width: 640, height: 360 },
        ],
        record: false,
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      return new Response(JSON.stringify({ error: "livepeer create failed", details: err }), { status: 500 });
    }
    const created = await createRes.json();
    rec = {
      id: created.id,
      playbackId: created.playbackId,
      streamKey: created.streamKey || created.streamKey?.value || "",
      isActive: false,
      lastFetched: Date.now(),
    };
  await setAuthorityStream(authority, rec);
  }
  // clear manual stop for this authority so it can go live again
  await clearManualStop(authority);

  return Response.json({
    stream: {
      id: rec.id,
      playbackUrl: toPlaybackUrl(rec.playbackId),
      streamKey: rec.streamKey,
      active: !!rec.isActive,
      viewerCount: rec.viewerCount ?? 0,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

// PATCH /api/stream { authority: <pubkey>, refresh?: true }
// Forces a refresh of the remote stream status (isActive).
export async function PATCH(req: NextRequest) {
  if (!API_KEY) return missingKeyResponse();
  const body = await req.json().catch(() => ({}));
  const authority: string | undefined = body.authority?.trim();
  if (!authority) return new Response(JSON.stringify({ error: "authority required" }), { status: 400 });
  const ts: string | undefined = body.ts?.toString() || req.nextUrl.searchParams.get("ts") || undefined;
  const sig: string | undefined = body.sig?.toString() || req.nextUrl.searchParams.get("sig") || undefined;
  if (!ts || !sig) {
    console.warn("[stream] PATCH missing signature", { authority });
    return new Response(JSON.stringify({ error: "ts and sig required" }), { status: 400 });
  }
  const age = Math.abs(Date.now() - Number(ts));
  if (!Number.isFinite(age) || age > 5 * 60_000) {
    console.warn("[stream] PATCH expired signature", { authority });
    return new Response(JSON.stringify({ error: "expired signature" }), { status: 400 });
  }
  const msg = `refresh-stream:${authority}:${ts}`;
  if (!verifySignature(authority, msg, sig)) {
    console.warn("[stream] PATCH invalid signature", { authority });
    return new Response(JSON.stringify({ error: "invalid signature" }), { status: 401 });
  }

  const rec = await getAuthorityStream(authority);
  if (!rec) return new Response(JSON.stringify({ error: "no stream" }), { status: 404 });
  const live = await fetchLivepeerStream(rec.id).catch(() => null);
  if (live) {
    rec.isActive = !!live.isActive;
    rec.lastFetched = Date.now();
    await setAuthorityStream(authority, rec);
  }
  return Response.json({
    stream: {
      id: rec.id,
      playbackUrl: toPlaybackUrl(rec.playbackId),
      streamKey: rec.streamKey,
      active: !!rec.isActive,
      viewerCount: rec.viewerCount ?? 0,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

// DELETE /api/stream { authority: <pubkey> }
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
  return Response.json({ ok }, { headers: { "Cache-Control": "no-store" } });
}

// NOTE: For discovery the dedicated /api/streams route is recommended. Keeping single-authority route lean.

