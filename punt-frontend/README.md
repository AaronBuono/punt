# Punt Frontend

This project is a Next.js UI for the `punt_program` Anchor on-chain prediction market (sequential cycle-based markets per authority) with custom naming and simplified betting UX. The product name is **Punt**.

## Quick Start

```bash
cp .env.example .env.local   # ensure env vars set
npm install
npm run dev
```
Visit `http://localhost:3000`.

Environment vars:
```
NEXT_PUBLIC_PROGRAM_ID=<deployed_program_id>
NEXT_PUBLIC_NETWORK=https://api.devnet.solana.com
LIVEKIT_URL=wss://<your-livekit-host>
LIVEKIT_API_KEY=<server_api_key>
LIVEKIT_API_SECRET=<server_api_secret>
```

To validate keys locally you can optionally set `LIVEKIT_SMOKE=1` before running `npm test`; the smoke test will attempt to mint tokens and reach your LiveKit instance when the env vars above are present.

## LiveKit Streaming

Punt now uses **LiveKit** for realtime host/viewer video instead of Livepeer HLS. Key changes:

- Host Studio connects directly to LiveKit and publishes camera/audio; viewers auto-subscribe in `/watch` via WebRTC.
- `/api/livekit/token` mints short-lived JWTs. Host requests must include a signed message (`livekit-host-token:<authority>:<ts>`), while viewers need only provide an identity.
- Stream metadata (`/api/stream` + `/api/streams`) now tracks a stable `roomName` per authority along with LiveKit-derived activity metrics.

