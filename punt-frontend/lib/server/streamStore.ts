import type { Prisma, Stream } from "@prisma/client";
import prisma from "./db";

export interface AuthorityStreamRecord {
  roomName: string;
  title?: string | null;
  isActive?: boolean;
  viewerCount?: number;
  lastFetched?: number;
  lastMetricsFetched?: number;
  manuallyStopped?: boolean;
  startedAt?: number;
  endedAt?: number;
  currentMarketPubkey?: string | null;
  currentMarketCycle?: number | null;
  currentMarketUpdatedAt?: number | null;
}

type StreamCreateInputWithMarket = Prisma.StreamCreateInput & {
  currentMarketPubkey?: string | null;
  currentMarketCycle?: number | null;
  currentMarketUpdatedAt?: Date | null;
};

type StreamUpdateInputWithMarket = Prisma.StreamUpdateInput & {
  currentMarketPubkey?: string | null;
  currentMarketCycle?: number | null;
  currentMarketUpdatedAt?: Date | null;
};

function toMillis(value: Date | null | undefined) {
  return value ? value.getTime() : undefined;
}

function toNullableDate(value: number | null | undefined) {
  return typeof value === "number" ? new Date(value) : null;
}

export function defaultRoomName(authority: string) {
  const sanitized = authority.replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase();
  return `punt-${sanitized || "anon"}`;
}

function mapRow(row: Stream) {
  const raw = row as unknown as {
    roomName?: string;
    currentMarketPubkey?: string | null;
    currentMarketCycle?: number | null;
    currentMarketUpdatedAt?: Date | null;
  };
  const rec: AuthorityStreamRecord = {
    roomName: raw.roomName ?? defaultRoomName(row.authority),
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
  if (raw.currentMarketPubkey !== undefined) {
    rec.currentMarketPubkey = raw.currentMarketPubkey ?? null;
  }
  if (raw.currentMarketCycle !== undefined) {
    rec.currentMarketCycle = raw.currentMarketCycle ?? null;
  }
  const currentMarketUpdatedAt = toMillis(raw.currentMarketUpdatedAt);
  if (currentMarketUpdatedAt !== undefined) rec.currentMarketUpdatedAt = currentMarketUpdatedAt;
  return rec;
}

export async function getAuthorityStream(authority: string) {
  const row = await prisma.stream.findUnique({ where: { authority } });
  if (!row) return undefined;
  return mapRow(row);
}

export async function setAuthorityStream(authority: string, rec: AuthorityStreamRecord) {
  const createData: StreamCreateInputWithMarket = {
    authority,
    roomName: rec.roomName,
    title: rec.title ?? null,
    isActive: rec.isActive ?? false,
    viewerCount: rec.viewerCount ?? 0,
    manuallyStopped: rec.manuallyStopped ?? false,
    startedAt: toNullableDate(rec.startedAt),
    endedAt: toNullableDate(rec.endedAt),
    lastFetched: toNullableDate(rec.lastFetched),
    lastMetricsFetched: toNullableDate(rec.lastMetricsFetched),
    currentMarketPubkey: rec.currentMarketPubkey ?? null,
    currentMarketCycle: rec.currentMarketCycle ?? null,
    currentMarketUpdatedAt: toNullableDate(rec.currentMarketUpdatedAt),
  };
  const updateData: StreamUpdateInputWithMarket = {
    roomName: rec.roomName,
    isActive: rec.isActive ?? false,
    viewerCount: rec.viewerCount ?? 0,
    manuallyStopped: rec.manuallyStopped ?? false,
  };
  if (rec.title !== undefined) updateData.title = rec.title;
  if (rec.startedAt !== undefined) updateData.startedAt = toNullableDate(rec.startedAt);
  if (rec.endedAt !== undefined) updateData.endedAt = toNullableDate(rec.endedAt);
  if (rec.lastFetched !== undefined) updateData.lastFetched = toNullableDate(rec.lastFetched);
  if (rec.lastMetricsFetched !== undefined) updateData.lastMetricsFetched = toNullableDate(rec.lastMetricsFetched);
  if (rec.currentMarketPubkey !== undefined) updateData.currentMarketPubkey = rec.currentMarketPubkey ?? null;
  if (rec.currentMarketCycle !== undefined) updateData.currentMarketCycle = rec.currentMarketCycle ?? null;
  if (rec.currentMarketUpdatedAt !== undefined) updateData.currentMarketUpdatedAt = toNullableDate(rec.currentMarketUpdatedAt);
  await prisma.stream.upsert({
    where: { authority },
    create: createData,
    update: updateData,
  });
}

export async function listAuthorityStreams() {
  const rows = await prisma.stream.findMany();
  return rows.map((row: Stream) => ({ authority: row.authority, ...mapRow(row) }));
}

export async function ensureAuthorityStream(authority: string) {
  const existing = await getAuthorityStream(authority);
  if (existing) return existing;
  const roomName = defaultRoomName(authority);
  const fresh: AuthorityStreamRecord = {
    roomName,
    title: null,
    isActive: false,
    viewerCount: 0,
    manuallyStopped: false,
  };
  await setAuthorityStream(authority, fresh);
  return fresh;
}

export async function refreshStreams(opts: {
  roomStatusFetcher: (roomName: string) => Promise<{ isActive: boolean; participantCount: number } | null>;
  maxAgeMs?: number;
}) {
  const { roomStatusFetcher, maxAgeMs = 5000 } = opts;
  const rows = await prisma.stream.findMany();
  const now = Date.now();

  await Promise.all(
    rows.map(async (row: Stream) => {
      let changed = false;
      const rec = mapRow(row);
      if (!rec.roomName) {
        rec.roomName = defaultRoomName(row.authority);
        changed = true;
      }
      if (!rec.lastFetched || now - rec.lastFetched > maxAgeMs) {
        try {
          const status = await roomStatusFetcher(rec.roomName);
          if (status) {
            const currentlyActive = status.isActive;
            if (rec.isActive !== currentlyActive) {
              rec.isActive = currentlyActive;
              changed = true;
            }
            const participants = status.participantCount;
            if (typeof participants === "number" && rec.viewerCount !== participants) {
              rec.viewerCount = participants;
              changed = true;
            }
            rec.lastFetched = now;
            rec.lastMetricsFetched = now;
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
      if (changed) {
        await setAuthorityStream(row.authority, rec);
      }
    })
  );

  return listAuthorityStreams();
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
