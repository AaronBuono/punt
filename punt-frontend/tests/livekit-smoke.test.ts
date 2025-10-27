import test from "node:test";
import assert from "node:assert/strict";

function decodeClaims(token: string) {
  const [, payload] = token.split(".");
  assert.ok(payload, "token missing payload segment");
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(normalized, "base64").toString("utf8");
  return JSON.parse(json) as {
    exp: number;
    iat: number;
    sub?: string;
    video?: {
      room?: string;
      can_publish?: boolean;
      canPublish?: boolean;
      can_subscribe?: boolean;
      canSubscribe?: boolean;
      can_publish_data?: boolean;
      canPublishData?: boolean;
      room_join?: boolean;
      roomJoin?: boolean;
      room_create?: boolean;
      roomCreate?: boolean;
    };
  };
}

test("mintAccessToken applies host/viewer grants", async t => {
  const original = {
    url: process.env.LIVEKIT_URL,
    key: process.env.LIVEKIT_API_KEY,
    secret: process.env.LIVEKIT_API_SECRET,
  };

  process.env.LIVEKIT_URL = process.env.LIVEKIT_URL || "wss://example.livekit.test";
  process.env.LIVEKIT_API_KEY = "test-key";
  process.env.LIVEKIT_API_SECRET = "test-secret";

  const modulePath = "../lib/server/livekit";
  // Bust the ESM module cache by appending a query param so env snapshots refresh when re-running tests.
  const livekit = await import(`${modulePath}?smoke=${Date.now()}`);
  const mintAccessToken = livekit.mintAccessToken as (opts: { roomName: string; identity: string; role: "host" | "viewer"; ttlSeconds?: number }) => Promise<string>;

  const hostToken = await mintAccessToken({ roomName: "punt-host", identity: "host-identity", role: "host", ttlSeconds: 45 });
  const hostClaims = decodeClaims(hostToken);
  assert.equal(hostClaims.video?.room, "punt-host", "host token room should match request");
  assert.equal(hostClaims.video?.canPublish ?? hostClaims.video?.can_publish, true, "host token should allow publishing");
  assert.equal(hostClaims.video?.canPublishData ?? hostClaims.video?.can_publish_data, true, "host token should allow data publishing");
  assert.equal(hostClaims.video?.canSubscribe ?? hostClaims.video?.can_subscribe, true, "host token should allow subscribe");
  assert.equal(hostClaims.video?.roomJoin ?? hostClaims.video?.room_join, true, "host token should allow joining");
  assert.equal(hostClaims.video?.roomCreate ?? hostClaims.video?.room_create, true, "host token should allow creating rooms");

  const viewerToken = await mintAccessToken({ roomName: "punt-host", identity: "viewer-identity", role: "viewer", ttlSeconds: 30 });
  const viewerClaims = decodeClaims(viewerToken);
  assert.equal(viewerClaims.video?.room, "punt-host", "viewer token room should match");
  assert.equal(viewerClaims.video?.canPublish ?? viewerClaims.video?.can_publish, false, "viewer token must not publish");
  assert.equal(viewerClaims.video?.canPublishData ?? viewerClaims.video?.can_publish_data, false, "viewer token must not publish data");
  assert.equal(viewerClaims.video?.canSubscribe ?? viewerClaims.video?.can_subscribe, true, "viewer token should subscribe");
  assert.equal(viewerClaims.video?.roomJoin ?? viewerClaims.video?.room_join, true, "viewer token should allow joining");

  const hostExp = Number(hostClaims.exp);
  const viewerExp = Number(viewerClaims.exp);
  assert.ok(Number.isFinite(hostExp), "host token should provide numeric exp");
  assert.ok(Number.isFinite(viewerExp), "viewer token should provide numeric exp");
  const nowSeconds = Math.floor(Date.now() / 1000);
  const hostTtl = hostExp - nowSeconds;
  const viewerTtl = viewerExp - nowSeconds;
  assert.ok(hostTtl <= 50 && hostTtl >= 40, `host ttl expected ~45s, received ${hostTtl}`);
  assert.ok(viewerTtl <= 35 && viewerTtl >= 25, `viewer ttl expected ~30s, received ${viewerTtl}`);

  t.after(() => {
    if (original.url === undefined) {
      delete process.env.LIVEKIT_URL;
    } else {
      process.env.LIVEKIT_URL = original.url;
    }
    if (original.key === undefined) {
      delete process.env.LIVEKIT_API_KEY;
    } else {
      process.env.LIVEKIT_API_KEY = original.key;
    }
    if (original.secret === undefined) {
      delete process.env.LIVEKIT_API_SECRET;
    } else {
      process.env.LIVEKIT_API_SECRET = original.secret;
    }
  });
});
