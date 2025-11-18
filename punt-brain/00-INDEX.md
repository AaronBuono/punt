# 🧠 Punt Project Brain - AI Context Document

> **This is the master reference for AI agents (like GitHub Copilot) to understand the Punt codebase and make accurate code suggestions.**

**PURPOSE:** When the developer asks you to create/modify features, read this brain first to understand:
- Existing code patterns and conventions
- Tech stack and dependencies
- Database schema and data models
- API contracts and naming conventions
- Component structure and file organization

---

## 📚 Document Structure

### 1. **Project Overview & Context**
**File:** [`01-PROJECT-CONTEXT.md`](./01-PROJECT-CONTEXT.md)

**What AI needs to know:**
- What Punt is (live betting on Pokémon pack openings)
- Key business logic (how betting, resolution, and payouts work)
- User roles (streamer vs viewer vs AI agent)
- Core workflows (place bet → freeze → AI resolve → claim)

### 2. **Technical Implementation Guide**
**File:** [`02-TECHNICAL-IMPLEMENTATION.md`](./02-TECHNICAL-IMPLEMENTATION.md)

**What AI needs to know:**
- Exact tech stack versions and imports
- File structure and naming conventions
- Code patterns for common tasks (API routes, Solana transactions, etc.)
- Database schema with exact field names
- Environment variables and config
- Existing utility functions to reuse

### 3. **Development Patterns & Standards**
**File:** [`03-DEVELOPMENT-PATTERNS.md`](./03-DEVELOPMENT-PATTERNS.md)

**What AI needs to know:**
- How to add new API routes
- How to create new Solana instructions
- Component structure (client vs server components)
- Error handling patterns
- Testing conventions
- Deployment steps

### 4. **Active Development Tasks**
**File:** [`04-TASKS.md`](./04-TASKS.md)

**What AI needs to know:**
- Current development priorities
- Known bugs and technical debt
- Feature roadmap
- Arcium Phase 2 migration plan
- Decisions that need to be made

---

## 🎯 Quick Reference for AI

### Key Repositories

| Folder | Purpose | Tech Stack |
|--------|---------|------------|
| **punt-frontend/** | Web app (UI + API routes) | Next.js 15, React 19, Tailwind v4, Prisma |
| **punt-program/** | Solana smart contract | Rust, Anchor 0.31 |
| **punt_mxe/** | Arcium encryption program | Rust, Anchor, Arcium SDK |
| **ai-agent/** | Automated resolution bot | Node.js, TypeScript, Google Vision API |

### When Developer Says...

| Request | Read This | Why |
|---------|-----------|-----|
| "Add a new API route" | `02-TECHNICAL-IMPLEMENTATION.md` → API Patterns | See exact imports, auth patterns, response formats |
| "Create a new Solana instruction" | `02-TECHNICAL-IMPLEMENTATION.md` → Smart Contract | See existing account structures, PDA seeds, error handling |
| "Build a new component" | `03-DEVELOPMENT-PATTERNS.md` → Frontend Patterns | See TypeScript types, SWR usage, wallet integration |
| "Update the database" | `02-TECHNICAL-IMPLEMENTATION.md` → Database Schema | See Prisma schema, migration commands |
| "Fix a bug in betting flow" | `01-PROJECT-CONTEXT.md` → Core Workflows | Understand the business logic first |
| "What should I work on next?" | `04-TASKS.md` | See active priorities and roadmap |
| "How do we implement Phase 2 encryption?" | `04-TASKS.md` → Task 2.1-2.3 | Detailed migration plan |

---

## 🔍 How AI Should Use This Brain

### Step 1: Understand Context
Read `01-PROJECT-CONTEXT.md` to understand:
- What feature you're modifying
- How it fits into the overall system
- What the expected behavior is

### Step 2: Find Implementation Details
Read `02-TECHNICAL-IMPLEMENTATION.md` to find:
- Exact file paths to edit
- Existing functions to reuse
- Database fields to reference
- API endpoints to call

### Step 3: Follow Patterns
Read `03-DEVELOPMENT-PATTERNS.md` to:
- Match existing code style
- Use the correct error handling
- Write tests in the same format
- Follow naming conventions

---

## 🛠️ Maintenance

**When to update:**
- ✏️ **After adding new features** → Update workflow descriptions in `01-PROJECT-CONTEXT.md`
- 🏗️ **After refactoring** → Update file paths and patterns in `02-TECHNICAL-IMPLEMENTATION.md`
- 📅 **After changing conventions** → Update standards in `03-DEVELOPMENT-PATTERNS.md`

**AI should always:**
- Read relevant sections before generating code
- Match existing patterns exactly
- Reuse existing utility functions
- Ask clarifying questions if context is unclear

---

**Last Updated:** November 18, 2025  
**Next Review:** When major features are added or refactored

