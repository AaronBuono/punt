# 🎴 Punt Event System - "Predict the Pull"

Mobile-first live IRL betting experience for pack opening events.

## 📱 Overview

The Event System allows you to run live pack opening events where attendees bet on outcomes in real-time using their phones. Perfect for conventions, meetups, or live streams.

**Key Features:**
- Mobile-optimized betting interface
- Fixed $1 stakes for simple gameplay
- Real-time updates via polling
- Random card winner selection
- Admin dashboard for event management

---

## 🚀 Quick Start

### 1. Setup Environment

The event admin page uses the same password as the Studio access: **`ILoveGambling67`**

No additional environment setup is required.

### 2. Deploy Database Schema

The Prisma migration has already been applied. If you need to re-run:

```bash
npx prisma migrate deploy
npx prisma generate
```

### 3. Access the Pages

**Public Betting Page:**
```
https://your-domain.com/event/predict-the-pull
```

**Admin Control Panel:**
```
https://your-domain.com/event/predict-the-pull/admin
```

---

## 🎯 Event Workflow

### For Attendees (Public Page)

1. **Enter Name/Handle**
   - Quick identification (32 char max)

2. **Connect Wallet**
   - Uses Phantom wallet adapter
   - Required for bet placement

3. **Make Prediction**
   - Choose YES or NO
   - Fixed $1 stake (no blockchain transaction required for MVP)

4. **Wait for Result**
   - See "Waiting for pack opening..." state
   - Shows total pot and their bet

5. **Get Result**
   - WIN/LOSE display
   - Payout amount shown
   - Special banner if they won the physical card

### For Admin (Admin Page)

1. **Authenticate**
   - Enter `EVENT_ADMIN_SECRET` from environment
   - Saved to localStorage

2. **Create Poll**
   - Set question (default: "Will this pack contain an Ultra Rare or better?")
   - One active poll at a time

3. **Monitor Bets**
   - Real-time view of all bets
   - YES/NO counts
   - Total pot tracking

4. **Freeze Poll**
   - Locks in all bets
   - Bettors see "Poll Frozen" state
   - Do this when you're about to open the pack

5. **Settle Poll**
   - Choose outcome:
     - **Ultra Rare Pulled** → YES wins
     - **No Ultra Rare** → NO wins
   - System automatically:
     - Calculates payouts (pool-based)
     - Randomly selects one winner as card recipient
     - Updates all bet statuses

6. **View Summary**
   - See settlement details
   - Card winner information
   - Payout breakdown

---

## 💰 Payout Logic

**Pool-Based Distribution:**

```typescript
// If Ultra Rare pulled:
- Winners: All "YES" bettors
- Losers: All "NO" bettors

// Calculate each winner's share:
payout = (yourBet / totalYesBets) * totalPot

// Example:
Total Pot: $20 (20 bettors × $1)
YES Pool: $12 (12 bettors)
NO Pool: $8 (8 bettors)

Ultra Rare Pulled → YES wins
Each YES bettor gets: ($1 / $12) × $20 = $1.67
Net profit: $0.67 per YES bet
```

**Card Winner Selection:**
- Only when Ultra Rare is pulled
- Randomly selected from winning bettors
- Displayed prominently in results

---

## 🔧 API Endpoints

### `GET /api/event/poll`
Get active event poll with all bets.

**Response:**
```json
{
  "poll": {
    "id": "clx123...",
    "question": "Will this pack contain an Ultra Rare or better?",
    "status": "active",  // active, frozen, settled
    "outcome": null,     // ULTRA_RARE, NO_ULTRA_RARE, or null
    "totalPot": 15.00,
    "cardWinner": null,  // wallet address or null
    "bets": [
      {
        "id": "clx456...",
        "wallet": "5gVL...",
        "handle": "PokeFan",
        "choice": "YES",
        "stake": 1.00
      }
    ]
  }
}
```

### `POST /api/event/poll`
Create new poll (admin only).

**Request:**
```json
{
  "question": "Will this pack contain an Ultra Rare or better?",
  "adminSecret": "your_secret"
}
```

### `PATCH /api/event/poll`
Update poll status (admin only).

**Freeze:**
```json
{
  "pollId": "clx123...",
  "action": "freeze",
  "adminSecret": "your_secret"
}
```

**Settle:**
```json
{
  "pollId": "clx123...",
  "action": "settle",
  "outcome": "ULTRA_RARE",  // or NO_ULTRA_RARE
  "adminSecret": "your_secret"
}
```

### `POST /api/event/bet`
Place a bet.

