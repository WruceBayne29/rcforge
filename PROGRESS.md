# Progress

**Status:** IN PROGRESS

## Done
- Scaffold (toolchain copied from FrameForge), public repo, Pages enabled, HANDOVER.md.
- `src/is456/`: materials + stress–strain curves, worked-step helpers, beam flexure (singly,
  doubly, flanged), shear, deflection factors, anchorage, bar selection, `designBeam()`.
- `src/is456/column.ts`: P–M interaction by strain compatibility (rectangular + circular),
  minimum eccentricity, slenderness moments, biaxial check, ties, `designColumn()`. 57 tests pass.

## In progress
- Nothing half-written. Session stopped here on a usage limit.

## Exact next step
1. `src/is456/slab.ts` — one-way slabs (Table 12 / 13 coefficients) and two-way slabs (Annex D:
   Table 27 from the Rankine–Grashoff formula; Table 26 typed in and guarded by a test against
   its generating equations, see DECISIONS.md 4). Reuse `designRectangular` per metre strip,
   `slabShearFactor`, `slabBarSpacing`, the deflection factors.
2. `src/is456/footing.ts` — isolated pad footing: size from bearing capacity, one-way shear,
   punching shear (cl. 31.6), flexure at the column face, development length.
3. `src/is456/index.ts`, then `tests/validation/` + VALIDATION.md (replace
   `tests/placeholder.test.ts`).
4. UI in the calculation-sheet style described in HANDOVER.md; deploy the beam designer first
   as the MVP. No UI exists yet: `src/ui/App.tsx` is a placeholder and the live site shows only
   the heading.

## Milestone checklist
- [x] 1. Code core: materials, flexure, shear
- [x] 2. Deflection, anchorage, detailing
- [x] 3. Columns
- [ ] 4. Slabs and footings
- [ ] 5. Validation suite
- [ ] 6. MVP deploy
- [ ] 7. Full UI
- [ ] 8. Export
- [ ] 9. Polish
- [ ] Final docs & deliverables
- [ ] Self-review on live site
