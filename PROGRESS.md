# Progress

**Status:** IN PROGRESS

## Done
- Scaffold (toolchain copied from FrameForge), public repo, Pages enabled, HANDOVER.md.
- `src/is456/`: materials + stress–strain curves, worked-step helpers, beam flexure (singly,
  doubly, flanged), shear, deflection factors, anchorage, bar selection, and `designBeam()` which
  ties them together and returns the calculation sheet. 41 tests.

## In progress
- Milestone 3: columns (`src/is456/column.ts`).

## Exact next step
- Write `column.ts`: P–M interaction by strain compatibility (rectangular + circular), minimum
  eccentricity, slenderness moments (cl. 39.7.1), biaxial check (cl. 39.6), `designColumn()`.
  Then `slab.ts`, `footing.ts`, then the validation suite, then the UI (see HANDOVER.md for the
  required look).

## Milestone checklist
- [x] 1. Code core: materials, flexure, shear
- [x] 2. Deflection, anchorage, detailing
- [ ] 3. Columns
- [ ] 4. Slabs and footings
- [ ] 5. Validation suite
- [ ] 6. MVP deploy
- [ ] 7. Full UI
- [ ] 8. Export
- [ ] 9. Polish
- [ ] Final docs & deliverables
- [ ] Self-review on live site
