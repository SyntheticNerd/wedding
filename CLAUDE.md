# Wedding Site — Claude Handbook

> Read this first. Single source of truth for how this project is built and how Claude should behave in it.

## 1. What this is

A personal wedding website for Andrew. Audience is wedding guests (friends and family).

**Goals:**
- Share event info: date, venue, schedule, catering/menu, FAQ.
- Collect RSVPs, with optional plus-ones, dietary notes, and song requests.
- Notify Andrew when an RSVP is submitted.
- Display a registry section (links to external registries plus curated product picks with prices).
- Manage the guest list privately (admin-only view).

**Non-goals:**
- Public sign-up / accounts. Guests authenticate by being on the list.
- Photo upload during the event (out of scope unless explicitly added).
- Selling anything. Registry items are external links.

## 2. Stack

> Stack is being finalised in `docs/superpowers/specs/`. Update this section once the design doc is approved.

Working assumptions:
- **Framework:** Next.js (App Router), TypeScript strict.
- **Database:** Free-tier NoSQL — candidates: Firestore, MongoDB Atlas, Convex, Upstash Redis. Decision pending.
- **Hosting:** Vercel (Fluid Compute). Domain TBD.
- **Styling:** Tailwind. Aesthetic direction TBD in design doc.

## 3. Workflow conventions

This project mirrors the disciplined workflow Andrew uses in `~/code/budget-app`:

- **Brainstorm first.** Any multi-decision design or feature question goes through `superpowers:brainstorming`. No code, no scaffolding, until a design has been written and approved.
- **Visual companion.** When a question is better seen than read, start the brainstorming visual companion server and push HTML mockups. Pre-approved.
- **Plans before code.** Brainstorming hands off to `superpowers:writing-plans`. Implementation runs from the plan, not from freeform prompts.
- **Verify before claiming done.** Use `superpowers:verification-before-completion` before saying "fixed" or "shipped". Type-check, lint, and (where it matters) drive the UI in a browser.
- **TDD where it pays.** For data-model and validation logic (RSVP rules, guest list invariants), use `superpowers:test-driven-development`.
- **Specs live in** `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Plans live in `docs/superpowers/plans/`.

## 4. Memory

Project memory lives at `/home/andrew/.claude/projects/-home-andrew-code-wedding/memory/`. Read `MEMORY.md` first; it indexes user/feedback/project memories carried over from `budget-app`.

## 5. Git

- Main branch: `main`. Work in branches when the change is non-trivial; commit-on-main is fine for spec/doc-only edits.
- The Stop hook (`.claude/hooks/stop-check.sh`) warns about uncommitted changes at session end.

## 6. Hosting & secrets

- Use `vercel env` for environment management. `.env*` files are gitignored.
- Document required env vars in `.env.example` once the stack is locked in.
