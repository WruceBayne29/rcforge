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