### Provisioning LiveKit keys
1. Use [LiveKit Cloud](https://livekit.io/cloud) or self-hosted LiveKit server.
2. Create an API key/secret pair and note your WebSocket URL (e.g. `wss://<region>.livekit.cloud`).
3. Add the values to `.env.local` (see variables above). Secrets must never be exposed to the frontend.
4. For self-hosting, ensure the server is reachable over HTTPS/WSS and configure ingress/firewall rules accordingly.

### Smoke test (optional)
`LIVEKIT_SMOKE=1 npm test` runs `tests/livekit-smoke.test.ts`. With valid env vars it mints both host and viewer tokens and verifies they carry the expected grants. The test skips automatically if LiveKit credentials are absent.

## Core Market Lifecycle (Cycle-Based)
Each authority can create an infinite sequence of markets, one per cycle. A unique PDA is derived using `(authority, cycle)` so old tickets cannot appear in a new round.

1. Authority initializes a new market cycle (provides `title`, `label_yes`, `label_no`, optional `fee_bps`). If the authority has never created a market, an `AuthorityMeta` account is auto-initialized first.
2. Participants pick a side and place their first bet (client auto-creates the ticket if needed) for the current (latest) cycle.
3. Participants can add more to the same side while unresolved (same ticket, same side enforced).
4. Authority resolves to YES or NO (empty-side allowed).
5. Winners claim winnings (if any winners exist).
6. Authority withdraws accrued fees (authority + host split).
7. Authority closes market (returns rent) once fees withdrawn and all winnings claimed.
8. To start a new round, the authority calls initialize again which increments the cycle counter and creates a fresh market PDA; prior tickets remain isolated under previous cycle.

### Why Cycles?
Originally a single fixed PDA was reused per authority, causing stale tickets from a prior round to reappear when reinitializing. Cycles embed a monotonically increasing `u16` cycle number into the market PDA seed, guaranteeing:
- Fresh market state each round.
- Old tickets (seeded by old market PDA) never collide with new tickets.
- Simple access pattern: latest market = `AuthorityMeta.next_cycle - 1`.

### Key Accounts
| Account | Purpose |
| ------- | ------- |
| AuthorityMeta | Stores `next_cycle` (u16) and bump; one per authority. |
| BetMarket | Stores pools, labels, fees, resolution data for a specific `cycle`. |
| BetTicket | One per (user, BetMarket). Side + cumulative amount. |

### PDA Seeds
```
authority_meta = ["authority_meta", authority]
market         = ["market", authority, cycle_le_bytes]
ticket         = ["ticket", market, user]
```

### Frontend Resolution Logic
The frontend fetches `AuthorityMeta` to know `next_cycle`. Active market (if any) is at `next_cycle - 1` (unless `next_cycle == 0`, meaning none yet). All helpers (`bet`, `fetchMarket`, `fetchTicket`, etc.) were updated accordingly.

## Naming Fields (New)
The on-chain `BetMarket` now stores:
- `title: [u8;64]`
- `label_yes: [u8;32]`
- `label_no: [u8;32]`
Client decodes these byte arrays, trims trailing nulls, and renders human-readable labels. This enables streamer-friendly descriptions like: Title: "Will the boss drop a legendary?" YES label: "Legendary!" NO label: "No Luck".

## Simplified Betting (Client-Side Unified Bet)
Previously users had to:
1. `create_ticket` (choose side)
2. `place_bet` (send lamports)

Now the UI exposes a single action per side:
- First bet: constructs a transaction with `create_ticket` (if absent) then `place_bet`.
- Subsequent bets: only `place_bet` (side locked by existing ticket).

The program remains unchanged (still two instructions) – no experimental `init_if_needed` required – preserving safety and clarity. This pattern is implemented in `lib/solana.ts` via the `bet()` helper.

## Economics Recap
- Dual fee model: authority fee (`fee_bps`, default 200 = 2.00%) + host fee (`host_fee_bps` default 50 = 0.50%).
- Fees apply only on profit (gross payout - principal) at claim time.
- Empty-side resolution: if the winning side had zero bets, the entire losing pool becomes fees (no winners to claim).

## Empty-Side UX
When an empty-side resolution occurs:
- UI displays a "No winners" banner.
- Claim buttons are hidden (no claimable tickets).
- Authority + host withdraw all captured fees normally.

## Market Closure & Dust Handling
`close_market` enforces:
- Market resolved.
- `fees_accrued == 0` (fees withdrawn).
- All winner tickets claimed (no extra lamports beyond rent or tiny dust).
A tiny surplus (<= 10 lamports) is auto-swept as fees split proportionally before closing, preventing stuck markets due to rounding.

## Frontend Structure
- `app/page.tsx` – main UI with authority selection, market panel, bet panel.
- `lib/solana.ts` – Anchor program helpers, PDA derivation, unified `bet` helper, decoding logic (title/labels).
- `idl/punt_program.ts` – Static IDL snapshot matching on-chain build.
- `components/*` – layout, wallet integration, toast notifications.

## Key Helpers (Cycle-Aware)
```
initializeMarket({ title, labelYes, labelNo, feeBps })  # auto-creates AuthorityMeta if needed
bet({ side, amountLamports, marketAuthority? })          # uses latest cycle
placeBet(amount, marketAuthority?)                       # latest cycle
createTicket(side, marketAuthority?)                     # latest cycle
resolveMarket(winningSide)                               # latest cycle
claimWinnings(marketAuthority?)                          # latest cycle
withdrawFees()                                           # latest cycle
closeMarket()                                            # latest cycle
closeTicket(marketAuthority?)                            # latest cycle
fetchMarket(marketAuthority?)                            # returns latest cycle or null
fetchTicket(marketAuthority?)                            # ticket for latest cycle or null
```

## Error Guidance
| On-Chain Error | Meaning | Action |
| -------------- | ------- | ------ |
| AuthorityCannotBet | Authority tried to bet | Use non-authority wallet |
| TicketSideMismatch | Bet tried on opposite side | Use same side or new authority market |
| FeesRemaining | Attempted close with pending fees | Withdraw fees first |
| OutstandingLamports | Unclaimed winnings remain | Winners must claim |
| CannotCloseActiveTicket | Close attempted on unclaimed winning ticket | Claim first |
| LabelTooLong | Title or label exceeded max length | Shorten inputs |

## Migration Notes
1. Pre-naming legacy markets: deserialize fails (`AccountDidNotDeserialize`) – treated as absent.
2. Pre-cycle markets (single fixed PDA) are deprecated. After deploying cycle-enabled program, the old market PDA (without cycle seed) will not be referenced by the updated frontend (it looks for meta + cycle). Users should initialize a new market; stale tickets remain inaccessible from the new UI (by design to prevent leakage).

## Development Tips
- After modifying the on-chain program, rebuild Anchor (`anchor build`), then copy / regenerate the IDL if needed.
- Keep `NEXT_PUBLIC_PROGRAM_ID` in sync with deployment.
- Use the query param `?authority=<pubkey>` for quick sharing / testing across wallets.

## Future Ideas
- Multiple concurrent markets per authority (index by incremental seed counter).
- In-place ticket side flip with penalty (for dynamic odds).
- Streaming overlay package subscribing to `MarketResolvedEvent` via WebSocket.
- Host pubkey governance / configuration on-chain.

## Disclaimer
Prototype code – not audited. Use only on devnet/test deployments. Validate economic invariants & event integrity before any real value deployment.


