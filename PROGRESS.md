# Progress

**Status:** COMPLETE — deployed at https://wrucebayne29.github.io/rcforge/

## Done
- Scaffold (toolchain copied from FrameForge), public repo, Pages enabled, HANDOVER.md.
- `src/is456/` complete, 73 tests, 99.8 % coverage: materials, flexure (singly, doubly, flanged),
  shear, deflection, anchorage, bar selection, `designBeam()`, `designColumn()` (interaction
  diagram, slenderness, biaxial), `designSlab()` (one-way, two-way, Tables 26 / 27),
  `designFooting()` (sizing, shear, punching, flexure, anchorage).

- Validation suite (75 published / closed-form values) → VALIDATION.md.
- `src/model/` (project, input validation, 11 worked examples), `src/io/` (validated JSON, share
  links), and the UI in the calculation-sheet style: forms for all four elements, title block,
  verdict stamp, to-scale section drawings, interaction chart, three-column working.

- Bar bending schedules, PDF calculation sheet (`src/io/report.ts`), About note, first-visit tour,
  number-key shortcuts, phone layout, print stylesheet.
- `scripts/e2e.mjs`: 58 Playwright checks, passing locally.

- Docs: README (GIF, screenshots, method, validation table, Mermaid architecture, roadmap),
  docs/THEORY.md, VALIDATION.md, CONTRIBUTING.md, issue and PR templates, LINKEDIN_POST.md,
  CV_BULLETS.md. `scripts/screenshots.mjs` regenerates the images.
- Self-review from screenshots: fixed PDF line breaks, clipped and overlapping drawing labels,
  footing drawing spacing, transparent PDF pages.

## Not verified / known limits
- **Table 26** (two-way slab coefficients) was typed from memory and is only guarded by
  consistency tests. Check it against a printed IS 456 before relying on slab results.
- Only page 1 of the PDF was inspected by eye.
- No dark theme (deliberate, see DECISIONS.md 11).

## If you resume
- Nothing is in progress. `npm run check` and `npm run e2e` should both pass.
- Next project, if usage allows: the slope stability analyser described in HANDOVER.md.

## Milestone checklist
- [x] 1. Code core: materials, flexure, shear
- [x] 2. Deflection, anchorage, detailing
- [x] 3. Columns
- [x] 4. Slabs and footings
- [x] 5. Validation suite
- [x] 6. MVP deploy
- [x] 7. Full UI
- [x] 8. Export
- [x] 9. Polish
- [x] Final docs & deliverables
- [x] Self-review on live site
