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

### Never strand knowledge on a branch (orphaned-work rule)
Durable knowledge — planning docs, research, vendor lists, handoffs (anything under
`docs/` or any `.md`/`.jsonl` worth keeping) — **must land on `main`**, not just on a
feature branch. A branch that is never merged can be deleted and its docs lost forever
(this happened once with the Wolf Lakes preferred-vendor list).
- **Backstop:** `.claude/hooks/check-orphaned-branches.sh` runs on **SessionStart and Stop**
  and lists any docs/data that exist on a remote branch but are absent from `main`. If it
  fires, rescue those files (merge the branch's PR, or copy them onto `main`) before moving on.
- **Before ending a session:** make sure every planning doc you wrote is on `main` (open and
  merge its PR), and that the orphaned-work check is clean.

## 6. Hosting & secrets

- Use `vercel env` for environment management. `.env*` files are gitignored.
- Document required env vars in `.env.example` once the stack is locked in.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
