# Decisions log

Calls made autonomously while building, newest last.

1. **Separate repo and site** (`rcforge`), not a module inside FrameForge — cleaner as a portfolio
   piece, and the two tools share no code beyond tooling.
2. **Toolchain copied from FrameForge** (TypeScript pinned to 6.0 for typescript-eslint, ESLint +
   Prettier, Vitest, relative Vite base, same CI and Pages workflows).
3. **Every design function returns worked steps** (expression, substitution, result, clause), not
   just numbers. Showing the working is the point of a student tool, and it makes the PDF sheet free.
4. **Code tables are implemented from their underlying formulas where the code gives one**
   (τc from the SP 16 expression, Annex D slab coefficients from their generating equations), so
   there are fewer hand-typed tables to get wrong. Where a table has no formula (τc,max, τbd) the
   few values are typed in and listed in VALIDATION.md.
5. **Visual identity: an engineer's calculation sheet, not a dashboard** (owner's request: its own
   flavour, white / neutral / autumn colours, less "AI-generated" looking). Reference | Calculations |
   Output columns, framed drawings with a title block, warm paper white, ink text, rust / ochre /
   olive accents, serif headings, monospace figures, square corners, underlined tabs. Light theme is
   the default regardless of system setting.
6. **Singly reinforced design uses the code's own formula (Annex G-1.1 b, the "4.6" formula)**, as
   every textbook does, while capacities are computed from the 0.36 / 0.42 stress block. The code
   rounds these independently, so they differ by about 0.2 %. The flexure check therefore passes on
   "steel provided ≥ steel required", not on comparing the two moments.
7. **Continuous beams are designed at the first interior support** with the Table 12 / 13
   coefficients (moment wl²/10 dead + wl²/9 imposed, shear 0.6 wl), as a rectangular section because
   the flange is in tension there.
8. **Table 26 (two-way slab coefficients) is typed in from memory**, because IS 456 does not follow
   the BS 8110 yield-line equations exactly (cases with both long edges discontinuous run up to
   12 % lower). Three tests guard it: agreement with those equations within that margin, smooth
   variation with aspect ratio, and negative ≈ 4/3 × positive. Verify against the code before
   relying on it.
9. **Minimum eccentricity in columns is applied about one axis at a time** (cl. 25.4), taking the
   more severe of the two cases, rather than about both axes together.
10. **Footings use the mean effective depth of the two bar layers** (D − cover − φ) for both
    directions, and assume 10 % of the column load for self-weight and backfill.
11. **One light theme, no dark mode.** The sheet is meant to look like paper; a print stylesheet
    (the sheet alone, black on white) replaces the dark theme FrameForge has.
12. **PDF text is written out in plain characters** ("tau_v <= tau_c", "3-20 dia") because the
    PDF's built-in fonts have no Greek. The on-screen sheet and the browser's Print keep the symbols.
13. **Drawings set their colours as SVG attributes**, not CSS classes, so the same drawing can be
    rasterised into the PDF.
14. **Bar schedules are indicative**: span plus one development length per anchored end, 10 dia hooks,
    standard bend deductions. Stated on the sheet.
