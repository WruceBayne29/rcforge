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

## In progress
- MVP deployed; finishing features.

## Exact next step
1. `scripts/e2e.mjs` (Playwright, adapt from FrameForge) and run it on the live site.
2. Bar bending schedule (`src/is456/schedule.ts` + a table on the sheet).
3. PDF calculation sheet (`src/io/report.ts`, jsPDF + autotable; rasterise the on-screen SVG).
4. Help dialog + first-run tour; phone layout check.
5. README, docs/THEORY.md, CONTRIBUTING, templates, LINKEDIN_POST.md, CV_BULLETS.md, screenshots.

## Milestone checklist
- [x] 1. Code core: materials, flexure, shear
- [x] 2. Deflection, anchorage, detailing
- [x] 3. Columns
- [x] 4. Slabs and footings
- [x] 5. Validation suite
- [x] 6. MVP deploy
- [ ] 7. Full UI
- [ ] 8. Export
- [ ] 9. Polish
- [ ] Final docs & deliverables
- [ ] Self-review on live site
