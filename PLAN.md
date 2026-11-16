# RCForge — build plan

Browser-based reinforced concrete design to **IS 456:2000** (limit state method), for students.
Sister project to [FrameForge](https://github.com/WruceBayne29/frameforge) (steel + analysis).
TypeScript + React + Vite, no backend, deployed to GitHub Pages.

## What it does

Design and check of the four elements every RC course covers, with every calculation step shown
and tied to its clause:

- **Beams** — singly / doubly reinforced and flanged sections: flexure, shear, deflection
  (span/depth), anchorage, minimum and maximum steel, bar selection.
- **Columns** — short and slender, axial + uniaxial / biaxial bending, P–M interaction diagram
  from strain compatibility (rectangular and circular).
- **Slabs** — one-way and two-way (IS 456 Annex D coefficients).
- **Footings** — isolated pad footings: sizing, one-way and punching shear, flexure.

Plus: scaled cross-section drawings, bar bending schedule, PDF calculation sheet, JSON save/load,
share links, examples, dark/light, tour.

## Architecture

```
src/
  is456/     pure TS, no React/DOM. Materials, flexure, shear, deflection, anchorage,
             column interaction, slabs, footings. Every function returns results + worked steps.
  model/     design cases (inputs) for each element type, defaults, examples
  io/        JSON files, share URLs, PDF calculation sheet
  ui/        React: forms, results, checks, drawings, interaction chart
tests/validation/   closed-form and published-value checks → VALIDATION.md
scripts/     Playwright end-to-end and screenshot scripts
docs/        THEORY.md, screenshots
```

Units at the API boundary: mm, kN, kN·m, m (spans), MPa. Internally N and mm.

## Milestones

1. **Code core** — materials and stress block, beam flexure (singly, doubly, flanged), shear.
2. **Serviceability and detailing** — deflection (span/depth with modification factors),
   development length, min/max steel, spacing, bar selection.
3. **Columns** — interaction diagram by strain compatibility, slenderness moments, biaxial check.
4. **Slabs and footings.**
5. **Validation suite** — published constants (limiting moment coefficients, limiting steel
   percentages, τc table), closed-form identities and cross-checks → `VALIDATION.md`.
6. **MVP deploy** — beam designer UI live on GitHub Pages.
7. **Full UI** — all four elements, section drawings, worked steps, interaction chart, bar schedule.
8. **Export** — PDF calculation sheet, JSON, share URLs.
9. **Polish** — themes, examples, tour, responsive, shortcuts.

## Final deliverables

README (screenshots/GIF, features, theory, validation, architecture, roadmap), docs/THEORY.md,
VALIDATION.md, LINKEDIN_POST.md, CV_BULLETS.md, MIT LICENSE, CONTRIBUTING.md, issue templates.

## Working rules

- PROGRESS.md updated after every meaningful step; small commits pushed often.
- `npm run check` (lint + tests + build) before every commit.
- Decisions → DECISIONS.md. Anything needing the owner → BLOCKERS.md.
- On resume: read PROGRESS.md, PLAN.md, DECISIONS.md, BLOCKERS.md first.
