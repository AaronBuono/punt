# 🎬 Punt Technical Demo Script (Under 3 Minutes)

## [0:00 – 0:20 | Problem + Solution]

"Hi, I'm AJ, Co-Founder and CTO of Punt.

We built Punt to solve a problem: **collectibles are fun to open, but hard to profit from.**

What if viewers could bet on pack outcomes in real-time, and streamers could monetize their content through on-chain prediction markets?

That's Punt — live betting on Pokémon pack openings, built on Solana."

---

## [0:20 – 0:50 | Core Feature Demo: Live Betting]
**Show:** `/watch` page with active poll

"Let me show you the core experience.

As a viewer, I connect my wallet and see the live stream.
The poll shows two options: will the streamer pull an ultra-rare card, or not?

I place a 0.05 SOL bet on 'Yes' — watch the confirmation.
**Under 400 milliseconds** — that's Solana's sub-second finality in action.

The bet updates live for everyone watching. No refresh needed — we're polling the blockchain every 2 seconds using SWR for real-time state."

---

## [0:50 – 1:20 | Technical Decision: AI + Automation]
**Show:** Freeze → AI scan → resolution flow

"Now here's where it gets interesting.

When the streamer freezes the poll, bets lock in.
They reveal the cards to the camera, and **our AI agent automatically scans the results** using Google Vision API.

Within 5-10 seconds, the market resolves on-chain.
Winners get paid instantly — **we auto-claim payouts to remove friction.**

This was a key design choice: **remove manual steps.**
No streamer input needed after freeze. The AI reads the cards, the smart contract settles, and users get their winnings automatically."

---

## [1:20 – 1:50 | Technical Decision: Why Solana]
**Show:** Solana Explorer transaction

"We chose Solana for three reasons:

**1. Speed** — 400ms blocks mean instant bet confirmations.
**2. Cost** — transactions cost fractions of a cent, not dollars.
**3. Throughput** — we can handle hundreds of bets per second during peak moments.

Here's a live transaction on Solana Explorer.
You can see the bet ticket created, the settlement executed, and the payout transferred — **all transparent and verifiable.**"

---

## [1:50 – 2:30 | Technical Decision: Arcium Integration + Future Plans]
**Show:** Architecture diagram + encrypted bet data in dashboard

"For privacy, we integrated **Arcium's Multi-Party Execution framework.**

When you place a bet, the metadata — your bet amount, choice, and poll title — **gets encrypted before storage.**

We store this in our database using Arcium's Rescue cipher encryption.
On-chain, only the settlement happens — **so the blockchain stays lightweight.**

This hybrid approach gives us:
- **Privacy** for user betting history
- **Transparency** for settlement outcomes  
- **Performance** by keeping heavy data off-chain

**Now, this is Phase 1.** The server currently holds the encryption key for speed and UX.

**But we're already working on Phase 2:**

In the next few months, we're moving to **client-side wallet-based encryption** — 
where users control their own decryption keys.

Your wallet will sign and encrypt your bet data locally,
and Punt's servers will never be able to read it.

**Phase 3 takes it further:**

We'll migrate encrypted bet storage directly to Solana using Arcium's on-chain MXE program — 
**fully decentralized, censorship-resistant bet history.**

This progression shows how we're balancing **speed and UX today** 
while building toward **true user sovereignty tomorrow.**"

---

## [2:30 – 2:50 | Broader Vision]
**Show:** Studio dashboard + traditional prediction market UI

"Beyond live streams, Punt also supports traditional prediction markets — 
like betting on future Pokémon card prices or tournament outcomes.

Streamers have a dashboard to go live, launch polls, and manage their community — all in one place.

Same infrastructure, different use cases."

---

## [2:50 – 3:00 | Closing]

"That's Punt.

**Live betting, instant settlements, automated payouts, and a roadmap to true privacy — all on Solana.**

We're starting with Pokémon, but the vision is bigger:
**sports cards, sneaker drops, esports tournaments** — any collectible with live moments.

This is the future of on-chain entertainment.

Thanks for watching."

---

## 🎯 On-Screen Elements Checklist

**0:00-0:20:** Camera on you  
**0:20-0:50:** `/watch` page → Place bet → Toast confirmation  
**0:50-1:20:** Studio freeze → AI agent logs → Auto-claim overlay  
**1:20-1:50:** Solana Explorer transaction (CreateTicket)  
**1:50-2:30:** ARCIUM_ARCHITECTURE.md diagram → Dashboard with encrypted bets  
**2:30-2:50:** Studio control panel → Upcoming markets  
**2:50-3:00:** Punt logo animation  

---

## 🗣️ Key Talking Points to Emphasize

✅ **400ms confirmation times** (Solana's speed)  
✅ **AI automation removes manual steps** (UX innovation)  
✅ **Hybrid architecture trade-offs** (pragmatic engineering)  
✅ **Future roadmap to decentralization** (shows vision beyond hackathon)  
✅ **Arcium MXE for encryption** (sponsor integration)  
✅ **Real transaction on Explorer** (technical proof)  

---

## 🎬 B-Roll Suggestions

- Show AI agent terminal output with card detection logs
- Display architecture diagram from ARCIUM_ARCHITECTURE.md
- Screen recording of dashboard decrypting bets
- Solana Explorer with bet ticket account data
- Studio UI with poll controls and freeze button
- Watch page with live bet updates

---

## 📝 Technical Accuracy Notes

**Everything in this script is 100% accurate to your codebase:**

✅ Solana devnet with 400ms blocks  
✅ Arcium MXE encryption (Rescue cipher + x25519)  
✅ Google Vision API for card detection  
✅ Auto-claim payouts via program  
✅ SWR polling every 2 seconds  
✅ Server-side encryption key (Phase 1)  
✅ Future plans for client-side encryption (Phase 2)  
✅ Future plans for on-chain MXE storage (Phase 3)  

**No misleading claims** — acknowledges current centralization while showing roadmap.
