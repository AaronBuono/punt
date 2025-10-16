import type { Stream } from "@prisma/client";
import prisma from "./db";

export interface AuthorityStreamRecord {
  id: string;
  playbackId: string;
  streamKey: string;
  title?: string | null;
  isActive?: boolean;
  viewerCount?: number;
  lastFetched?: number;
  lastMetricsFetched?: number;
  manuallyStopped?: boolean;
  startedAt?: number;
  endedAt?: number;
}

function toMillis(value: Date | null | undefined) {
  return value ? value.getTime() : undefined;
}

function toDate(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value) : undefined;
}

function mapRow(row: Stream) {
  const rec: AuthorityStreamRecord = {
    id: row.livepeerId,
    playbackId: row.playbackId,
    streamKey: row.streamKey,
    title: row.title ?? undefined,
    isActive: row.isActive,
    viewerCount: row.viewerCount,
    manuallyStopped: row.manuallyStopped,
  };
  const lastFetched = toMillis(row.lastFetched);
  if (lastFetched !== undefined) rec.lastFetched = lastFetched;
  const lastMetricsFetched = toMillis(row.lastMetricsFetched);
  if (lastMetricsFetched !== undefined) rec.lastMetricsFetched = lastMetricsFetched;
  const startedAt = toMillis(row.startedAt);
  if (startedAt !== undefined) rec.startedAt = startedAt;
  const endedAt = toMillis(row.endedAt);
  if (endedAt !== undefined) rec.endedAt = endedAt;
  return rec;
}

export async function getAuthorityStream(authority: string) {
  const row = await prisma.stream.findUnique({ where: { authority } });
  if (!row) return undefined;
  return mapRow(row);
}

export async function setAuthorityStream(authority: string, rec: AuthorityStreamRecord) {
  await prisma.stream.upsert({
    where: { authority },
    create: {
      authority,
      livepeerId: rec.id,
      playbackId: rec.playbackId,
      streamKey: rec.streamKey,
      title: rec.title ?? null,
      isActive: rec.isActive ?? false,
      viewerCount: rec.viewerCount ?? 0,
      manuallyStopped: rec.manuallyStopped ?? false,
      startedAt: toDate(rec.startedAt) ?? undefined,
      endedAt: toDate(rec.endedAt) ?? undefined,
      lastFetched: toDate(rec.lastFetched) ?? undefined,
      lastMetricsFetched: toDate(rec.lastMetricsFetched) ?? undefined,
    },
    update: {
      livepeerId: rec.id,
      playbackId: rec.playbackId,
      streamKey: rec.streamKey,
      ...(rec.title !== undefined ? { title: rec.title } : {}),
      isActive: rec.isActive ?? false,
      viewerCount: rec.viewerCount ?? 0,
      manuallyStopped: rec.manuallyStopped ?? false,
      startedAt: toDate(rec.startedAt) ?? undefined,
      endedAt: toDate(rec.endedAt) ?? undefined,
      lastFetched: toDate(rec.lastFetched) ?? undefined,
      lastMetricsFetched: toDate(rec.lastMetricsFetched) ?? undefined,
    },
  });
}

export async function listAuthorityStreams() {
  const rows = await prisma.stream.findMany();
  return rows.map((row: Stream) => ({ authority: row.authority, ...mapRow(row) }));
}

export async function refreshStreams(opts: {
  livepeerFetcher: (id: string) => Promise<{ isActive?: boolean } | null>;
  viewerCountFetcher: (id: string) => Promise<number | undefined>;
  maxAgeStatusMs?: number;
  maxAgeMetricsMs?: number;
}) {
  const { livepeerFetcher, viewerCountFetcher, maxAgeStatusMs = 5000, maxAgeMetricsMs = 8000 } = opts;
  const rows = await prisma.stream.findMany();
  const now = Date.now();

  await Promise.all(
    rows.map(async (row: Stream) => {
      let changed = false;
      const rec = mapRow(row);
      if (rec.id && (!rec.lastFetched || now - rec.lastFetched > maxAgeStatusMs)) {
        try {
          const live = await livepeerFetcher(rec.id);
          if (live) {
            const currentlyActive = Boolean(live.isActive);
            if (rec.isActive !== currentlyActive) {
              rec.isActive = currentlyActive;
              changed = true;
            }
            rec.lastFetched = now;
            if (currentlyActive) {
              if (rec.manuallyStopped) {
                rec.manuallyStopped = false;
                changed = true;
              }
              if (!rec.startedAt) {
                rec.startedAt = now;
                changed = true;
              }
              rec.endedAt = undefined;
            } else if (!rec.manuallyStopped) {
              if (rec.viewerCount) {
                rec.viewerCount = 0;
                changed = true;
              }
              if (!rec.endedAt) {
                rec.endedAt = now;
                changed = true;
              }
            }
          }
        } catch {
          // ignore fetch errors
        }
      }
      if (
        !rec.manuallyStopped &&
        rec.id &&
        (!rec.lastMetricsFetched || now - rec.lastMetricsFetched > maxAgeMetricsMs)
      ) {
        try {
          const vc = await viewerCountFetcher(rec.id);
          if (vc !== undefined) {
            rec.viewerCount = vc;
            rec.lastMetricsFetched = now;
            changed = true;
          }
        } catch {
          // ignore fetch errors
        }
      }
      if (changed) {
        await setAuthorityStream(row.authority, rec);
      }
    })
  );

  return listAuthorityStreams();
}

export function toPlaybackUrl(playbackId: string) {
  return `https://livepeercdn.com/hls/${playbackId}/index.m3u8`;
}

export async function stopAuthorityStream(authority: string) {
  const row = await prisma.stream.findUnique({ where: { authority } });
  if (!row) return false;
  await prisma.stream.update({
    where: { authority },
    data: {
      isActive: false,
      viewerCount: 0,
      manuallyStopped: true,
      endedAt: new Date(),
      lastFetched: new Date(),
    },
  });
  return true;
}

export async function clearManualStop(authority: string) {
  const row = await prisma.stream.findUnique({ where: { authority } });
  if (!row) return false;
  if (!row.manuallyStopped) return true;
  await prisma.stream.update({
    where: { authority },
    data: {
      manuallyStopped: false,
      startedAt: new Date(),
      endedAt: null,
      lastFetched: row.lastFetched ?? new Date(),
    },
  });
  return true;
}
