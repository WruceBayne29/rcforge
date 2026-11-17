# Progress

**Status:** IN PROGRESS

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

## In progress
- Docs and deliverables.

## Exact next step
1. Run `npm run e2e` against the live site after the deploy.
2. `scripts/screenshots.mjs` (adapt from FrameForge) → docs/screenshots + hero GIF.
3. README (full), docs/THEORY.md, CONTRIBUTING.md, issue templates, LINKEDIN_POST.md, CV_BULLETS.md.
4. Self-review of screenshots; fix what looks wrong; mark COMPLETE.

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
- [ ] Final docs & deliverables
- [ ] Self-review on live site
