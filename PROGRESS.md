# Progress

**Status:** IN PROGRESS

## Done
- Scaffold (toolchain copied from FrameForge), public repo, Pages enabled, HANDOVER.md.
- `src/is456/` complete, 73 tests, 99.8 % coverage: materials, flexure (singly, doubly, flanged),
  shear, deflection, anchorage, bar selection, `designBeam()`, `designColumn()` (interaction
  diagram, slenderness, biaxial), `designSlab()` (one-way, two-way, Tables 26 / 27),
  `designFooting()` (sizing, shear, punching, flexure, anchorage).

## In progress
- Validation suite, then the UI.

## Exact next step
1. `tests/validation/` + VALIDATION.md: published code values (xu,max/d, Mu,lim coefficients,
   pt,lim, steel curve points, Table 19, Table 27, development lengths) against the engine.
   Replace `tests/placeholder.test.ts`.
2. UI in the calculation-sheet style described in HANDOVER.md. `src/ui/App.tsx` is still a
   placeholder and the live site shows only a heading. Build order: sheet layout + beam form →
   deploy as MVP → column (with interaction chart) → slab → footing → section drawings.
3. Export (PDF sheet, JSON, share URL), polish, docs, Playwright self-review.

## Milestone checklist
- [x] 1. Code core: materials, flexure, shear
- [x] 2. Deflection, anchorage, detailing
- [x] 3. Columns
- [x] 4. Slabs and footings
- [ ] 5. Validation suite
- [ ] 6. MVP deploy
- [ ] 7. Full UI
- [ ] 8. Export
- [ ] 9. Polish
- [ ] Final docs & deliverables
- [ ] Self-review on live site
