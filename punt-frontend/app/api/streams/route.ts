import { NextRequest } from "next/server";
import {
  refreshStreams,
  listAuthorityStreams,
  toPlaybackUrl,
} from "@/lib/server/streamStore";
import type { AuthorityStreamRecord } from "@/lib/server/streamStore";
import { verifySignature } from "@/lib/server/signature";

const LIVEPEER_API = "https://livepeer.studio/api";
const API_KEY = process.env.LIVEPEER_API_KEY;

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  try {
    const sessRes = await fetch(`${LIVEPEER_API}/stream/${id}/sessions`, { headers: { Authorization: `Bearer ${API_KEY}` }, cache: 'no-store' });
    if (sessRes.ok) {
      const sessions = await sessRes.json();
      if (Array.isArray(sessions)) {
        type Session = { record?: { status?: string }; sourceSegmentsDuration?: unknown; status?: string };
        const active = (sessions as Session[]).filter((s) => s?.record?.status === 'recording' || s?.sourceSegmentsDuration || s?.status === 'active');
        return active.length || sessions.length;
      }
    }
  } catch {/* ignore */}
  try {
    const live = await fetchLivepeerStream(id);
    if (live?.recentSessions && Array.isArray(live.recentSessions)) return live.recentSessions.length;
    if (typeof live?.viewerCount === 'number') return live.viewerCount;
  } catch {/* ignore */}
  return undefined;
}

// GET /api/streams  (optional query: ?active=1 to filter only currently active streams)
export async function GET(req: NextRequest) {
  const activeOnly = req.nextUrl.searchParams.get('active') === '1';
  if (!activeOnly) {
    const authority = req.nextUrl.searchParams.get('authority')?.trim();
    const ts = req.nextUrl.searchParams.get('ts')?.toString();
    const sig = req.nextUrl.searchParams.get('sig')?.toString();
    if (!authority || !ts || !sig) {
      console.warn('[streams] listing requires signature');
      return new Response(JSON.stringify({ error: 'signature required' }), { status: 401 });
    }
    const age = Math.abs(Date.now() - Number(ts));
    if (!Number.isFinite(age) || age > 5 * 60_000) {
      console.warn('[streams] listing expired signature', { authority });
      return new Response(JSON.stringify({ error: 'expired signature' }), { status: 400 });
    }
    const msg = `list-streams:${authority}:${ts}`;
    if (!verifySignature(authority, msg, sig)) {
      console.warn('[streams] listing invalid signature', { authority });
      return new Response(JSON.stringify({ error: 'invalid signature' }), { status: 401 });
    }
  }
  // Refresh statuses opportunistically (best-effort)
  if (API_KEY) {
    await refreshStreams({ livepeerFetcher: fetchLivepeerStream, viewerCountFetcher: fetchViewerCount }).catch(()=>{});
  }
  const all = (await listAuthorityStreams())
    .map((s: { authority: string } & AuthorityStreamRecord) => ({
      authority: s.authority,
      id: s.id,
      active: !!s.isActive,
      viewerCount: s.viewerCount ?? 0,
      playbackUrl: toPlaybackUrl(s.playbackId),
      lastFetched: s.lastFetched || 0,
    }));
  const filtered = activeOnly ? all.filter((s: { active: boolean }) => s.active) : all;
  return Response.json({ streams: filtered }, { headers: { "Cache-Control": "no-store" } });
}
