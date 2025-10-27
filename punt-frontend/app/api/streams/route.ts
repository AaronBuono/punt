import { NextRequest } from "next/server";
import {
  refreshStreams,
  listAuthorityStreams,
} from "@/lib/server/streamStore";
import type { AuthorityStreamRecord } from "@/lib/server/streamStore";
import { fetchRoomStatus } from "@/lib/server/livekit";
import { verifySignature } from "@/lib/server/signature";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  await refreshStreams({ roomStatusFetcher: fetchRoomStatus }).catch(() => {});
  const all = (await listAuthorityStreams())
    .map((s: { authority: string } & AuthorityStreamRecord) => ({
      authority: s.authority,
      roomName: s.roomName,
      active: !!s.isActive && !s.manuallyStopped,
      viewerCount: s.viewerCount ?? 0,
      lastFetched: s.lastFetched || 0,
      title: s.title ?? null,
      manuallyStopped: !!s.manuallyStopped,
    }));
  const filtered = activeOnly ? all.filter((s: { active: boolean }) => s.active) : all;
  return Response.json({ streams: filtered }, { headers: { "Cache-Control": "no-store" } });
}