**Request:**
```json
{
  "wallet": "5gVL...",
  "handle": "PokeFan",
  "choice": "YES"  // or NO
}
```

### `GET /api/event/bet?wallet={address}`
Get user's bet on active poll.

---

## 📊 Database Schema

### `EventPoll`
```prisma
model EventPoll {
  id          String    @id @default(cuid())
  question    String
  status      String    @default("active")
  outcome     String?
  totalPot    Float     @default(0)
  cardWinner  String?
  createdAt   DateTime  @default(now())
  settledAt   DateTime?
  bets        EventBet[]
}
```

### `EventBet`
```prisma
model EventBet {
  id            String    @id @default(cuid())
  pollId        String
  wallet        String
  handle        String
  choice        String    // YES, NO
  stake         Float     @default(1)
  payout        Float?
  isCardWinner  Boolean   @default(false)
  createdAt     DateTime  @default(now())
  poll          EventPoll @relation(...)
}
```

---

## 🎨 Mobile-First Design

Built with Tailwind CSS and optimized for phones:

- ✅ Responsive layouts (320px → 768px+)
- ✅ Large touch targets (min 44px)
- ✅ Readable fonts (16px+)
- ✅ High contrast colors
- ✅ Simple navigation
- ✅ Fast loading (< 3s)

**Tested on:**
- iPhone 12/13/14 (Safari, Chrome)
- Samsung Galaxy S21/S22 (Chrome, Samsung Browser)
- Pixel 6/7 (Chrome)

---

## 🔐 Security

### Admin Access
- Simple password authentication (same as Studio: "ILoveGambling67")
- Stored in localStorage after first entry
- No complex auth needed for single-admin events
- **Production:** Change password in both `/studio/page.tsx` and `/api/event/poll/route.ts`

### Bet Validation
- Server-side checks for:
  - Valid wallet addresses
  - Non-empty handles
  - YES/NO choice only
  - One bet per wallet per poll
  - Poll is active before accepting bets

### Rate Limiting
**TODO:** Add rate limiting middleware for production
```typescript
// Suggested: @upstash/ratelimit
// Limit: 10 bets/minute per wallet
// Limit: 100 requests/minute per IP
```

---

## 🧪 Testing Checklist

### Before Event
- [ ] Admin secret set in production environment
- [ ] Database migrations applied
- [ ] Test public page on mobile devices
- [ ] Test wallet connection (Phantom/Solflare)
- [ ] Create test poll from admin page
- [ ] Place test bets from multiple devices
- [ ] Freeze test poll
- [ ] Settle test poll (both outcomes)
- [ ] Verify payouts calculated correctly
- [ ] Verify card winner randomly selected

### During Event
- [ ] Monitor network conditions (WiFi/cellular)
- [ ] Have backup admin device ready
- [ ] Keep event page open on projector/screen
- [ ] Have physical card ready for winner
- [ ] Take photos of card winner for social media

### After Event
- [ ] Download bet data for records
- [ ] Clear localStorage on admin device
- [ ] Archive poll data if needed
- [ ] Gather feedback from attendees

---

## 📈 Future Enhancements

### Phase 2 Features
- [ ] Multiple simultaneous polls
- [ ] Wallet-based authentication for admin
- [ ] Custom stake amounts ($1, $2, $5)
- [ ] Historical event leaderboard
- [ ] QR code for quick access
- [ ] Push notifications for results
- [ ] Integration with Solana transactions
- [ ] SPL token payouts (USDC/BONK)

### Phase 3 Features
- [ ] Live video integration (pack reveal)
- [ ] Multi-choice polls (which card?)
- [ ] Team/bracket betting
- [ ] NFT tickets for events
- [ ] On-chain settlement via Punt program
- [ ] Encrypted bet data via Arcium

---

## 🐛 Troubleshooting

### Users can't connect wallet
**Solution:** Ensure Phantom/Solflare is installed. Test on mobile browser vs. in-wallet browser.

### Bets not showing up
**Solution:** Check 3-second polling interval. Manually refresh or increase `refreshInterval` in SWR.

### Admin can't authenticate
**Solution:** Ensure you're using the correct password ("ILoveGambling67"). Check browser console for errors.

### Payouts wrong
**Solution:** Verify `totalPot` calculation. Check bet filters (`choice === winningChoice`). Review settlement logic.

### Card winner not selected
**Solution:** Only selected when `outcome === "ULTRA_RARE"`. Check random selection logic uses correct array.

---

## 📞 Support

For issues or questions:
- Open GitHub issue
- Check `punt-brain/` documentation
- Review API route logs in Vercel

---

**Built with ❤️ for the Punt community**
