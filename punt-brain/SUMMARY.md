# 🧠 Punt Brain - Quick Summary

This folder contains **AI-optimized documentation** designed for GitHub Copilot and other AI agents to understand your codebase when helping you build features.

---

## 📚 What's Inside

### **00-INDEX.md** 
Navigation guide explaining how to use the brain

### **01-PROJECT-CONTEXT.md** (Business Logic)
- What Punt is and how it works
- Core workflows (create poll → bet → freeze → resolve → claim)
- Betting math and payout calculations
- Privacy layers (Arcium encryption)
- Error scenarios
- Key identifiers (program IDs, PDA seeds, table names)

### **02-TECHNICAL-IMPLEMENTATION.md** (Code Reference)
- Exact tech stack versions
- Complete file structure
- Database schema (Prisma)
- Solana program IDL
- Code patterns for:
  - Frontend (SWR, wallet integration, transactions)
  - API routes (with exact imports)
  - Arcium encryption helpers
  - AI agent logic
- Environment variables
- Common error handling

### **03-DEVELOPMENT-PATTERNS.md** (How-To Guide)
- Step-by-step guides for:
  - Adding new API routes
  - Creating Solana instructions
  - Building React components
  - Adding database tables
  - Modifying AI agent logic
- Error handling standards
- Testing patterns
- Code style guidelines
- Deployment checklist

---

## 🎯 How You Should Use This

### When you ask me to add a feature, I will:

1. **Read `01-PROJECT-CONTEXT.md`** to understand the business logic
2. **Reference `02-TECHNICAL-IMPLEMENTATION.md`** for exact code patterns
3. **Follow `03-DEVELOPMENT-PATTERNS.md`** for implementation steps

This ensures I:
- ✅ Match your existing code style
- ✅ Reuse existing utilities instead of creating duplicates
- ✅ Use the correct imports and versions
- ✅ Handle errors the same way as your existing code
- ✅ Update all necessary files (frontend + backend + Solana program)

---

## ✅ Decisions Made

### 1. **API Authentication** ✅
**Decision:** Wallet signatures required for privacy-sensitive actions, but smart batching for UX.

**Rules:**
- ✅ **Require signature for:** Initial login, placing bets, creating polls, any state-changing action
- ✅ **One signature per user action:** If one button triggers multiple operations (e.g., "Freeze Poll" → freezes market + starts AI), batch into ONE transaction/signature
- ❌ **No signature for:** Read-only operations (fetching poll data, viewing bet history)

**Implementation Notes:**
- Frontend should batch related operations into a single transaction when possible
- Server-side operations (like AI resolution) don't need user signatures (use authority wallet)
- Example: "Freeze + AI Resolve" button should only prompt wallet once

---

### 2. **Auto-Claim Behavior** ✅
**Decision:** Automatic payouts, no minimum threshold, not optional.

**Rules:**
- ✅ Runs automatically after every resolution
- ✅ No minimum payout threshold (claim all winnings regardless of amount)
- ✅ Not optional (all winners get paid automatically)

**Rationale:** We've already verified payment into the poll, so payout verification is redundant. Automatic claims reduce friction.

---

### 3. **Encryption Adoption** ✅
**Decision:** Mandatory for all bets, move to Phase 2 implementation.

**Current Status:**
- ⚠️ **Phase 1 is incomplete** (half-implemented due to deadline)
- 🎯 **Goal:** Make Arcium encryption mandatory for all bets
- 📋 **Action Item:** Research and implement Phase 2 (client-side wallet-based encryption)

**See:** [`04-TASKS.md`](./04-TASKS.md) for implementation roadmap

---

### 4. **Poll Structure** ✅
**Decision:** Keep binary (Yes/No) for legal compliance.

**Rationale:**
- Legal gray area: Prediction markets with binary outcomes avoid gambling classification
- Following Kalshi model: Binary questions are legally safer
- Payout system: Winner-take-all from loser pool works cleanly with binary
- No house money: All payouts come from user bets only

**Future Enhancement:** Multi-choice options (see Task 5.1 in [`04-TASKS.md`](./04-TASKS.md))

---

### 5. **AI Agent Reliability & Fallback** ✅
**Decision:** Build moderator system + auto-refund failsafe.

**Implementation Plan:**
1. **Moderator Role:** Verified wallets can manually resolve if AI fails
2. **Moderator UI:** Special viewing interface for manual verification
3. **Auto-refund:** Emergency "cancel market" function for corrupted polls

**See:** Task 4.1 in [`04-TASKS.md`](./04-TASKS.md) for full implementation details

---

### 6. **File Structure** ✅
**Decision:** Organize for cleanliness as needed.

**Guideline:** AI should restructure files when it improves code organization and maintainability.

---

## ✅ What to Do Next

1. **Review** [`04-TASKS.md`](./04-TASKS.md) for active development tasks
2. **Start building** by saying things like:
   - "Implement Task 1.1 (fix wallet signatures)"
   - "Start Task 2.1 (Arcium Phase 2 encryption)"
   - "Build the moderator system (Task 4.1)"
   - "Add a leaderboard feature"

I'll read the brain first, then implement following your exact patterns!

---

## 🎯 All Questions Resolved!

The brain is now complete and ready to use. All architectural decisions are documented, and priority tasks are mapped out in [`04-TASKS.md`](./04-TASKS.md).

---

**Created:** November 18, 2025  
**Purpose:** Help AI assistants write code that matches your existing codebase