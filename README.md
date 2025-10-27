# Punt

Punt is a Solana-based prediction market toolkit for livestreams. The repo contains three cooperating packages:

- **`punt-program/`** – Anchor smart contract implementing cycle-based markets, ticket accounting, fee settlement, and resolution events.
- **`punt-frontend/`** – Next.js 15 application with LiveKit-powered studio/watch experiences, encrypted bet storage, and operator tooling.
- **`ai-agent/`** – LiveKit agent that watches the broadcast, classifies card pulls with Google Vision, and can resolve markets automatically.

Use this document as the single place to bootstrap the stack, understand key features, and keep the generated IDL and environment files in sync.

## High-Level Architecture

- **Markets on-chain** – Each authority owns a monotonic cycle counter. The program derives PDAs per `(authority, cycle)` so every round is isolated. Tickets are unique per `(user, market)` and bets lock the side after the first wager. Resolution emits events and enforces fee withdrawal before closure.
- **Streaming frontend** – Operates entirely in the app router. Studio mode lets hosts initialize/freeze/resolve markets, while Watch mode handles wallet onboarding and unified bet flow.
- **Encrypted storage** – Browser clients derive an x25519 keypair per wallet, encrypt bet payloads with Arcium RescueCipher, and post envelopes to `/api/store-bet`. The server can forward to Arcium compute or fall back to a local JSON store for dev work.
- **Automation agent** – Optional worker that listens for freeze cues in LiveKit chat, samples video frames, performs OCR-based rarity detection, and executes `resolve_market` when configured.

## Prerequisites

- Node.js 20+
- Rust stable + Cargo
- Solana CLI ≥ 1.18 and Anchor CLI ≥ 0.30
- pnpm or npm (examples use npm)
- LiveKit account (or self-hosted server) for realtime video
- Google Cloud project with Vision API enabled if you run the automation agent

## Quick Start

```bash
# initial clone
git clone https://github.com/AaronBuono/punt.git
cd punt

# install dependencies
cd punt-frontend && npm install && cd ..
cd punt-program && npm install && cd ..       # installs Anchor workspace tooling
cd ai-agent && npm install && cd ..

# copy environment templates
cp punt-frontend/.env.example punt-frontend/.env.local
cp ai-agent/.env.example ai-agent/.env        # create and fill as described below (file not tracked by git)

# build Anchor program locally (creates target/idl)
cd punt-program
anchor build

# sync the generated IDL into the frontend bundle
cd ../punt-frontend
npm run copy-idl

# run the web app
npm run dev
```

Visit `http://localhost:3000` for the watch & studio UI. Dev mode writes encrypted bet envelopes to `punt-frontend/tmp/arcium-bets.json` unless you provide Arcium credentials.

## On-Chain Program (`punt-program/`)

- **Key instructions** – `initialize_market`, `place_bet`, `create_ticket`, `freeze_market`, `resolve_market`, `claim_winnings`, `withdraw_fees`, `close_market`, `close_ticket`, and `init_authority_meta` for first-time authorities.
- **Cycle model** – `AuthorityMeta` stores `next_cycle`; current market lives at `next_cycle - 1`. PDA seeds are documented in `idl/punt_program.json`.
- **Events & errors** – `MarketResolvedEvent` broadcasts outcomes; detailed error codes reside in the IDL.
- **Useful commands**
   - `anchor test` – runs the Anchor mocha tests against a local validator.
   - `anchor deploy` – deploy to devnet/mainnet (update `Anchor.toml`).
   - `solana program show <program_id>` – verify deployment.
- After every rebuild/deploy, run `npm run copy-idl` from `punt-frontend` to keep the bundled IDL and `/public/idl/punt_program.json` up to date.

## Frontend (`punt-frontend/`)

- **Tech stack** – Next.js App Router, React 19, TypeScript, SWR, Tailwind 4, LiveKit client SDK.
- **Key pages**
   - `app/studio` – Host controls for market lifecycle, LiveKit publish, and freeze/resolve actions.
   - `app/watch` – Viewer experience with wallet connect, odds display, encrypted bet posting, and claim statuses.
   - `app/my-bets` – Private history decrypted client-side using Arcium envelopes.
- **Server APIs** – `/api/store-bet`, `/api/get-bets`, `/api/livekit/token`, `/api/stream(s)` support encryption, LiveKit access tokens, and market metadata.
- **Environment variables** (fill in `.env.local`)
   - `NEXT_PUBLIC_PROGRAM_ID`, `NEXT_PUBLIC_NETWORK` – Solana program + RPC endpoint.
   - `NEXT_PUBLIC_ARCIUM_MXE_PUBLIC_KEY` – Public key of the Arcium MXE storing bet envelopes.
   - `ARCIUM_API_KEY`, `ARCIUM_COMPUTE_URL` – Only on the server host if you forward envelopes to Arcium compute; omit for local JSON storage.
   - `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` – Streaming credentials.
   - Database URL for Prisma (Neon by default) if you enable persistent stream metadata.
- **NPM scripts**
   - `npm run dev` / `build` / `start`
   - `npm run lint`
   - `npm test` – executes Vitest-powered smoke and component tests
   - `npm run mxe:fetch` – calls `scripts/create-or-get-mxe.js` to create/fetch the MXE and print its public key (requires `ARCIUM_API_KEY`).

## Automation Agent (`ai-agent/`)

- Watches a LiveKit room, listens for the configured freeze chat message, samples frames, and identifies rare pulls using Google Vision.
- When `AUTO_SOLANA_RESOLVE=true`, submits `resolve_market` via the authority keypair; otherwise emits chat messages only.
- Important environment fields (see `ai-agent/README.md` for the full list):
   - LiveKit: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_ROOM`.
   - Vision: `GOOGLE_APPLICATION_CREDENTIALS`, `VISION_MIN_CONFIDENCE`, `FRAME_SAMPLE_RATE_HZ`.
   - Solana: `SOLANA_RPC_URL`, `SOLANA_PROGRAM_ID`, `SOLANA_WALLET_PATH`, `SOLANA_AUTHORITY`.
   - Stream coordination: `STREAM_STATUS_URL` (polls frontend API for current market), message constants for freeze/result text.
- Commands:
   - `npm run start` – launches the agent.
   - `node scripts/generateToken.js` – diagnostic helper to mint LiveKit tokens.
   - `node scripts/sendFreeze.js` – sends a freeze cue into the room for local testing.

## Testing & QA

- **Program** – `cd punt-program && anchor test` (sets up a fresh validator, builds, and runs mocha suites).
- **Frontend** – `cd punt-frontend`
   - `npm run lint`
   - `npm test`
   - `npm run dev` with browser-based manual verification (watch vs. studio, encrypted bet flow, LiveKit integration).
- **Agent** – `npm run start` inside `ai-agent` with `LIVEKIT_SMOKE=1` to exercise the freeze/resolve loop against the smoke scripts.

## Deployment Notes

- Re-deploying the program updates the IDL address; always sync the IDL and redeploy the frontend afterward.
- Frontend hosting (Vercel/Netlify) requires the IDL file committed under `public/idl/` or a build step invoking `npm run copy-idl`.
- Secrets: keep Arcium API keys, LiveKit server secrets, and Solana authority keypairs outside of git. Use environment managers provided by your platform.
- The app can operate without Arcium credentials in development; encrypted envelopes fall back to local JSON storage under `punt-frontend/tmp/`.

## Support

- Maintainer: Aaron Buono (`@AaronBuono`)
- Issues & discussions: open GitHub issues or reach out on Discord/Email (aaronjacobbuono@gmail.com)
