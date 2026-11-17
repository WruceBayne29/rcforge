# Handover prompt

Paste everything below the line into a new Claude Code session (any account). Open the session in
the project folder if it exists on that machine; otherwise the prompt tells Claude to clone it.

---

You are continuing an autonomous build of **RCForge**, a portfolio-quality open-source project.
I am AFK and will NOT respond. Never ask me questions. When you hit a decision, make the best
call, log it in DECISIONS.md, and keep going. If something truly needs me (e.g. an auth failure),
log it in BLOCKERS.md, skip it, and continue with other work.

## Where the work is

- Local folder: `/Users/vishnusuhaasmagadala/Desktop/rcforge` (if it does not exist, run
  `gh repo clone WruceBayne29/rcforge` and work there).
- GitHub: https://github.com/WruceBayne29/rcforge (public, GitHub Pages via Actions already enabled)
- Live site: https://wrucebayne29.github.io/rcforge/
- Sister project, finished, for reference and reusable code:
  `/Users/vishnusuhaasmagadala/Desktop/frameforge` (https://github.com/WruceBayne29/frameforge)

## Current state

**RCForge is complete and deployed** (see PROGRESS.md). If you are picking this up, the work left is
the next project under "After RCForge" below, plus anything the owner asks for.

## First thing to do

Read, in this order: `PROGRESS.md` (state and the exact next step), `PLAN.md` (scope and
architecture), `DECISIONS.md` (calls already made — do not re-litigate them), `BLOCKERS.md`.
Run `npm install` then `npm run check` to confirm the repo is green. Then continue from the
"Exact next step" in PROGRESS.md.

## What RCForge is

A browser-based reinforced concrete designer to **IS 456:2000** (limit state method) for students:
beams (flexure, shear, deflection, anchorage), columns (P–M interaction, slenderness, biaxial),
slabs (one-way, two-way) and isolated footings. Every calculation step is shown with its clause
reference. TypeScript + React + Vite, no backend, deployed to GitHub Pages. Full scope: PLAN.md.

## Rules

- Session may be cut off at any moment. Update PROGRESS.md (done / in progress / exact next step)
  after every meaningful step. Commit and push small, frequent commits. The repo must always be
  working, deployed and presentable. Keep this HANDOVER.md accurate too.
- Run `npm run check` (lint + tests + build) before every commit and fix anything that fails.
  Check exit codes properly: do not pipe a command into `tail` and assume it passed.
- Strict TypeScript, ESLint + Prettier, no `any`. `src/is456/` is pure (no React/DOM) and must stay
  above 90 % test coverage.
- Code tables: implement from the underlying formula where one exists; where values are typed in
  from memory, add a consistency test that would catch a typo, and list the table in VALIDATION.md
  as "entered from memory, verify against the code".
- Be honest in all docs. Do not claim validation against a textbook example unless the expected
  number is derived independently in the test. LINKEDIN_POST.md and CV_BULLETS.md must say the
  code was written by an AI coding agent from the owner's specification.

## Look and feel (owner's explicit request)

RCForge must NOT look like FrameForge or like a generic AI-generated dashboard. It looks like an
**engineer's calculation sheet**: three columns — Reference (clause) | Calculations | Output — with
section drawings in a framed box and a drawing-style title block. Warm paper white, dark ink text,
autumn accents (rust, ochre, olive) used sparingly. Serif headings, monospace figures, thin ruled
lines, square corners, plain underlined tabs. No blue, no gradients, no pills or chips. Light
theme is the default.

## Lessons already learned (from FrameForge)

- TypeScript is pinned to 6.0: `typescript-eslint` does not support 7.x.
- The in-app browser may refuse the public Pages URL without the owner's approval. Verify deploys
  with `curl` and with Playwright (`npm run e2e`), which also generates README screenshots.
- `tsc -b` uses `erasableSyntaxOnly`: no enums, no constructor parameter properties.
- jsPDF's built-in fonts only cover Latin-1; sanitise Greek letters and arrows before writing text.
- Useful patterns to copy from FrameForge: `src/io/share.ts` (model in the URL),
  `src/io/projectFile.ts` (validated JSON), `src/io/report.ts` (vector PDF), `scripts/e2e.mjs`,
  `scripts/screenshots.mjs`, `src/ui/toast.tsx`, `src/ui/fields.tsx`, `src/ui/Tour.tsx`.

## Final deliverables

README.md (hero GIF/screenshots generated with Playwright, features, live link, theory with
equations, validation table, Mermaid architecture diagram, roadmap), docs/THEORY.md, VALIDATION.md,
LINKEDIN_POST.md, CV_BULLETS.md, CONTRIBUTING.md, issue templates, MIT license. Then a full
self-review: run the live site with Playwright, click through every feature, fix bugs, improve
polish. Mark PROGRESS.md "COMPLETE" only when everything is done and deployed.

## After RCForge

If usage remains, build the next project the same way, in a new folder and repo
(`~/Desktop/slopeforge`, `gh repo create slopeforge --public`): a browser-based **slope stability
analyser** — draw a slope and soil layers, search for the critical slip circle and factor of
safety (Fellenius and Bishop's simplified method), validated against published benchmark slopes.
Give it its own visual identity too.
